package com.eliteexplorer.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class EddnPublisherService {

    private static final Logger log = LoggerFactory.getLogger(EddnPublisherService.class);

    private static final String EDDN_UPLOAD_URL = "https://eddn.edcd.io:4430/upload/";
    private static final String SCHEMA_JOURNAL_LIVE = "https://eddn.edcd.io/schemas/journal/1";
    private static final String SCHEMA_JOURNAL_TEST = "https://eddn.edcd.io/schemas/journal/1/test";

    private static final String SOFTWARE_NAME = "EliteExplorerCopilot";
    private static final String SOFTWARE_VERSION = "1.0.0";

    // Eventos do Journal suportados e aceitos pelo schema journal/1 do EDDN
    private static final Set<String> SUPPORTED_EVENTS = Set.of(
            "Scan", "ScanBaryCentre",
            "Location", "FSDJump", "CarrierJump", "Docked",
            "FSSDiscoveryScan", "FSSAllBodiesFound", "FSSBodySignals", "FSSSignalDiscovered",
            "SAASignalsFound", "SAAScanComplete",
            "ScanOrganic", "CodexEntry", "NavBeaconScan", "ApproachSettlement"
    );

    // Campos pessoais/sensíveis que as regras do EDDN determinam remover para proteger a privacidade
    private static final Set<String> PRIVACY_STRIP_KEYS = Set.of(
            "CockpitBreach", "BoostUsed", "FuelLevel", "FuelCapacity",
            "Wanted", "ActiveFine", "MyReputation", "SquadronName",
            "HappiestSystem", "HomeSystem", "FID", "Credits", "Loan",
            "PersonalBest", "Subsystem", "SubsystemHealth"
    );

    @Value("${eddn.publish.enabled:true}")
    private boolean enabled;

    @Value("${eddn.publish.test:false}")
    private boolean testMode;

    @Value("${edsm.commander.name:}")
    private String commanderName;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;
    private final BlockingQueue<String> eventQueue = new LinkedBlockingQueue<>(2000);
    private final AtomicBoolean running = new AtomicBoolean(false);

    private final AtomicLong totalPublished = new AtomicLong(0);
    private final AtomicLong totalErrors = new AtomicLong(0);
    private volatile String lastEventPublished = "-";
    private volatile Long lastPublishTime = null;
    private volatile String lastStatus = "Pronto";

    private Thread workerThread;

    public EddnPublisherService() {
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @PostConstruct
    public void start() {
        if (!enabled) {
            log.info("📡 Publicador EDDN desativado na configuração (eddn.publish.enabled=false).");
            return;
        }

        running.set(true);
        workerThread = new Thread(this::processQueue, "eddn-publisher-worker");
        workerThread.setDaemon(true);
        workerThread.start();
        log.info("📡 Publicador de eventos em tempo real para a rede EDDN iniciado (Modo: {})", testMode ? "TESTE" : "PRODUÇÃO/GALÁXIA");
    }

    @PreDestroy
    public void stop() {
        running.set(false);
        if (workerThread != null) {
            workerThread.interrupt();
        }
    }

    public void setCommanderName(String name) {
        if (name != null && !name.isBlank()) {
            this.commanderName = name;
        }
    }

    /**
     * Enfileira uma linha bruta de evento do Journal para transmissão ao EDDN
     */
    public void queueEvent(String rawLine, String eventName) {
        if (!enabled || !running.get() || rawLine == null || rawLine.isBlank()) return;
        if (!SUPPORTED_EVENTS.contains(eventName)) return;

        if (!eventQueue.offer(rawLine)) {
            log.warn("Fila do publicador EDDN cheia. Descartando evento {}", eventName);
        }
    }

    private void processQueue() {
        while (running.get()) {
            try {
                String rawLine = eventQueue.take();
                sendToEddn(rawLine);
                // Pequeno espaçamento para respeitar taxa do gateway do EDDN
                Thread.sleep(400);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("Erro no loop de publicação EDDN: {}", e.getMessage());
            }
        }
    }

    private void sendToEddn(String rawLine) {
        try {
            JsonNode root = objectMapper.readTree(rawLine);
            String event = root.path("event").asText("");
            if (event.isBlank() || !SUPPORTED_EVENTS.contains(event)) return;

            // Sanitiza os campos para conformidade estrita com o schema EDDN
            ObjectNode sanitizedMessage = sanitizeEvent(root);

            // Monta o envelope oficial do EDDN
            String schemaUrl = testMode ? SCHEMA_JOURNAL_TEST : SCHEMA_JOURNAL_LIVE;

            ObjectNode envelope = objectMapper.createObjectNode();
            envelope.put("$schemaRef", schemaUrl);

            ObjectNode header = objectMapper.createObjectNode();
            header.put("uploaderID", computeUploaderId());
            header.put("softwareName", SOFTWARE_NAME);
            header.put("softwareVersion", SOFTWARE_VERSION);
            envelope.set("header", header);

            envelope.set("message", sanitizedMessage);

            String requestBody = objectMapper.writeValueAsString(envelope);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(EDDN_UPLOAD_URL))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .header("User-Agent", SOFTWARE_NAME + "/" + SOFTWARE_VERSION)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() == 200) {
                totalPublished.incrementAndGet();
                lastEventPublished = event;
                lastPublishTime = System.currentTimeMillis();
                lastStatus = "OK (" + resp.statusCode() + ")";
                log.info("🛰️ [EDDN POST] Evento {} transmitido para a rede galáctica EDDN com sucesso! Total: {}", event, totalPublished.get());
            } else {
                totalErrors.incrementAndGet();
                lastStatus = "HTTP " + resp.statusCode() + ": " + resp.body();
                log.warn("⚠️ [EDDN POST] Resposta inesperada do gateway EDDN para {}: HTTP {} - {}", event, resp.statusCode(), resp.body());
            }
        } catch (Exception e) {
            totalErrors.incrementAndGet();
            lastStatus = "Erro: " + e.getMessage();
            log.error("Falha ao transmitir evento para EDDN: {}", e.getMessage());
        }
    }

    private ObjectNode sanitizeEvent(JsonNode original) {
        ObjectNode message = original.deepCopy();

        // Remove chaves proibidas pelo schema
        for (String k : PRIVACY_STRIP_KEYS) {
            message.remove(k);
        }

        // Se não for ScanOrganic, remove coordenadas de latitude/longitude por privacidade de bases
        String event = message.path("event").asText("");
        if (!"ScanOrganic".equalsIgnoreCase(event)) {
            message.remove("Latitude");
            message.remove("Longitude");
            message.remove("Altitude");
        }

        // Remove nome de comandante caso venha embutido em subnós
        if (message.has("Commander")) {
            message.remove("Commander");
        }

        return message;
    }

    private String computeUploaderId() {
        String name = (commanderName != null && !commanderName.isBlank()) ? commanderName.trim() : "EliteExplorerCopilot";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(name.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().substring(0, 32); // 32 caracteres hex
        } catch (Exception e) {
            return UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8)).toString();
        }
    }

    public Map<String, Object> getStatus() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("enabled", enabled);
        map.put("testMode", testMode);
        map.put("totalPublished", totalPublished.get());
        map.put("totalErrors", totalErrors.get());
        map.put("lastEventPublished", lastEventPublished);
        map.put("lastPublishTime", lastPublishTime);
        map.put("lastStatus", lastStatus);
        map.put("queueSize", eventQueue.size());
        return map;
    }
}
