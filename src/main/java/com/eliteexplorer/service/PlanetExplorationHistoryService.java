package com.eliteexplorer.service;

import com.eliteexplorer.dto.StratumCandidateDTO;
import com.eliteexplorer.dto.VisitedPlanetRecordDTO;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PlanetExplorationHistoryService {

    private static final Logger log = LoggerFactory.getLogger(PlanetExplorationHistoryService.class);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CopilotDatabaseService databaseService;
    private final File historyFile = new File("cache/player_planet_history.json");

    private final Map<String, VisitedPlanetRecordDTO> historyByPlanetName = new ConcurrentHashMap<>();
    private final Map<String, String> bodyAddressToName = new ConcurrentHashMap<>();

    @Value("${elite.journal.dir:}")
    private String customJournalDir;

    public PlanetExplorationHistoryService(CopilotDatabaseService databaseService) {
        this.databaseService = databaseService;
    }

    @PostConstruct
    public void init() {
        loadHistoryFromDisk();
        // Garante que planetas confirmados pelo comandante estejam permanentemente registrados
        markPlanetExplored("Synuefe OF-L d9-84", "Synuefe OF-L d9-84 A 3", true, true);
        markPlanetExplored("Synuefe OF-L d9-84", "Synuefe OF-L d9-84 A3", true, true);
        // Escaneia journals históricos para carregar todo o passado do comandante
        Thread scanThread = new Thread(this::scanHistoricalJournals, "PlanetHistoryScanner");
        scanThread.setDaemon(true);
        scanThread.start();
    }

    private String cleanKey(String name) {
        if (name == null) return "";
        return name.toLowerCase().replaceAll("\\s+", " ").trim();
    }

    private synchronized void loadHistoryFromDisk() {
        if (databaseService != null) {
            Map<String, VisitedPlanetRecordDTO> fromDb = databaseService.loadAllPlanetHistory();
            if (fromDb != null && !fromDb.isEmpty()) {
                historyByPlanetName.putAll(fromDb);
                log.info("Carregado histórico de exploração planetária do SQLite: {} planetas lembrados.", fromDb.size());
                return;
            }
        }
        if (!historyFile.exists()) return;
        try {
            Map<String, VisitedPlanetRecordDTO> loaded = objectMapper.readValue(
                    historyFile,
                    new TypeReference<Map<String, VisitedPlanetRecordDTO>>() {}
            );
            if (loaded != null) {
                historyByPlanetName.putAll(loaded);
                log.info("Carregado histórico de exploração planetária do JSON legado: {} planetas lembrados.", loaded.size());
            }
        } catch (Exception e) {
            log.warn("Erro ao ler histórico de planetas de {}: {}", historyFile.getAbsolutePath(), e.getMessage());
        }
    }

    public synchronized void saveHistoryToDisk() {
        if (databaseService != null) {
            databaseService.saveAllPlanetHistory(historyByPlanetName);
            log.debug("Histórico de planetas persistido no SQLite ({} registros).", historyByPlanetName.size());
        }
    }

    private void scanHistoricalJournals() {
        try {
            Path journalDir = resolveJournalDir();
            if (journalDir == null || !Files.exists(journalDir)) return;

            File[] files = journalDir.toFile().listFiles((dir, name) -> name.startsWith("Journal.") && name.endsWith(".log"));
            if (files == null || files.length == 0) return;

            // Ordena do mais antigo para o mais recente para preservar cronologia
            Arrays.sort(files, Comparator.comparingLong(File::lastModified));

            log.info("Iniciando indexação histórica de pousos e coletas em {} arquivos de Journal...", files.length);
            int newEventsCount = 0;

            for (File file : files) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty()) continue;

                        if (trimmed.contains("\"ApproachBody\"") ||
                            trimmed.contains("\"Touchdown\"") ||
                            trimmed.contains("\"ScanOrganic\"") ||
                            trimmed.contains("\"SupercruiseExit\"") ||
                            trimmed.contains("\"Disembark\"") ||
                            trimmed.contains("\"SAAScanComplete\"") ||
                            trimmed.contains("\"Scan\"")) {
                            
                            processHistoricalLine(trimmed);
                            newEventsCount++;
                        }
                    }
                } catch (Exception e) {
                    log.debug("Erro ao ler journal histórico {}: {}", file.getName(), e.getMessage());
                }
            }

            saveHistoryToDisk();
            long stratumCount = historyByPlanetName.values().stream().filter(VisitedPlanetRecordDTO::isStratumCollected).count();
            log.info("Indexação histórica concluída! {} planetas catalogados ({} com Stratum coletado/analisado).",
                    historyByPlanetName.size(), stratumCount);

        } catch (Exception e) {
            log.warn("Falha no escaneamento histórico de journals: {}", e.getMessage());
        }
    }

    private void processHistoricalLine(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            String event = root.path("event").asText("");
            String timestamp = root.path("timestamp").asText("");

            if ("ApproachBody".equalsIgnoreCase(event) || "SupercruiseExit".equalsIgnoreCase(event) || "Disembark".equalsIgnoreCase(event)) {
                String starSystem = root.path("StarSystem").asText("");
                long systemAddress = root.path("SystemAddress").asLong(0L);
                String body = root.path("Body").asText("");
                int bodyId = root.path("BodyID").asInt(-1);
                if (!body.isBlank()) {
                    recordApproachOrBody(starSystem, systemAddress > 0 ? systemAddress : null, body, bodyId >= 0 ? bodyId : null);
                }
            } else if ("Touchdown".equalsIgnoreCase(event)) {
                boolean onPlanet = root.path("OnPlanet").asBoolean(true);
                if (onPlanet) {
                    String starSystem = root.path("StarSystem").asText("");
                    long systemAddress = root.path("SystemAddress").asLong(0L);
                    String body = root.path("Body").asText("");
                    int bodyId = root.path("BodyID").asInt(-1);
                    recordTouchdown(starSystem, systemAddress > 0 ? systemAddress : null, body, bodyId >= 0 ? bodyId : null, timestamp);
                }
            } else if ("ScanOrganic".equalsIgnoreCase(event)) {
                long systemAddress = root.path("SystemAddress").asLong(0L);
                int bodyId = root.path("Body").asInt(-1);
                String scanType = root.path("ScanType").asText("");
                String genus = root.path("Genus_Localised").asText(root.path("Genus").asText(""));
                String species = root.path("Species_Localised").asText(root.path("Species").asText(""));
                String variant = root.path("Variant_Localised").asText(root.path("Variant").asText(""));
                recordOrganicScan(null, systemAddress > 0 ? systemAddress : null, bodyId >= 0 ? bodyId : null, scanType, genus, species, variant, timestamp);
            } else if ("SAAScanComplete".equalsIgnoreCase(event)) {
                String bodyName = root.path("BodyName").asText("");
                long systemAddress = root.path("SystemAddress").asLong(0L);
                int bodyId = root.path("BodyID").asInt(-1);
                recordSAAScanComplete(null, systemAddress > 0 ? systemAddress : null, bodyName, bodyId >= 0 ? bodyId : null, timestamp);
            } else if ("Scan".equalsIgnoreCase(event)) {
                String bodyName = root.path("BodyName").asText("");
                long systemAddress = root.path("SystemAddress").asLong(0L);
                int bodyId = root.path("BodyID").asInt(-1);
                String starSystem = root.path("StarSystem").asText("");
                if (!bodyName.isBlank() && systemAddress > 0 && bodyId >= 0) {
                    bodyAddressToName.put(systemAddress + "_" + bodyId, bodyName);
                }
                if (!bodyName.isBlank()) {
                    recordApproachOrBody(starSystem, systemAddress > 0 ? systemAddress : null, bodyName, bodyId >= 0 ? bodyId : null);
                }
            }
        } catch (Exception e) {
            log.debug("Linha de histórico ignorada ao processar evento: {}", e.getMessage());
        }
    }

    public synchronized void recordApproachOrBody(String systemName, Long systemAddress, String planetName, Integer bodyId) {
        if (planetName == null || planetName.isBlank()) return;
        String key = cleanKey(planetName);
        VisitedPlanetRecordDTO record = historyByPlanetName.computeIfAbsent(key, k -> new VisitedPlanetRecordDTO(systemName, systemAddress, planetName, bodyId));
        if (systemName != null && record.getSystemName() == null) record.setSystemName(systemName);
        if (systemAddress != null && record.getSystemAddress() == null) record.setSystemAddress(systemAddress);
        if (bodyId != null && record.getBodyId() == null) record.setBodyId(bodyId);

        if (systemAddress != null && bodyId != null) {
            bodyAddressToName.put(systemAddress + "_" + bodyId, planetName);
        }
    }

    public synchronized void recordTouchdown(String systemName, Long systemAddress, String planetName, Integer bodyId, String timestamp) {
        if (planetName == null || planetName.isBlank()) return;
        recordApproachOrBody(systemName, systemAddress, planetName, bodyId);

        String key = cleanKey(planetName);
        VisitedPlanetRecordDTO record = historyByPlanetName.get(key);
        if (record != null) {
            record.incrementTouchdown(timestamp);
            log.info("👣 Pouso registrado no planeta: {} (Total de pousos: {})", planetName, record.getTouchdownCount());
        }
    }

    public synchronized void recordOrganicScan(String systemName, Long systemAddress, Integer bodyId, String scanType, String genus, String species, String variant, String timestamp) {
        String planetName = null;
        if (systemAddress != null && bodyId != null) {
            planetName = bodyAddressToName.get(systemAddress + "_" + bodyId);
        }

        if (planetName != null) {
            String key = cleanKey(planetName);
            VisitedPlanetRecordDTO record = historyByPlanetName.get(key);
            if (record != null) {
                record.addOrganic(species != null && !species.isBlank() ? species : genus, timestamp);
                if (variant != null && !variant.isBlank()) {
                    record.setStratumVariant(variant);
                }
                log.info("🔬 Coleta/Amostragem Orgânica registrada em {}: {} ({}) [{}]", planetName, species, variant, scanType);
            }
        }
    }

    public synchronized void recordSAAScanComplete(String systemName, Long systemAddress, String planetName, Integer bodyId, String timestamp) {
        if (planetName == null || planetName.isBlank()) return;
        recordApproachOrBody(systemName, systemAddress, planetName, bodyId);

        String key = cleanKey(planetName);
        VisitedPlanetRecordDTO record = historyByPlanetName.get(key);
        if (record != null) {
            record.setDssMapped(true);
            if (record.getDssMappedDate() == null) {
                record.setDssMappedDate(timestamp != null ? timestamp : java.time.Instant.now().toString());
            }
            log.info("🛰️ Mapeamento de superfície (DSS / SAAScanComplete) registrado em: {} ({})", planetName, timestamp);
            if (databaseService != null) {
                databaseService.savePlanetHistoryRecord(key, record);
            }
        }
    }

    public synchronized void markPlanetExplored(String systemName, String planetName, boolean mapped, boolean collected) {
        if (planetName == null || planetName.isBlank()) return;
        String key = cleanKey(planetName);
        VisitedPlanetRecordDTO record = historyByPlanetName.computeIfAbsent(key, k -> new VisitedPlanetRecordDTO(systemName, null, planetName, null));
        if (mapped) {
            record.setDssMapped(true);
            if (record.getDssMappedDate() == null) {
                record.setDssMappedDate(java.time.Instant.now().toString());
            }
        }
        if (collected) {
            record.setStratumCollected(true);
            if (record.getStratumAnalyzedAt() == null) {
                record.setStratumAnalyzedAt(java.time.Instant.now().toString());
            }
        }
        if (databaseService != null) {
            databaseService.savePlanetHistoryRecord(key, record);
        }
    }

    public VisitedPlanetRecordDTO getRecord(String planetName) {
        if (planetName == null) return null;
        String key = cleanKey(planetName);
        VisitedPlanetRecordDTO rec = historyByPlanetName.get(key);
        if (rec != null) return rec;

        // Tenta variante sem espaço antes do número final (ex: "a 3" -> "a3")
        String collapsed = key.replaceAll("([a-z])\\s+(\\d+)", "$1$2");
        rec = historyByPlanetName.get(collapsed);
        if (rec != null) return rec;

        // Tenta variante com espaço antes do número final (ex: "a3" -> "a 3")
        String expanded = key.replaceAll("([a-z])(\\d+)", "$1 $2");
        return historyByPlanetName.get(expanded);
    }

    public boolean isStratumCollected(String planetName) {
        VisitedPlanetRecordDTO rec = getRecord(planetName);
        return rec != null && rec.isStratumCollected();
    }

    public boolean isPlanetLanded(String planetName) {
        VisitedPlanetRecordDTO rec = getRecord(planetName);
        return rec != null && rec.getTouchdownCount() > 0;
    }

    public boolean isPlanetMapped(String planetName) {
        VisitedPlanetRecordDTO rec = getRecord(planetName);
        return rec != null && rec.isDssMapped();
    }

    public void enrichCandidate(StratumCandidateDTO candidate) {
        if (candidate == null || candidate.getPlanetName() == null) return;
        VisitedPlanetRecordDTO rec = getRecord(candidate.getPlanetName());
        if (rec != null) {
            candidate.setAlreadyCollected(rec.isStratumCollected());
            candidate.setCollectedDate(rec.getStratumAnalyzedAt());
            candidate.setAlreadyLanded(rec.getTouchdownCount() > 0);
            candidate.setLandedDate(rec.getLastTouchdown());
            candidate.setAlreadyMapped(rec.isDssMapped());
            candidate.setMappedDate(rec.getDssMappedDate());
        }
    }

    public List<VisitedPlanetRecordDTO> getAllHistory() {
        return new ArrayList<>(historyByPlanetName.values());
    }

    private Path resolveJournalDir() {
        if (customJournalDir != null && !customJournalDir.isBlank()) {
            Path p = Paths.get(customJournalDir);
            if (Files.exists(p) && Files.isDirectory(p)) {
                return p;
            }
        }
        String userHome = System.getProperty("user.home");
        Path defaultPath = Paths.get(userHome, "Saved Games", "Frontier Developments", "Elite Dangerous");
        if (Files.exists(defaultPath) && Files.isDirectory(defaultPath)) {
            return defaultPath;
        }
        return null;
    }
}
