package com.eliteexplorer.service;

import com.eliteexplorer.dto.BioSampleDTO;
import com.eliteexplorer.dto.PlanetaryStatusDTO;
import com.eliteexplorer.dto.RoutePointDTO;
import com.eliteexplorer.dto.SurfaceFeatureDTO;
import com.eliteexplorer.model.PlayerStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class JournalWatcherService {

    private static final Logger log = LoggerFactory.getLogger(JournalWatcherService.class);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicReference<PlayerStatus> playerStatusRef = new AtomicReference<>(new PlayerStatus());
    private final AtomicReference<List<RoutePointDTO>> activeRouteRef = new AtomicReference<>(new ArrayList<>());
    private final AtomicReference<PlanetaryStatusDTO> planetaryStatusRef = new AtomicReference<>(new PlanetaryStatusDTO());
    private final EdsmSyncService edsmSyncService;
    private final EddnTrafficListenerService eddnTrafficService;
    private final GalaxyExplorationService galaxyExplorationService;
    private final PlanetExplorationHistoryService planetHistoryService;
    private final SurfaceFeatureService surfaceFeatureService;
    private final SystemBodiesService systemBodiesService;
    private final EddnPublisherService eddnPublisherService;
    private final SseNotificationService sseNotificationService;

    @Value("${elite.journal.dir:}")
    private String customJournalDir;

    @Value("${edsm.commander.name:}")
    private String configuredCommanderName;

    private Path journalDir;
    private File currentJournalFile;
    private long lastReadOffset = 0L;
    private long lastNavRouteModified = 0L;
    private long lastStatusModified = 0L;
    private boolean disembarkedCalibrated = false;
    private String activeBioBodyName = "";

    public JournalWatcherService(EdsmSyncService edsmSyncService,
                                 @org.springframework.context.annotation.Lazy EddnTrafficListenerService eddnTrafficService,
                                 @org.springframework.context.annotation.Lazy GalaxyExplorationService galaxyExplorationService,
                                 @org.springframework.context.annotation.Lazy PlanetExplorationHistoryService planetHistoryService,
                                 SurfaceFeatureService surfaceFeatureService,
                                 @org.springframework.context.annotation.Lazy SystemBodiesService systemBodiesService,
                                 @org.springframework.context.annotation.Lazy EddnPublisherService eddnPublisherService,
                                 @org.springframework.context.annotation.Lazy SseNotificationService sseNotificationService) {
        this.edsmSyncService = edsmSyncService;
        this.eddnTrafficService = eddnTrafficService;
        this.galaxyExplorationService = galaxyExplorationService;
        this.planetHistoryService = planetHistoryService;
        this.surfaceFeatureService = surfaceFeatureService;
        this.systemBodiesService = systemBodiesService;
        this.eddnPublisherService = eddnPublisherService;
        this.sseNotificationService = sseNotificationService;
    }

    @PostConstruct
    public void init() {
        if (configuredCommanderName != null && !configuredCommanderName.isBlank()) {
            playerStatusRef.get().setCommander(configuredCommanderName);
        }
        resolveJournalDir();
        scanAndReconstructState();
    }

    private void resolveJournalDir() {
        if (customJournalDir != null && !customJournalDir.isBlank()) {
            Path p = Paths.get(customJournalDir);
            if (Files.exists(p) && Files.isDirectory(p)) {
                this.journalDir = p;
                log.info("Usando diretório de journal configurado: {}", journalDir);
                return;
            }
        }

        // Padrão do Windows: %USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous
        String userHome = System.getProperty("user.home");
        Path defaultPath = Paths.get(userHome, "Saved Games", "Frontier Developments", "Elite Dangerous");
        if (Files.exists(defaultPath) && Files.isDirectory(defaultPath)) {
            this.journalDir = defaultPath;
            log.info("Diretório de journal detectado automaticamente: {}", journalDir);
        } else {
            log.warn("Diretório de journal do Elite Dangerous não encontrado em: {}", defaultPath);
            this.journalDir = null;
        }
    }

    public synchronized void scanAndReconstructState() {
        PlayerStatus status = playerStatusRef.get();
        if (journalDir == null || !Files.exists(journalDir)) {
            status.setJournalFound(false);
            return;
        }

        status.setJournalFound(true);
        status.setJournalPath(journalDir.toAbsolutePath().toString());

        File[] files = journalDir.toFile().listFiles((dir, name) -> name.startsWith("Journal.") && name.endsWith(".log"));
        if (files == null || files.length == 0) {
            log.warn("Nenhum arquivo Journal.*.log encontrado em {}", journalDir);
            return;
        }

        // Ordenar pelo mais recente
        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
        File latestFile = files[0];
        this.currentJournalFile = latestFile;
        status.setJournalFile(latestFile.getName());

        log.info("Lendo arquivo de journal mais recente: {}", latestFile.getName());

        Map<String, String> startupProfileEvents = new LinkedHashMap<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(latestFile), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                processLine(trimmed, status, false);
                if (trimmed.contains("\"event\":\"Location\"") || trimmed.contains("\"event\":\"FSDJump\"")) {
                    startupProfileEvents.put("Location", trimmed);
                } else if (trimmed.contains("\"event\":\"Commander\"")) {
                    startupProfileEvents.put("Commander", trimmed);
                } else if (trimmed.contains("\"event\":\"Rank\"")) {
                    startupProfileEvents.put("Rank", trimmed);
                } else if (trimmed.contains("\"event\":\"Progress\"")) {
                    startupProfileEvents.put("Progress", trimmed);
                } else if (trimmed.contains("\"event\":\"Reputation\"")) {
                    startupProfileEvents.put("Reputation", trimmed);
                } else if (trimmed.contains("\"event\":\"LoadGame\"")) {
                    startupProfileEvents.put("LoadGame", trimmed);
                } else if (trimmed.contains("\"event\":\"Materials\"")) {
                    startupProfileEvents.put("Materials", trimmed);
                } else if (trimmed.contains("\"event\":\"EngineerProgress\"")) {
                    startupProfileEvents.put("EngineerProgress", trimmed);
                } else if (trimmed.contains("\"event\":\"Loadout\"")) {
                    startupProfileEvents.put("Loadout", trimmed);
                }
            }
            this.lastReadOffset = latestFile.length();
            // Sincroniza estado do perfil (ranks, créditos, reputação, nave) e localização inicial no EDSM
            for (Map.Entry<String, String> entry : startupProfileEvents.entrySet()) {
                edsmSyncService.queueEvent(entry.getValue(), entry.getKey());
            }
        } catch (Exception e) {
            log.error("Erro ao ler journal inicial {}: {}", latestFile.getName(), e.getMessage(), e);
        }

        log.info("Estado do Comandante inicializado: CMDR={}, Sistema={}, Estação={}, Carga={}T, Nave={}",
                status.getCommander(), status.getCurrentSystem(), status.getCurrentStation(),
                status.getCargoCapacity(), status.getShipType());

        if (status.getCurrentSystem() != null && status.getPosX() != null) {
            galaxyExplorationService.registerDiscoveredSystem(
                    status.getCurrentSystem(),
                    status.getPosX(),
                    status.getPosY(),
                    status.getPosZ(),
                    status.getStarClass()
            );
        }

        // Inicializa o estado planetário como desligado/no espaço a menos que haja telemetria real de solo
        PlanetaryStatusDTO ps = planetaryStatusRef.get();
        ps.setCurrentSystem(status.getCurrentSystem());
        if (status.isDocked()) {
            ps.setOnPlanetSurface(false);
            ps.setInPlanetaryOrbit(false);
            ps.setLanded(false);
            ps.setGlideMode(false);
        }
        pollStatusJson();
    }

    @Scheduled(fixedDelay = 1500)
    public synchronized void pollJournalUpdates() {
        pollNavRouteUpdates();
        if (journalDir == null || !Files.exists(journalDir)) {
            return;
        }

        File[] files = journalDir.toFile().listFiles((dir, name) -> name.startsWith("Journal.") && name.endsWith(".log"));
        if (files == null || files.length == 0) {
            return;
        }

        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
        File latest = files[0];

        PlayerStatus status = playerStatusRef.get();

        // Se um novo arquivo foi gerado (novo início de jogo/sessão)
        if (currentJournalFile == null || !currentJournalFile.getName().equals(latest.getName())) {
            log.info("Novo arquivo de journal detectado: {}", latest.getName());
            this.currentJournalFile = latest;
            status.setJournalFile(latest.getName());
            this.lastReadOffset = 0L;
        }

        long currentLength = currentJournalFile.length();
        if (currentLength > lastReadOffset) {
            try (RandomAccessFile raf = new RandomAccessFile(currentJournalFile, "r")) {
                raf.seek(lastReadOffset);
                String rawLine;
                while ((rawLine = raf.readLine()) != null) {
                    // RandomAccessFile lê ISO-8859-1 por padrão, converter bytes para UTF-8
                    byte[] bytes = rawLine.getBytes(StandardCharsets.ISO_8859_1);
                    String line = new String(bytes, StandardCharsets.UTF_8).trim();
                    if (!line.isEmpty()) {
                        processLine(line, status, true);
                    }
                }
                this.lastReadOffset = raf.getFilePointer();
            } catch (Exception e) {
                log.warn("Erro ao ler novas linhas do journal: {}", e.getMessage());
            }
        }
    }

    private void processLine(String line, PlayerStatus status, boolean isLiveUpdate) {
        if (line == null || line.isBlank()) return;
        try {
            JsonNode root = objectMapper.readTree(line);
            String event = root.path("event").asText("");
            String timestamp = root.path("timestamp").asText("");

            if (event.isEmpty()) return;

            status.setLastEvent(event);
            status.setLastEventTime(timestamp);

            if ("Fileheader".equalsIgnoreCase(event)) {
                String gv = root.path("gameversion").asText("");
                String gb = root.path("build").asText("");
                edsmSyncService.setGameVersion(gv, gb);
            }

            if (isLiveUpdate) {
                edsmSyncService.queueEvent(line, event);
                eddnPublisherService.queueEvent(line, event);
            }

            switch (event) {
                case "LoadGame" -> {
                    String cmdr = root.path("Commander").asText("");
                    if (!cmdr.isBlank()) {
                        status.setCommander(cmdr);
                        edsmSyncService.setCommanderName(cmdr);
                        eddnPublisherService.setCommanderName(cmdr);
                    }
                    String ship = root.path("Ship").asText("");
                    if (!ship.isBlank()) status.setShipRaw(ship);
                    String shipName = root.path("ShipName").asText("");
                    if (!shipName.isBlank()) status.setShipName(shipName);
                    edsmSyncService.setGameVersion(root.path("gameversion").asText(""), root.path("build").asText(""));
                }
                case "Commander" -> {
                    String cmdr = root.path("Name").asText("");
                    if (!cmdr.isBlank()) {
                        status.setCommander(cmdr);
                        edsmSyncService.setCommanderName(cmdr);
                        eddnPublisherService.setCommanderName(cmdr);
                    }
                }
                case "Location" -> {
                    String sys = root.path("StarSystem").asText("");
                    boolean docked = root.path("Docked").asBoolean(false);
                    String station = root.path("StationName").asText("");
                    String stationType = root.path("StationType").asText("");
                    String bodyType = root.path("BodyType").asText("");
                    long sysAddr = root.path("SystemAddress").asLong(0L);
                    updateCoordinatesIfPresent(root, status);
                    updateSystemIfChanged(sys, status);
                    status.setDocked(docked);
                    status.setCurrentStation(station);
                    if (status.getPosX() != null) {
                        galaxyExplorationService.registerDiscoveredSystem(
                                sys,
                                status.getPosX(),
                                status.getPosY(),
                                status.getPosZ(),
                                status.getStarClass()
                        );
                    }
                    systemBodiesService.recordPrimaryStar(sys, sysAddr, status.getStarClass(), status.getPosX(), status.getPosY(), status.getPosZ());
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    if (root.has("Latitude") && root.has("Longitude")) {
                        double lat = root.path("Latitude").asDouble();
                        double lon = root.path("Longitude").asDouble();
                        ps.setLatitude(lat);
                        ps.setLongitude(lon);
                        String body = root.path("Body").asText("");
                        if (!body.isBlank()) {
                            ps.setBodyName(body);
                            if (root.has("NearestDestination")) {
                                String rawDest = root.path("NearestDestination").asText("");
                                String locDest = root.path("NearestDestination_Localised").asText(rawDest);
                                surfaceFeatureService.recordKnownPointOfInterest(rawDest, locDest, body, lat, lon, sys);
                            }
                            surfaceFeatureService.syncPlanetaryStatusSignals(ps, sys, body);
                        }
                    }
                    if (docked && ("Station".equalsIgnoreCase(bodyType) || isOrbitalStation(stationType))) {
                        ps.setOnPlanetSurface(false);
                        ps.setInPlanetaryOrbit(false);
                        ps.setLanded(false);
                        ps.setGlideMode(false);
                        ps.setInSrv(false);
                        ps.setOnFoot(false);
                    }
                }
                case "StartJump" -> {
                    if (isLiveUpdate) {
                        String jumpType = root.path("JumpType").asText("");
                        if ("Hyperspace".equalsIgnoreCase(jumpType)) {
                            eddnTrafficService.recordTrafficEvent(new com.eliteexplorer.dto.TrafficEventDTO(
                                    java.util.UUID.randomUUID().toString(),
                                    "JUMP_OUT",
                                    status.getCurrentSystem(),
                                    status.getPosX() != null ? status.getPosX() : 0.0,
                                    status.getPosY() != null ? status.getPosY() : 0.0,
                                    status.getPosZ() != null ? status.getPosZ() : 0.0,
                                    System.currentTimeMillis(),
                                    status.getCommander() != null ? status.getCommander() : "Você",
                                    "LOCAL"
                            ));
                        }
                    }
                }
                case "FSDJump" -> {
                    String sys = root.path("StarSystem").asText("");
                    long sysAddr = root.path("SystemAddress").asLong(0L);
                    updateCoordinatesIfPresent(root, status);
                    updateSystemIfChanged(sys, status);
                    status.setDocked(false);
                    status.setCurrentStation("");
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    clearPlanetaryTelemetry(ps);
                    clearBioTelemetry(ps);
                    if (status.getPosX() != null) {
                        galaxyExplorationService.registerDiscoveredSystem(
                                sys,
                                status.getPosX(),
                                status.getPosY(),
                                status.getPosZ(),
                                status.getStarClass()
                        );
                    }
                    systemBodiesService.recordPrimaryStar(sys, sysAddr, status.getStarClass(), status.getPosX(), status.getPosY(), status.getPosZ());
                    if (isLiveUpdate) {
                        eddnTrafficService.recordTrafficEvent(new com.eliteexplorer.dto.TrafficEventDTO(
                                java.util.UUID.randomUUID().toString(),
                                "JUMP_IN",
                                sys,
                                status.getPosX() != null ? status.getPosX() : 0.0,
                                status.getPosY() != null ? status.getPosY() : 0.0,
                                status.getPosZ() != null ? status.getPosZ() : 0.0,
                                System.currentTimeMillis(),
                                status.getCommander() != null ? status.getCommander() : "Você",
                                "LOCAL"
                        ));
                    }
                }
                case "CarrierJump" -> {
                    String sys = root.path("StarSystem").asText("");
                    String station = root.path("StationName").asText("");
                    long sysAddr = root.path("SystemAddress").asLong(0L);
                    updateCoordinatesIfPresent(root, status);
                    updateSystemIfChanged(sys, status);
                    status.setCurrentStation(station);
                    if (status.getPosX() != null) {
                        galaxyExplorationService.registerDiscoveredSystem(
                                sys,
                                status.getPosX(),
                                status.getPosY(),
                                status.getPosZ(),
                                status.getStarClass()
                        );
                    }
                    systemBodiesService.recordPrimaryStar(sys, sysAddr, status.getStarClass(), status.getPosX(), status.getPosY(), status.getPosZ());
                }
                case "Docked" -> {
                    String sys = root.path("StarSystem").asText("");
                    if (!sys.isBlank()) {
                        updateSystemIfChanged(sys, status);
                    }
                    String station = root.path("StationName").asText("");
                    String stationType = root.path("StationType").asText("");
                    status.setDocked(true);
                    status.setCurrentStation(station);
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    if (isOrbitalStation(stationType)) {
                        clearPlanetaryTelemetry(ps);
                        clearBioTelemetry(ps);
                    }
                }
                case "Undocked" -> {
                    status.setDocked(false);
                    status.setCurrentStation("");
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    String stationType = root.path("StationType").asText("");
                    if (isOrbitalStation(stationType)) {
                        clearPlanetaryTelemetry(ps);
                    }
                }
                case "Loadout" -> {
                    String ship = root.path("Ship").asText("");
                    if (!ship.isBlank()) {
                        status.setShipRaw(ship);
                    }
                    String shipName = root.path("ShipName").asText("");
                    if (!shipName.isBlank()) {
                        status.setShipName(shipName);
                    }
                    if (root.has("CargoCapacity")) {
                        int cargo = root.path("CargoCapacity").asInt(0);
                        if (cargo > 0) {
                            status.setCargoCapacity(cargo);
                        }
                    }
                }
                case "ShipyardSwap" -> {
                    String ship = root.path("ShipType").asText("");
                    if (!ship.isBlank()) {
                        status.setShipRaw(ship);
                    }
                }
                case "ApproachBody" -> {
                    String starSystem = root.path("StarSystem").asText("");
                    long systemAddress = root.path("SystemAddress").asLong(0L);
                    String body = root.path("Body").asText("");
                    int bodyId = root.path("BodyID").asInt(-1);
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    ps.setInPlanetaryOrbit(true);
                    ps.setOnPlanetSurface(true);
                    ps.setCurrentSystem(starSystem);
                    ps.setBodyName(body);
                    ps.setBodyId(bodyId >= 0 ? bodyId : null);
                    if (!body.isBlank()) {
                        planetHistoryService.recordApproachOrBody(starSystem, systemAddress > 0 ? systemAddress : null, body, bodyId >= 0 ? bodyId : null);
                        surfaceFeatureService.syncPlanetaryStatusSignals(ps, starSystem, body);
                        enrichPlanetaryBodyInfo(ps);
                    }
                    if (isLiveUpdate) {
                        sseNotificationService.broadcastEvent("surface_status", ps);
                    }
                }
                case "ApproachSettlement" -> {
                    String name = root.path("Name").asText("");
                    long marketId = root.path("MarketID").asLong(0L);
                    String bodyName = root.path("BodyName").asText("");
                    double lat = root.path("Latitude").asDouble(0.0);
                    double lon = root.path("Longitude").asDouble(0.0);
                    String starSystem = status.getCurrentSystem();
                    if (!name.isBlank() && !bodyName.isBlank()) {
                        surfaceFeatureService.recordKnownPointOfInterest(name, name, bodyName, lat, lon, starSystem);
                        PlanetaryStatusDTO ps = planetaryStatusRef.get();
                        surfaceFeatureService.syncPlanetaryStatusSignals(ps, starSystem, bodyName);
                    }
                }
                case "SAASignalsFound", "FSSBodySignals" -> {
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    String body = root.path("BodyName").asText("");
                    Integer bioCount = null;
                    Integer geoCount = null;
                    Integer humanCount = null;
                    Integer miningCount = null;
                    JsonNode signals = root.path("Signals");
                    if (signals.isArray()) {
                        for (JsonNode sig : signals) {
                            String type = sig.path("Type").asText("");
                            String typeLoc = sig.path("Type_Localised").asText("");
                            int count = sig.path("Count").asInt(0);
                            if (type.toLowerCase().contains("bio")) {
                                bioCount = count;
                            } else if (type.toLowerCase().contains("geo")) {
                                geoCount = count;
                            } else if (type.toLowerCase().contains("human")) {
                                humanCount = count;
                            } else if (type.toLowerCase().contains("mining") || typeLoc.toLowerCase().contains("minera")) {
                                miningCount = count;
                            }
                        }
                    }

                    // Checa gêneros biológicos detectados pelo DSS (Odyssey)
                    JsonNode genuses = root.path("Genuses");
                    if (genuses.isArray() && genuses.size() > 0) {
                        boolean hasStratum = false;
                        for (JsonNode g : genuses) {
                            String gCode = g.path("Genus").asText("").toLowerCase();
                            String gLoc = g.path("Genus_Localised").asText("").toLowerCase();
                            if (gCode.contains("stratum") || gLoc.contains("stratum")) {
                                hasStratum = true;
                                break;
                            }
                        }
                        if (!hasStratum) {
                            galaxyExplorationService.markBodyNonStratum(status.getCurrentSystem(), body);
                        }
                    }

                    // Registra contagem de sinais DSS
                    surfaceFeatureService.recordDssSignals(status.getCurrentSystem(), body, signals, genuses);
                    systemBodiesService.recordSignals(status.getCurrentSystem(), body, bioCount, geoCount, humanCount);

                    if (!body.isBlank() && (ps.getBodyName().isBlank() || ps.getBodyName().equalsIgnoreCase(body))) {
                        surfaceFeatureService.syncPlanetaryStatusSignals(ps, status.getCurrentSystem(), body);
                    }
                }
                case "Scan" -> {
                    systemBodiesService.recordJournalScan(root);
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    String scannedBody = root.path("BodyName").asText("");
                    if (!scannedBody.isBlank() && scannedBody.equalsIgnoreCase(ps.getBodyName())) {
                        enrichPlanetaryBodyInfo(ps);
                        if (isLiveUpdate) {
                            sseNotificationService.broadcastEvent("surface_status", ps);
                        }
                    }
                }
                case "LeaveBody" -> {
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    clearPlanetaryTelemetry(ps);
                    clearBioTelemetry(ps);
                    if (isLiveUpdate) {
                        sseNotificationService.broadcastEvent("surface_status", ps);
                    }
                }
                case "SupercruiseExit" -> {
                    String starSystem = root.path("StarSystem").asText("");
                    long systemAddress = root.path("SystemAddress").asLong(0L);
                    String body = root.path("Body").asText("");
                    String bodyType = root.path("BodyType").asText("");
                    int bodyId = root.path("BodyID").asInt(-1);
                    if ("Planet".equalsIgnoreCase(bodyType)) {
                        PlanetaryStatusDTO ps = planetaryStatusRef.get();
                        if (!body.isBlank() && !activeBioBodyName.isBlank() && !body.equalsIgnoreCase(activeBioBodyName)) {
                            clearBioTelemetry(ps);
                        }
                        ps.setInPlanetaryOrbit(true);
                        ps.setOnPlanetSurface(true);
                        ps.setCurrentSystem(starSystem);
                        ps.setBodyName(body);
                        ps.setBodyId(bodyId >= 0 ? bodyId : null);
                        if (!body.isBlank()) {
                            surfaceFeatureService.syncPlanetaryStatusSignals(ps, starSystem, body);
                        }
                        if (isLiveUpdate) {
                            sseNotificationService.broadcastEvent("surface_status", ps);
                        }
                    }
                    if (!body.isBlank()) {
                        planetHistoryService.recordApproachOrBody(starSystem, systemAddress > 0 ? systemAddress : null, body, bodyId >= 0 ? bodyId : null);
                    }
                }
                case "Disembark" -> {
                    String starSystem = root.path("StarSystem").asText("");
                    long systemAddress = root.path("SystemAddress").asLong(0L);
                    String body = root.path("Body").asText("");
                    int bodyId = root.path("BodyID").asInt(-1);
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    ps.setOnFoot(true);
                    ps.setOnPlanetSurface(true);
                    if (!body.isBlank()) {
                        if (!activeBioBodyName.isBlank() && !body.equalsIgnoreCase(activeBioBodyName)) {
                            clearBioTelemetry(ps);
                        }
                        ps.setBodyName(body);
                        ps.setBodyId(bodyId >= 0 ? bodyId : null);
                        planetHistoryService.recordApproachOrBody(starSystem, systemAddress > 0 ? systemAddress : null, body, bodyId >= 0 ? bodyId : null);
                        surfaceFeatureService.syncPlanetaryStatusSignals(ps, starSystem, body);
                    }
                    if (isLiveUpdate) {
                        sseNotificationService.broadcastEvent("surface_status", ps);
                    }
                }
                case "Touchdown" -> {
                    boolean onPlanet = root.path("OnPlanet").asBoolean(true);
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    ps.setLanded(true);
                    ps.setOnPlanetSurface(true);
                    double tdLat = ps.getLatitude() != null ? ps.getLatitude() : 0.0;
                    double tdLon = ps.getLongitude() != null ? ps.getLongitude() : 0.0;
                    if (root.has("Latitude") && root.has("Longitude")) {
                        tdLat = root.path("Latitude").asDouble();
                        tdLon = root.path("Longitude").asDouble();
                        ps.setTouchdownLat(tdLat);
                        ps.setTouchdownLong(tdLon);
                        ps.setLatitude(tdLat);
                        ps.setLongitude(tdLon);
                        ps.setAltitude(0.0);
                        ps.setDistanceToTouchdown(0.0);
                    }
                    String starSystem = root.path("StarSystem").asText(ps.getCurrentSystem());
                    long systemAddress = root.path("SystemAddress").asLong(0L);
                    String body = root.path("Body").asText(ps.getBodyName());
                    int bodyId = root.path("BodyID").asInt(-1);
                    if (isBioCollectionCompleted(ps) || (!body.isBlank() && !activeBioBodyName.isBlank() && !body.equalsIgnoreCase(activeBioBodyName))) {
                        clearBioTelemetry(ps);
                    }
                    if (onPlanet) {
                        planetHistoryService.recordTouchdown(starSystem, systemAddress > 0 ? systemAddress : null, body, bodyId >= 0 ? bodyId : null, timestamp);
                    }

                    // Registra ponto de interesse ou local de mineração real onde o jogador pousou
                    if (root.has("NearestDestination")) {
                        String rawDest = root.path("NearestDestination").asText("");
                        String locDest = root.path("NearestDestination_Localised").asText(rawDest);
                        if (!rawDest.isBlank() && !body.isBlank()) {
                            surfaceFeatureService.recordKnownPointOfInterest(rawDest, locDest, body, tdLat, tdLon, starSystem);
                            surfaceFeatureService.syncPlanetaryStatusSignals(ps, starSystem, body);
                        }
                    }

                    if (isLiveUpdate) {
                        sseNotificationService.broadcastEvent("surface_status", ps);
                    }
                }
                case "Liftoff" -> {
                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    ps.setLanded(false);
                    if (isBioCollectionCompleted(ps)) {
                        clearBioTelemetry(ps);
                    }
                    if (root.has("NearestDestination")) {
                        String rawDest = root.path("NearestDestination").asText("");
                        String locDest = root.path("NearestDestination_Localised").asText(rawDest);
                        double lat = root.has("Latitude") ? root.path("Latitude").asDouble() : (ps.getLatitude() != null ? ps.getLatitude() : 0.0);
                        double lon = root.has("Longitude") ? root.path("Longitude").asDouble() : (ps.getLongitude() != null ? ps.getLongitude() : 0.0);
                        String body = root.path("Body").asText(ps.getBodyName());
                        String starSystem = root.path("StarSystem").asText(ps.getCurrentSystem());
                        if (!rawDest.isBlank() && !body.isBlank()) {
                            surfaceFeatureService.recordKnownPointOfInterest(rawDest, locDest, body, lat, lon, starSystem);
                            surfaceFeatureService.syncPlanetaryStatusSignals(ps, starSystem, body);
                        }
                    }
                    if (isLiveUpdate) {
                        sseNotificationService.broadcastEvent("surface_status", ps);
                    }
                }
                case "CodexEntry" -> {
                    if (root.has("Latitude") && root.has("Longitude")) {
                        double lat = root.path("Latitude").asDouble();
                        double lon = root.path("Longitude").asDouble();
                        String body = root.path("BodyName").asText(root.path("Body").asText(""));
                        String starSystem = root.path("System").asText(status.getCurrentSystem());
                        String name = root.path("Name_Localised").asText(root.path("Name").asText(""));
                        if (!name.isBlank() && !body.isBlank()) {
                            surfaceFeatureService.recordKnownPointOfInterest(name, name, body, lat, lon, starSystem);
                            PlanetaryStatusDTO ps = planetaryStatusRef.get();
                            surfaceFeatureService.syncPlanetaryStatusSignals(ps, starSystem, body);
                            if (isLiveUpdate) {
                                sseNotificationService.broadcastEvent("surface_status", ps);
                            }
                        }
                    }
                }
                case "ScanOrganic" -> {
                    long systemAddress = root.path("SystemAddress").asLong(0L);
                    int bodyId = root.path("Body").asInt(-1);
                    String scanType = root.path("ScanType").asText("");
                    String genus = root.path("Genus_Localised").asText(root.path("Genus").asText(""));
                    String species = root.path("Species_Localised").asText(root.path("Species").asText(""));
                    String variant = root.path("Variant_Localised").asText(root.path("Variant").asText(""));
                    planetHistoryService.recordOrganicScan(status.getCurrentSystem(), systemAddress > 0 ? systemAddress : null, bodyId >= 0 ? bodyId : null, scanType, genus, species, variant, timestamp);

                    PlanetaryStatusDTO ps = planetaryStatusRef.get();
                    String lowerScan = scanType.toLowerCase();
                    int sampleNum = switch (lowerScan) {
                        case "log" -> 1;
                        case "sample" -> Math.min(3, ps.getActiveBioSamples().size() + 1);
                        case "analyse" -> 3;
                        default -> Math.min(3, ps.getActiveBioSamples().size() + 1);
                    };
                    double lat = ps.getLatitude() != null ? ps.getLatitude() : 0.0;
                    double lon = ps.getLongitude() != null ? ps.getLongitude() : 0.0;
                    double minColony = BioSampleDTO.getOfficialColonyDistance(genus);
                    long baseVal = BioSampleDTO.getOfficialBaseValue(species, genus);

                    BioSampleDTO sample = new BioSampleDTO(sampleNum, scanType, genus, species, variant, lat, lon, System.currentTimeMillis(), baseVal, minColony);
                    if (sampleNum == 1) {
                        ps.getActiveBioSamples().clear();
                        ps.getActiveBioSamples().add(sample);
                    } else if ("analyse".equals(lowerScan) && ps.getActiveBioSamples().size() >= 3) {
                        // O jogo emite Sample + Analyse na 3ª planta; atualiza o 3º slot em vez de criar um 4º registro
                        ps.getActiveBioSamples().set(2, sample);
                    } else if (ps.getActiveBioSamples().size() < 3) {
                        ps.getActiveBioSamples().add(sample);
                    } else {
                        ps.getActiveBioSamples().set(2, sample);
                    }
                    ps.setLastBioSample(sample);
                    ps.setDistanceToLastBioSample(0.0);
                    ps.setGeneticDiversityReached(false);
                    activeBioBodyName = ps.getBodyName() != null ? ps.getBodyName() : "";
            // Carregar e atualizar distância para elementos de solo conhecidos do planeta
            if (!ps.getBodyName().isBlank()) {
                surfaceFeatureService.syncPlanetaryStatusSignals(ps, ps.getCurrentSystem(), ps.getBodyName());
                updateSurfaceFeatureDistances(ps);
            }

            ps.setLastUpdateTimestamp(System.currentTimeMillis());
                    if (isLiveUpdate) {
                        sseNotificationService.broadcastEvent("surface_status", ps);
                    }
                    log.info("Bio-amostra registrada do Journal: #{} ({}) - {} em lat={}, lon={}", sampleNum, scanType, species, lat, lon);
                }
            }
        } catch (Exception e) {
            log.debug("Linha do journal ignorada ({}): {}", e.getMessage(), line);
        }
    }

    private void updateCoordinatesIfPresent(JsonNode root, PlayerStatus status) {
        JsonNode starPos = root.path("StarPos");
        if (starPos.isArray() && starPos.size() >= 3) {
            double x = starPos.get(0).asDouble();
            double y = starPos.get(1).asDouble();
            double z = starPos.get(2).asDouble();
            status.setCoordinates(x, y, z);
            String starClass = root.path("StarClass").asText("");
            if (!starClass.isBlank()) {
                status.setStarClass(starClass);
            }
            log.info("Coordenadas atualizadas do jogador: [{}, {}, {}], StarClass: {}", x, y, z, starClass);
        }
    }

    private void updateSystemIfChanged(String newSystem, PlayerStatus status) {
        if (newSystem != null && !newSystem.isBlank()) {
            String oldSystem = status.getCurrentSystem();
            if (!newSystem.equalsIgnoreCase(oldSystem)) {
                log.info("Mudança de sistema detectada! {} -> {}", oldSystem, newSystem);
                status.setCurrentSystem(newSystem);
                status.setSystemChangeTimestamp(System.currentTimeMillis());
                if (status.getPosX() != null && status.getPosY() != null && status.getPosZ() != null) {
                    galaxyExplorationService.registerDiscoveredSystem(
                            newSystem,
                            status.getPosX(),
                            status.getPosY(),
                            status.getPosZ(),
                            status.getStarClass()
                    );
                }
                // Disparo de evento SSE em tempo real para os navegadores conectados
                Map<String, Object> jumpData = new LinkedHashMap<>();
                jumpData.put("system", newSystem);
                jumpData.put("oldSystem", oldSystem);
                jumpData.put("x", status.getPosX());
                jumpData.put("y", status.getPosY());
                jumpData.put("z", status.getPosZ());
                jumpData.put("timestamp", System.currentTimeMillis());
                sseNotificationService.broadcastEvent("system_jump", jumpData);
            }
        }
    }

    private void pollNavRouteUpdates() {
        if (journalDir == null || !Files.exists(journalDir)) return;
        File navRouteFile = new File(journalDir.toFile(), "NavRoute.json");
        if (!navRouteFile.exists()) return;

        long modified = navRouteFile.lastModified();
        if (modified <= lastNavRouteModified) return;
        lastNavRouteModified = modified;

        try {
            String json = Files.readString(navRouteFile.toPath(), StandardCharsets.UTF_8);
            JsonNode root = objectMapper.readTree(json);
            String event = root.path("event").asText("");

            if ("NavRouteClear".equalsIgnoreCase(event)) {
                activeRouteRef.set(new ArrayList<>());
                playerStatusRef.get().setNavRouteTimestamp(System.currentTimeMillis());
                log.info("Rota ativa limpa (NavRouteClear)");
                return;
            }

            JsonNode routeArray = root.path("Route");
            if (routeArray.isArray()) {
                List<RoutePointDTO> points = new ArrayList<>();
                for (JsonNode item : routeArray) {
                    String system = item.path("StarSystem").asText("");
                    String starClass = item.path("StarClass").asText("");
                    JsonNode pos = item.path("StarPos");
                    if (pos.isArray() && pos.size() >= 3) {
                        points.add(new RoutePointDTO(
                                system,
                                pos.get(0).asDouble(),
                                pos.get(1).asDouble(),
                                pos.get(2).asDouble(),
                                starClass
                        ));
                    }
                }
                activeRouteRef.set(points);
                playerStatusRef.get().setNavRouteTimestamp(System.currentTimeMillis());
                log.info("Rota de navegação atualizada do NavRoute.json com {} waypoints!", points.size());
            }
        } catch (Exception e) {
            log.warn("Erro ao ler NavRoute.json: {}", e.getMessage());
        }
    }

    public List<RoutePointDTO> getActiveRoute() {
        return activeRouteRef.get();
    }

    public PlayerStatus getPlayerStatus() {
        return playerStatusRef.get();
    }

    public synchronized void simulateJump(String starSystem, Integer cargoCapacity) {
        simulateJump(starSystem, cargoCapacity, null, null, null);
    }

    public synchronized void simulateJump(String starSystem, Integer cargoCapacity, Double x, Double y, Double z) {
        PlayerStatus status = playerStatusRef.get();
        if (starSystem != null && !starSystem.isBlank()) {
            status.setCurrentSystem(starSystem);
            status.setSystemChangeTimestamp(System.currentTimeMillis());
        }
        if (cargoCapacity != null && cargoCapacity > 0) {
            status.setCargoCapacity(cargoCapacity);
        }
        if (x != null && y != null && z != null) {
            status.setCoordinates(x, y, z);
        }
        if (status.getCurrentSystem() != null && status.getPosX() != null) {
            galaxyExplorationService.registerDiscoveredSystem(
                    status.getCurrentSystem(),
                    status.getPosX(),
                    status.getPosY(),
                    status.getPosZ(),
                    status.getStarClass()
            );
        }

        // Inicializa o estado planetário como desligado/no espaço a menos que haja telemetria real de solo
        PlanetaryStatusDTO ps = planetaryStatusRef.get();
        ps.setCurrentSystem(status.getCurrentSystem());
        if (status.isDocked()) {
            ps.setOnPlanetSurface(false);
            ps.setInPlanetaryOrbit(false);
            ps.setLanded(false);
            ps.setGlideMode(false);
        }
        pollStatusJson();
        log.info("Salto simulado manualmente para sistema: {}, Coords: [{}, {}, {}], Carga: {}",
                status.getCurrentSystem(), status.getPosX(), status.getPosY(), status.getPosZ(), status.getCargoCapacity());
    }

    private void clearPlanetaryTelemetry(PlanetaryStatusDTO ps) {
        if (ps == null) return;
        ps.setOnPlanetSurface(false);
        ps.setInPlanetaryOrbit(false);
        ps.setLanded(false);
        ps.setGlideMode(false);
        ps.setInSrv(false);
        ps.setOnFoot(false);
        ps.setBodyName("");
        ps.setBodyId(null);
        ps.setSurfaceGravity(null);
        ps.setAtmosphereType("");
        ps.setPlanetRadius(null);
        ps.setLatitude(null);
        ps.setLongitude(null);
        ps.setAltitude(null);
        ps.setHeading(null);
        ps.setTouchdownLat(null);
        ps.setTouchdownLong(null);
        ps.setDistanceToTouchdown(null);
        if (isBioCollectionCompleted(ps)) {
            clearBioTelemetry(ps);
        }
    }

    private boolean isBioCollectionCompleted(PlanetaryStatusDTO ps) {
        if (ps == null) return false;
        if (ps.getActiveBioSamples().size() >= 3) return true;
        BioSampleDTO last = ps.getLastBioSample();
        return last != null && "analyse".equalsIgnoreCase(last.getScanType());
    }

    private void clearBioTelemetry(PlanetaryStatusDTO ps) {
        if (ps == null) return;
        ps.getActiveBioSamples().clear();
        ps.setLastBioSample(null);
        ps.setDistanceToLastBioSample(null);
        ps.setGeneticDiversityReached(false);
        activeBioBodyName = "";
    }

    private void enrichPlanetaryBodyInfo(PlanetaryStatusDTO ps) {
        if (ps == null || ps.getBodyName() == null || ps.getBodyName().isBlank()) return;
        com.eliteexplorer.dto.CelestialBodyDTO body = systemBodiesService.findBody(ps.getCurrentSystem(), ps.getBodyName());
        if (body == null) return;

        if ((ps.getSurfaceGravity() == null || ps.getSurfaceGravity() <= 0) && body.getGravity() != null && body.getGravity() > 0) {
            ps.setSurfaceGravity(body.getGravity());
        }
        if ((ps.getPlanetRadius() == null || ps.getPlanetRadius() <= 0) && body.getRadius() != null && body.getRadius() > 0) {
            ps.setPlanetRadius(body.getRadius() * 1000.0);
        }
        if (ps.getAtmosphereType() == null || ps.getAtmosphereType().isBlank()) {
            String atm = body.getAtmosphereType();
            Double press = body.getSurfacePressure();
            if (atm == null || atm.isBlank() || "No atmosphere".equalsIgnoreCase(atm) || "None".equalsIgnoreCase(atm)) {
                ps.setAtmosphereType("Sem atmosfera (0.00 atm)");
            } else if (press != null && press > 0) {
                String pressFormatted = press >= 0.01
                        ? String.format(java.util.Locale.US, "%.2f atm", press)
                        : String.format(java.util.Locale.US, "%.4f atm", press);
                ps.setAtmosphereType(atm + " (" + pressFormatted + ")");
            } else {
                ps.setAtmosphereType(atm);
            }
        }
    }

    private boolean isOrbitalStation(String stationType) {
        if (stationType == null || stationType.isBlank()) return true;
        String st = stationType.toLowerCase();
        return !(st.contains("crater") || st.contains("settlement") || st.contains("surface") || st.contains("planet"));
    }

    @Scheduled(fixedDelay = 500)
    public synchronized void pollStatusJson() {
        if (journalDir == null || !Files.exists(journalDir)) return;
        File statusFile = new File(journalDir.toFile(), "Status.json");
        if (!statusFile.exists()) return;

        long modified = statusFile.lastModified();
        if (modified <= lastStatusModified) return;
        lastStatusModified = modified;

        try {
            String json = Files.readString(statusFile.toPath(), StandardCharsets.UTF_8);
            if (json == null || json.isBlank()) return;
            JsonNode root = objectMapper.readTree(json);
            PlanetaryStatusDTO ps = planetaryStatusRef.get();
            ps.setCurrentSystem(playerStatusRef.get().getCurrentSystem());

            long flags = root.path("Flags").asLong(0L);
            long flags2 = root.path("Flags2").asLong(0L);

            // Bitmasks oficiais de Status.json do Elite Dangerous:
            // Flags bit 0: Docked (1L)
            // Flags bit 1: Landed (em solo planetário) (2L)
            // Flags bit 21: Has Lat/Long (1L << 21) = 0x00200000L
            // Flags bit 26: In SRV (1L << 26) = 0x04000000L
            // Flags2 bit 4: On Foot on Planet (1L << 4) = 0x10L
            // Flags2 bit 12: Glide Mode (1L << 12) = 0x1000L

            boolean docked = (flags & 1L) != 0L;
            boolean landedOnPlanet = (flags & 2L) != 0L;
            boolean hasLatLong = (flags & (1L << 21)) != 0L && root.has("Latitude") && root.has("Longitude");
            boolean inSrv = (flags & (1L << 26)) != 0L;
            boolean onFootOnPlanet = (flags2 & (1L << 4)) != 0L;
            boolean glideMode = (flags2 & (1L << 12)) != 0L;

            boolean onSurface = landedOnPlanet || inSrv || onFootOnPlanet;
            boolean inOrbit = hasLatLong || glideMode;

            if ((docked && !landedOnPlanet) || (!onSurface && !inOrbit)) {
                // Fora da atmosfera / zona orbital planetária ou atracado em estação orbital
                clearPlanetaryTelemetry(ps);
                if (docked && !landedOnPlanet) {
                    clearBioTelemetry(ps);
                }
            } else {
                ps.setOnPlanetSurface(true);
                ps.setInPlanetaryOrbit(inOrbit);
                ps.setLanded(landedOnPlanet);
                ps.setInSrv(inSrv);
                ps.setOnFoot(onFootOnPlanet);
                ps.setGlideMode(glideMode);
            }

            if ((onSurface || inOrbit) && !(docked && !landedOnPlanet)) {
                if (root.has("Latitude")) {
                    ps.setLatitude(root.path("Latitude").asDouble(0.0));
                }
                if (root.has("Longitude")) {
                    ps.setLongitude(root.path("Longitude").asDouble(0.0));
                }
                if (root.has("Altitude")) {
                    ps.setAltitude(root.path("Altitude").asDouble(0.0));
                }
                if (root.has("Heading")) {
                    ps.setHeading(root.path("Heading").asDouble(0.0));
                }
                if (root.has("PlanetRadius")) {
                    double pr = root.path("PlanetRadius").asDouble(0.0);
                    if (pr > 0) ps.setPlanetRadius(pr);
                }
                if (root.has("Gravity")) {
                    double g = root.path("Gravity").asDouble(0.0);
                    if (g > 0) ps.setSurfaceGravity(g);
                }
                if (root.has("BodyName")) {
                    String bName = root.path("BodyName").asText("");
                    if (!bName.isBlank()) {
                        if (!bName.equalsIgnoreCase(ps.getBodyName())) {
                            ps.setSurfaceGravity(null);
                            ps.setAtmosphereType("");
                        }
                        if (!activeBioBodyName.isBlank() && !bName.equalsIgnoreCase(activeBioBodyName)) {
                            clearBioTelemetry(ps);
                        }
                        ps.setBodyName(bName);
                    }
                }
                enrichPlanetaryBodyInfo(ps);
            }

            // Distância até o ponto de pouso / nave estacionada
            if (!landedOnPlanet) {
                disembarkedCalibrated = false;
            } else if (!inSrv && !onFootOnPlanet) {
                // Comandante a bordo da nave pousada: a nave pousada está exatamente na posição da nave e distância é 0
                ps.setTouchdownLat(ps.getLatitude());
                ps.setTouchdownLong(ps.getLongitude());
                ps.setDistanceToTouchdown(0.0);
                disembarkedCalibrated = false;
            } else {
                // Comandante fora da nave (a pé ou em SRV)
                if (!disembarkedCalibrated) {
                    // Primeiro ciclo fora da nave: calibra a posição exata da nave no solo onde o piloto desembarcou
                    ps.setTouchdownLat(ps.getLatitude());
                    ps.setTouchdownLong(ps.getLongitude());
                    ps.setDistanceToTouchdown(0.0);
                    disembarkedCalibrated = true;
                } else if (ps.getTouchdownLat() != null && ps.getTouchdownLong() != null && ps.getLatitude() != null && ps.getLongitude() != null) {
                    double radius = (ps.getPlanetRadius() != null && ps.getPlanetRadius() > 0) ? ps.getPlanetRadius() : 2100000.0;
                    ps.setDistanceToTouchdown(calculateSurfaceDistanceMeters(
                            ps.getLatitude(), ps.getLongitude(), ps.getTouchdownLat(), ps.getTouchdownLong(), radius
                    ));
                }
            }

            // Distância até a última bio-amostra escaneada (para aferição de diversidade genética)
            if (ps.getLastBioSample() != null && ps.getLatitude() != null && ps.getLongitude() != null) {
                double radius = (ps.getPlanetRadius() != null && ps.getPlanetRadius() > 0) ? ps.getPlanetRadius() : 2100000.0;
                double distToBio = calculateSurfaceDistanceMeters(
                        ps.getLatitude(), ps.getLongitude(), ps.getLastBioSample().getLatitude(), ps.getLastBioSample().getLongitude(), radius
                );
                ps.setDistanceToLastBioSample(distToBio);
                ps.setGeneticDiversityReached(distToBio >= ps.getLastBioSample().getMinColonyDistance());
            }

            // Carregar e atualizar distância para elementos de solo conhecidos do planeta
            if (!ps.getBodyName().isBlank()) {
                surfaceFeatureService.syncPlanetaryStatusSignals(ps, ps.getCurrentSystem(), ps.getBodyName());
                updateSurfaceFeatureDistances(ps);
            }

            ps.setLastUpdateTimestamp(System.currentTimeMillis());
            sseNotificationService.broadcastEvent("surface_status", ps);
        } catch (Exception e) {
            log.warn("Falha ao processar Status.json: {}", e.getMessage());
        }
    }

    public PlanetaryStatusDTO getPlanetaryStatus() {
        return planetaryStatusRef.get();
    }

    private void updateSurfaceFeatureDistances(PlanetaryStatusDTO ps) {
        if (ps == null || ps.getSurfaceFeatures() == null) return;
        Double pLat = ps.getLatitude();
        Double pLon = ps.getLongitude();
        double radius = (ps.getPlanetRadius() != null && ps.getPlanetRadius() > 0) ? ps.getPlanetRadius() : 2100000.0;

        for (SurfaceFeatureDTO sf : ps.getSurfaceFeatures()) {
            if (!sf.isGpsConfirmed() || sf.getLatitude() == null || sf.getLongitude() == null || pLat == null || pLon == null) {
                sf.setDistanceMeters(null);
                continue;
            }
            sf.setDistanceMeters(calculateSurfaceDistanceMeters(pLat, pLon, sf.getLatitude(), sf.getLongitude(), radius));
        }
    }

    private double calculateSurfaceDistanceMeters(double lat1, double lon1, double lat2, double lon2, double radiusMeters) {
        double dLat = Math.toRadians(lat1 - lat2);
        double dLon = Math.toRadians(lon1 - lon2);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat2)) * Math.cos(Math.toRadians(lat1)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return radiusMeters * c;
    }
}
