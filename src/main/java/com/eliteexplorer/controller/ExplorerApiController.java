package com.eliteexplorer.controller;

import com.eliteexplorer.dto.GalaxyCubeResponse;
import com.eliteexplorer.dto.PlanetaryStatusDTO;
import com.eliteexplorer.dto.StationDTO;
import com.eliteexplorer.dto.StratumCandidateDTO;
import com.eliteexplorer.model.PlayerStatus;
import com.eliteexplorer.service.GalaxyExplorationService;
import com.eliteexplorer.service.JournalWatcherService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ExplorerApiController {

    private final JournalWatcherService journalWatcherService;
    private final GalaxyExplorationService galaxyExplorationService;
    private final com.eliteexplorer.service.EdsmSyncService edsmSyncService;
    private final com.eliteexplorer.service.EddnTrafficListenerService eddnTrafficService;
    private final com.eliteexplorer.service.PlanetExplorationHistoryService planetHistoryService;
    private final com.eliteexplorer.service.SystemBodiesService systemBodiesService;
    private final com.eliteexplorer.service.SseNotificationService sseNotificationService;
    private final com.eliteexplorer.service.CmdrScanService cmdrScanService;

    @Value("${edsm.commander.name:}")
    private String configuredCommanderName;

    @Value("${spring.application.name:elite-explorer}")
    private String applicationName;

    public ExplorerApiController(JournalWatcherService journalWatcherService,
                                 GalaxyExplorationService galaxyExplorationService,
                                 com.eliteexplorer.service.EdsmSyncService edsmSyncService,
                                 com.eliteexplorer.service.EddnTrafficListenerService eddnTrafficService,
                                 com.eliteexplorer.service.PlanetExplorationHistoryService planetHistoryService,
                                 com.eliteexplorer.service.SystemBodiesService systemBodiesService,
                                 com.eliteexplorer.service.SseNotificationService sseNotificationService,
                                 com.eliteexplorer.service.CmdrScanService cmdrScanService) {
        this.journalWatcherService = journalWatcherService;
        this.galaxyExplorationService = galaxyExplorationService;
        this.edsmSyncService = edsmSyncService;
        this.eddnTrafficService = eddnTrafficService;
        this.planetHistoryService = planetHistoryService;
        this.systemBodiesService = systemBodiesService;
        this.sseNotificationService = sseNotificationService;
        this.cmdrScanService = cmdrScanService;
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

    // Telemetria e status do EDSM
    @GetMapping("/edsm/status")
    public ResponseEntity<Map<String, Object>> getEdsmStatus() {
        return ResponseEntity.ok(edsmSyncService.getStatus());
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

    @GetMapping("/galaxy/traffic/online-count")
    public ResponseEntity<Map<String, Object>> getOnlineCommandersCount() {
        return ResponseEntity.ok(Map.of("count", eddnTrafficService.countActiveCommandersInCube()));
    }

    // Tráfego Global 3D / Heatmap 3D (Posições Reais x,y,z e Fluxos Galácticos do CmdrScan)
    @GetMapping("/galaxy/traffic/global-3d")
    public ResponseEntity<Map<String, Object>> getGlobalTraffic3D() {
        return ResponseEntity.ok(cmdrScanService.getGlobalTraffic3D());
    }

    // Telemetria de Superfície e Pouso Planetário em Tempo Real
    @GetMapping("/player/surface-status")
    public ResponseEntity<PlanetaryStatusDTO> getPlanetaryStatus() {
        return ResponseEntity.ok(journalWatcherService.getPlanetaryStatus());
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
