package com.eliteexplorer.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class EdsmSyncService {

    private static final Logger log = LoggerFactory.getLogger(EdsmSyncService.class);
    private static final String EDSM_JOURNAL_API_URL = "https://www.edsm.net/api-journal-v1/";
    private static final String SOFTWARE_NAME = "EliteExplorerCopilot";
    private static final String SOFTWARE_VERSION = "1.0.0";

    // Eventos relevantes de exploração, telemetria, viagens e comandante aceitos pelo EDSM
    private static final Set<String> RELEVANT_EVENTS = Set.of(
            "Location", "FSDJump", "CarrierJump",
            "SupercruiseEntry", "SupercruiseExit",
            "Docked", "Undocked", "Touchdown", "Liftoff",
            "ApproachBody", "LeaveBody", "ApproachSettlement",
            "Scan", "FSSDiscoveryScan", "FSSAllBodiesFound", "FSSBodySignals", "FSSSignalDiscovered",
            "SAASignalsFound", "SAAScanComplete",
            "CodexEntry", "DiscoveryScan",
            "SellExplorationData", "MultiSellExplorationData",
            "Commander", "LoadGame", "Rank", "Progress", "Reputation",
            "Loadout", "ShipyardSwap",
            "Materials", "Cargo", "EngineerProgress"
    );

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;
    private final BlockingQueue<String> pendingQueue = new LinkedBlockingQueue<>(1000);

    @Value("${edsm.sync.enabled:true}")
    private boolean enabled;

    @Value("${edsm.api.key:}")
    private String apiKey;

    @Value("${edsm.commander.name:}")
    private String commanderName;

    private String gameVersion = "4.4.2.1";
    private String gameBuild = "r334925/r0 ";

    private final AtomicLong totalSent = new AtomicLong(0);
    private final AtomicLong totalAccepted = new AtomicLong(0);
    private final AtomicReference<String> lastStatusMsg = new AtomicReference<>("Iniciando telemetria EDSM...");
    private final AtomicLong lastSyncTimestamp = new AtomicLong(0);
    private final AtomicBoolean keyValid = new AtomicBoolean(false);

    public EdsmSyncService() {
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @PostConstruct
    public void init() {
        if (!enabled) {
            log.info("Sincronização com EDSM está desativada nas configurações.");
            lastStatusMsg.set("Desativado");
            return;
        }

        if (apiKey == null || apiKey.isBlank() || commanderName == null || commanderName.isBlank()) {
            log.warn("Comandante ou chave de API do EDSM não configurados (--edsm.commander.name / --edsm.api.key).");
            lastStatusMsg.set("EDSM não configurado");
            return;
        }

        log.info("EDSM Sync Service ativo para o CMDR '{}' com chave configurada.", commanderName);
        testConnection();
    }

    /**
     * Valida credenciais junto ao EDSM
     */
    public boolean testConnection() {
        if (apiKey == null || apiKey.isBlank() || commanderName == null || commanderName.isBlank()) return false;
        try {
            String testUrl = "https://www.edsm.net/api-commander-v1/get-ranks?commanderName="
                    + URLEncoder.encode(commanderName, StandardCharsets.UTF_8)
                    + "&apiKey=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(testUrl))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode node = objectMapper.readTree(resp.body());
                int msgnum = node.path("msgnum").asInt(0);
                if (msgnum == 100) {
                    keyValid.set(true);
                    lastStatusMsg.set("Conectado ao EDSM (CMDR " + commanderName + ")");
                    log.info("✅ Conexão com EDSM verificada com sucesso para CMDR '{}'!", commanderName);
                    return true;
                } else {
                    String msg = node.path("msg").asText("Erro de autenticação");
                    lastStatusMsg.set("EDSM: " + msg);
                    log.warn("⚠️ EDSM retornou: {} (msgnum={})", msg, msgnum);
                }
            }
        } catch (Exception e) {
            log.warn("Falha ao testar conexão com EDSM: {}", e.getMessage());
            lastStatusMsg.set("Falha na conexão com EDSM");
        }
        return false;
    }

    /**
     * Enfileira evento relevante lido do Journal em tempo real
     */
    public void queueEvent(String rawJsonLine, String eventName) {
        if (!enabled || apiKey == null || apiKey.isBlank() || commanderName == null || commanderName.isBlank()) return;
        if (rawJsonLine == null || rawJsonLine.isBlank()) return;

        // Filtra apenas eventos suportados pelo EDSM para poupar banda
        if (eventName != null && !RELEVANT_EVENTS.contains(eventName)) {
            return;
        }

        boolean queued = pendingQueue.offer(rawJsonLine);
        if (!queued) {
            log.warn("Fila de envio EDSM cheia (1000 itens). Descartando evento mais antigo.");
            pendingQueue.poll();
            pendingQueue.offer(rawJsonLine);
        }
    }

    /**
     * Consumidor da fila agendado a cada 1.5s
     */
    @Scheduled(fixedDelay = 1500)
    public void dispatchPendingQueue() {
        if (!enabled || apiKey == null || apiKey.isBlank() || commanderName == null || commanderName.isBlank()) return;
        if (pendingQueue.isEmpty()) return;

        // Processa até 5 eventos por ciclo para respeitar taxas da API
        int batchCount = 0;
        while (!pendingQueue.isEmpty() && batchCount < 5) {
            String eventJson = pendingQueue.poll();
            if (eventJson == null) break;

            boolean success = sendJournalEvent(eventJson);
            batchCount++;
            if (!success) {
                // Pausa rápida se houver erro transitório
                break;
            }
        }
    }

    /**
     * Executa POST url-encoded para https://www.edsm.net/api-journal-v1/
     */
    private boolean sendJournalEvent(String eventJson) {
        try {
            Map<String, String> formData = new LinkedHashMap<>();
            formData.put("commanderName", commanderName);
            formData.put("apiKey", apiKey);
            formData.put("fromSoftware", SOFTWARE_NAME);
            formData.put("fromSoftwareVersion", SOFTWARE_VERSION);
            formData.put("fromGameVersion", gameVersion);
            formData.put("fromGameBuild", gameBuild);
            formData.put("message", eventJson);

            StringBuilder formBody = new StringBuilder();
            for (Map.Entry<String, String> entry : formData.entrySet()) {
                if (formBody.length() > 0) formBody.append("&");
                formBody.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8));
                formBody.append("=");
                formBody.append(URLEncoder.encode(entry.getValue() != null ? entry.getValue() : "", StandardCharsets.UTF_8));
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(EDSM_JOURNAL_API_URL))
                    .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                    .header("User-Agent", SOFTWARE_NAME + "/" + SOFTWARE_VERSION)
                    .POST(HttpRequest.BodyPublishers.ofString(formBody.toString()))
                    .timeout(Duration.ofSeconds(12))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            totalSent.incrementAndGet();
            lastSyncTimestamp.set(System.currentTimeMillis());

            if (response.statusCode() == 200) {
                JsonNode res = objectMapper.readTree(response.body());
                int msgnum = res.path("msgnum").asInt(0);
                if (msgnum == 100) {
                    totalAccepted.incrementAndGet();
                    lastStatusMsg.set("Sincronizado (" + totalAccepted.get() + " eventos)");

                    // Checa se gerou descoberta inédita
                    JsonNode eventsNode = res.path("events");
                    if (eventsNode.isArray()) {
                        for (JsonNode ev : eventsNode) {
                            if (ev.path("systemCreated").asBoolean(false)) {
                                log.info("🌟 [EDSM] INÉDITO! Novo sistema cadastrado no EDSM pelo CMDR {}! ID={}",
                                        commanderName, ev.path("systemId").asLong());
                            }
                            if (ev.path("firstDiscover").asBoolean(false)) {
                                log.info("🏆 [EDSM] PRIMEIRO DESCOBRIDOR registrado no EDSM!");
                            }
                        }
                    }
                    return true;
                } else {
                    String msg = res.path("msg").asText("Resposta não-OK");
                    log.debug("EDSM aviso para evento: {} (msgnum={})", msg, msgnum);
                    lastStatusMsg.set("EDSM: " + msg);
                    return true; // Continua a fila mesmo se descartado
                }
            } else {
                log.warn("EDSM HTTP erro: {}", response.statusCode());
                lastStatusMsg.set("HTTP " + response.statusCode());
                return false;
            }
        } catch (Exception e) {
            log.warn("Falha no envio de evento EDSM: {}", e.getMessage());
            lastStatusMsg.set("Erro de rede no envio");
            return false;
        }
    }

    // Getters e Setters de metadados
    public void setGameVersion(String version, String build) {
        if (version != null && !version.isBlank()) this.gameVersion = version;
        if (build != null && !build.isBlank()) this.gameBuild = build;
    }

    public void setCommanderName(String name) {
        if (name != null && !name.isBlank() && !name.equalsIgnoreCase(this.commanderName)) {
            this.commanderName = name;
            log.info("Nome de comandante atualizado para envio EDSM: {}", name);
        }
    }

    public Map<String, Object> getStatus() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("enabled", enabled);
        map.put("commanderName", commanderName);
        map.put("hasApiKey", apiKey != null && !apiKey.isBlank());
        map.put("keyValid", keyValid.get());
        map.put("queueSize", pendingQueue.size());
        map.put("totalSent", totalSent.get());
        map.put("totalAccepted", totalAccepted.get());
        map.put("lastStatus", lastStatusMsg.get());
        map.put("lastSyncTime", lastSyncTimestamp.get());
        return map;
    }
}
