package com.eliteexplorer.controller;

import com.eliteexplorer.dto.CopilotSearchResult;
import com.eliteexplorer.dto.GalaxyCubeResponse;
import com.eliteexplorer.dto.PlanetaryStatusDTO;
import com.eliteexplorer.dto.RoutePointDTO;
import com.eliteexplorer.dto.StationDTO;
import com.eliteexplorer.dto.StratumCandidateDTO;
import com.eliteexplorer.dto.TradeSearchRequest;
import com.eliteexplorer.dto.TradeSearchResult;
import com.eliteexplorer.model.PlayerStatus;
import com.eliteexplorer.service.CopilotTradeService;
import com.eliteexplorer.service.GalaxyExplorationService;
import com.eliteexplorer.service.InaraClientService;
import com.eliteexplorer.service.JournalWatcherService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TradeRouteController {

    private final InaraClientService inaraClientService;
    private final JournalWatcherService journalWatcherService;
    private final CopilotTradeService copilotTradeService;
    private final GalaxyExplorationService galaxyExplorationService;
    private final com.eliteexplorer.service.EdsmSyncService edsmSyncService;
    private final com.eliteexplorer.service.EddnTrafficListenerService eddnTrafficService;
    private final com.eliteexplorer.service.PlanetExplorationHistoryService planetHistoryService;
    private final com.eliteexplorer.service.SystemBodiesService systemBodiesService;
    private final com.eliteexplorer.service.EddnPublisherService eddnPublisherService;
    private final com.eliteexplorer.service.SseNotificationService sseNotificationService;

    @Value("${edsm.commander.name:}")
    private String configuredCommanderName;

    @Value("${spring.application.name:elite-explorer}")
    private String applicationName;

    public TradeRouteController(InaraClientService inaraClientService,
                                JournalWatcherService journalWatcherService,
                                CopilotTradeService copilotTradeService,
                                GalaxyExplorationService galaxyExplorationService,
                                com.eliteexplorer.service.EdsmSyncService edsmSyncService,
                                com.eliteexplorer.service.EddnTrafficListenerService eddnTrafficService,
                                com.eliteexplorer.service.PlanetExplorationHistoryService planetHistoryService,
                                com.eliteexplorer.service.SystemBodiesService systemBodiesService,
                                com.eliteexplorer.service.EddnPublisherService eddnPublisherService,
                                com.eliteexplorer.service.SseNotificationService sseNotificationService) {
        this.inaraClientService = inaraClientService;
        this.journalWatcherService = journalWatcherService;
        this.copilotTradeService = copilotTradeService;
        this.galaxyExplorationService = galaxyExplorationService;
        this.edsmSyncService = edsmSyncService;
        this.eddnTrafficService = eddnTrafficService;
        this.planetHistoryService = planetHistoryService;
        this.systemBodiesService = systemBodiesService;
        this.eddnPublisherService = eddnPublisherService;
        this.sseNotificationService = sseNotificationService;
    }

    // Original trade routes endpoint (Loops)
    @GetMapping("/routes")
    public ResponseEntity<TradeSearchResult> getTradeRoutes(
            @RequestParam(defaultValue = "Col 285 Sector EG-D a42-1") String system,
            @RequestParam(defaultValue = "36") Integer cargoCapacity,
            @RequestParam(defaultValue = "80") Integer maxDistance,
            @RequestParam(defaultValue = "72") Integer maxAgeHours,
            @RequestParam(defaultValue = "1") Integer padSize
    ) {
        TradeSearchRequest request = new TradeSearchRequest();
        request.setSystem(system);
        request.setCargoCapacity(cargoCapacity);
        request.setMaxDistance(maxDistance);
        request.setMaxAgeHours(maxAgeHours);
        request.setPadSize(padSize);

        TradeSearchResult result = inaraClientService.fetchTradeRoutes(request);
        return ResponseEntity.ok(result);
    }

    // Identidade do aplicativo e nome do comandante configurado
    @GetMapping("/app/identity")
    public ResponseEntity<Map<String, String>> getAppIdentity() {
        String cmdr = (configuredCommanderName != null && !configuredCommanderName.isBlank())
                ? configuredCommanderName.trim()
                : journalWatcherService.getPlayerStatus().getCommander();
        if (cmdr == null || cmdr.isBlank() || "Desconhecido".equalsIgnoreCase(cmdr)) {
            cmdr = "COMANDANTE";
        }
        return ResponseEntity.ok(Map.of(
                "appName", "ELITE EXPLORER COPILOT",
                "appId", applicationName,
                "commanderName", cmdr
        ));
    }

    // Player Status from Elite Dangerous Journal
    @GetMapping("/player/status")
    public ResponseEntity<PlayerStatus> getPlayerStatus() {
        return ResponseEntity.ok(journalWatcherService.getPlayerStatus());
    }

    // Simulate jump (useful for testing or manual override)
    @PostMapping("/player/simulate")
    public ResponseEntity<PlayerStatus> simulatePlayerJump(
            @RequestParam String system,
            @RequestParam(required = false) Integer cargoCapacity,
            @RequestParam(required = false) Double x,
            @RequestParam(required = false) Double y,
            @RequestParam(required = false) Double z
    ) {
        journalWatcherService.simulateJump(system, cargoCapacity, x, y, z);
        return ResponseEntity.ok(journalWatcherService.getPlayerStatus());
    }

    // 3D Galaxy Cube with Void detection
    @GetMapping("/galaxy/cube")
    public ResponseEntity<GalaxyCubeResponse> getGalaxyCube(
            @RequestParam(required = false) String system,
            @RequestParam(required = false) Double x,
            @RequestParam(required = false) Double y,
            @RequestParam(required = false) Double z,
            @RequestParam(defaultValue = "100") Double size,
            @RequestParam(defaultValue = "15") Double voxelSize
    ) {
        PlayerStatus status = journalWatcherService.getPlayerStatus();
        double queryX = (x != null) ? x : (status.getPosX() != null ? status.getPosX() : 0.0);
        double queryY = (y != null) ? y : (status.getPosY() != null ? status.getPosY() : 0.0);
        double queryZ = (z != null) ? z : (status.getPosZ() != null ? status.getPosZ() : 0.0);
        String name = (system != null && !system.isBlank()) ? system : status.getCurrentSystem();

        GalaxyCubeResponse result = galaxyExplorationService.analyzeCube(name, queryX, queryY, queryZ, size, voxelSize, journalWatcherService.getActiveRoute());
        result.setActiveRoute(journalWatcherService.getActiveRoute());
        return ResponseEntity.ok(result);
    }

    // Consulta de candidatos a Stratum Tectonicas conhecidos (atualizados de forma incremental pelo background scanner)
    @GetMapping("/galaxy/stratum/candidates")
    public ResponseEntity<Map<String, List<StratumCandidateDTO>>> getStratumCandidates() {
        return ResponseEntity.ok(galaxyExplorationService.getAllKnownStratumCandidates());
    }

    // Consulta do histórico local de planetas pousados e coletas biológicas realizadas pelo Comandante
    @GetMapping("/galaxy/planets/history")
    public ResponseEntity<List<com.eliteexplorer.dto.VisitedPlanetRecordDTO>> getPlanetHistory() {
        return ResponseEntity.ok(planetHistoryService.getAllHistory());
    }

    // Consulta de estações espaciais e portos do sistema atual para ancoragem segura
    @GetMapping("/galaxy/stations")
    public ResponseEntity<List<StationDTO>> getSystemStations(@RequestParam(required = false) String system) {
        if (system == null || system.isBlank()) {
            system = journalWatcherService.getPlayerStatus().getCurrentSystem();
        }
        return ResponseEntity.ok(galaxyExplorationService.getSystemStations(system));
    }

    // Outbound trade opportunities for current player system
    @GetMapping("/copilot/trades")
    public ResponseEntity<CopilotSearchResult> getCopilotTrades(
            @RequestParam(required = false) String system,
            @RequestParam(required = false) Integer cargoCapacity,
            @RequestParam(defaultValue = "80") Integer maxDistance,
            @RequestParam(defaultValue = "72") Integer maxAgeHours,
            @RequestParam(defaultValue = "1") Integer padSize,
            @RequestParam(defaultValue = "profit") String sortBy
    ) {
        CopilotSearchResult result = copilotTradeService.getOutboundTrades(
                system, cargoCapacity, maxDistance, maxAgeHours, padSize, sortBy
        );
        return ResponseEntity.ok(result);
    }

    // Telemetria e status do EDSM
    @GetMapping("/edsm/status")
    public ResponseEntity<Map<String, Object>> getEdsmStatus() {
        return ResponseEntity.ok(edsmSyncService.getStatus());
    }

    // Status do publicador de dados para a rede EDDN
    @GetMapping("/eddn/publish-status")
    public ResponseEntity<Map<String, Object>> getEddnPublishStatus() {
        return ResponseEntity.ok(eddnPublisherService.getStatus());
    }

    // Stream SSE de eventos reativos em tempo real para o frontend
    @GetMapping(value = "/events/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter streamEvents() {
        return sseNotificationService.subscribe();
    }

    // Monitoramento de tráfego de Comandantes ao vivo (EDDN + Local)
    @GetMapping("/galaxy/traffic/recent")
    public ResponseEntity<List<com.eliteexplorer.dto.TrafficEventDTO>> getRecentTraffic(
            @RequestParam(defaultValue = "0") long since
    ) {
        return ResponseEntity.ok(eddnTrafficService.getRecentEvents(since));
    }

    // Telemetria de Superfície e Pouso Planetário em Tempo Real
    @GetMapping("/player/surface-status")
    public ResponseEntity<PlanetaryStatusDTO> getPlanetaryStatus() {
        return ResponseEntity.ok(journalWatcherService.getPlanetaryStatus());
    }

    // Simulação de telemetria planetária para testes visuais do HUD 2.5D
    @PostMapping("/player/simulate-surface")
    public ResponseEntity<PlanetaryStatusDTO> simulateSurface(
            @RequestParam(defaultValue = "Synuefe OF-L d9-72 3 a") String body,
            @RequestParam(defaultValue = "-14.2854") Double lat,
            @RequestParam(defaultValue = "102.4419") Double lon,
            @RequestParam(defaultValue = "120.0") Double alt,
            @RequestParam(defaultValue = "184.0") Double heading,
            @RequestParam(defaultValue = "0.38") Double gravity,
            @RequestParam(defaultValue = "Fina de Dióxido de Carbono") String atm,
            @RequestParam(defaultValue = "false") Boolean landed
    ) {
        return ResponseEntity.ok(journalWatcherService.simulatePlanetaryStatus(body, lat, lon, alt, heading, gravity, atm, landed));
    }

    // Simulação de escaneamento de amostra biológica para testes visuais de exobiologia
    @PostMapping("/player/simulate-bioscan")
    public ResponseEntity<PlanetaryStatusDTO> simulateBioScan(
            @RequestParam(required = false) Integer sampleNumber,
            @RequestParam(required = false) String scanType,
            @RequestParam(defaultValue = "Stratum") String genus,
            @RequestParam(defaultValue = "Stratum Tectonicas") String species,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon
    ) {
        return ResponseEntity.ok(journalWatcherService.simulateBioScan(sampleNumber, scanType, genus, species, lat, lon));
    }

    // Limpar bio-amostras ativas
    @PostMapping("/player/clear-biosamples")
    public ResponseEntity<PlanetaryStatusDTO> clearBioSamples() {
        return ResponseEntity.ok(journalWatcherService.clearBioSamples());
    }

    // Marcar manualmente um sinal/POI de superfície nas coordenadas GPS atuais da nave
    @PostMapping("/player/pin-feature")
    public ResponseEntity<PlanetaryStatusDTO> pinSurfaceFeature(
            @RequestParam(required = false) String id,
            @RequestParam(required = false) String name
    ) {
        return ResponseEntity.ok(journalWatcherService.pinSurfaceFeature(id, name));
    }

    // Mapa 3D do Sistema Estelar (Orrery 3D - Estrelas, Planetas e Luas)
    @GetMapping("/system/orrery")
    public ResponseEntity<com.eliteexplorer.dto.SystemOrreryDTO> getSystemOrrery(
            @RequestParam(required = false) String system
    ) {
        PlayerStatus status = journalWatcherService.getPlayerStatus();
        String sysName = (system != null && !system.isBlank()) ? system : status.getCurrentSystem();
        Double x = status.getPosX();
        Double y = status.getPosY();
        Double z = status.getPosZ();
        return ResponseEntity.ok(systemBodiesService.getSystemOrrery(sysName, x, y, z));
    }
}
