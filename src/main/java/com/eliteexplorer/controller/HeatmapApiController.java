package com.eliteexplorer.controller;

import com.eliteexplorer.service.CmdrScanService;
import com.eliteexplorer.service.EddnPublisherService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class HeatmapApiController {

    private final CmdrScanService cmdrScanService;
    private final EddnPublisherService eddnPublisherService;

    public HeatmapApiController(CmdrScanService cmdrScanService, EddnPublisherService eddnPublisherService) {
        this.cmdrScanService = cmdrScanService;
        this.eddnPublisherService = eddnPublisherService;
    }

    @GetMapping("/my-anon-id")
    public ResponseEntity<Map<String, String>> getMyAnonId() {
        String fullId = eddnPublisherService.getUploaderId();
        String shortId = eddnPublisherService.getShortUploaderId();
        String cmdr = eddnPublisherService.getCommanderName();
        if (cmdr == null || cmdr.isBlank()) cmdr = "CMDR";
        return ResponseEntity.ok(Map.of(
                "commanderName", cmdr,
                "fullId", fullId != null ? fullId : "",
                "shortId", shortId != null ? shortId : "UNKNOWN"
        ));
    }

    @GetMapping("/search-friend")
    public ResponseEntity<Map<String, Object>> searchFriend(@RequestParam(value = "id", required = true) String id) {
        return ResponseEntity.ok(cmdrScanService.searchCommanderByAnonId(id));
    }

    @GetMapping("/heatmap")
    public ResponseEntity<Map<String, Object>> getHeatmap() {
        return ResponseEntity.ok(cmdrScanService.getHeatmapData());
    }

    @GetMapping("/flow")
    public ResponseEntity<Map<String, Object>> getFlow() {
        return ResponseEntity.ok(cmdrScanService.getFlowData());
    }

    @GetMapping("/scans")
    public ResponseEntity<Map<String, Object>> getScans() {
        return ResponseEntity.ok(cmdrScanService.getScanData());
    }

    @GetMapping("/docking")
    public ResponseEntity<Map<String, Object>> getDocking() {
        return ResponseEntity.ok(cmdrScanService.getDockingData());
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> disc = cmdrScanService.getDiscoveredStats5m();
        Map<String, Integer> dock = cmdrScanService.getDockingSummary();
        Map<String, Object> top = cmdrScanService.getTopBusiest();

        Map<String, Object> res = new java.util.LinkedHashMap<>();
        res.put("service", "Commander Scan Standalone");
        res.put("status", "ONLINE");
        res.put("signalsPerSec", cmdrScanService.getSignalsPerSecond());
        res.put("totalSignals", cmdrScanService.getTotalSignals());
        res.put("activeCommanders", cmdrScanService.getActiveCommandersCount());
        res.put("discovered5m", disc.get("buckets"));
        res.put("totalDiscovered5m", disc.get("total5m"));
        res.put("minuteFloor", disc.get("minuteFloor"));
        res.put("dockingPorts", dock.get("ports"));
        res.put("totalDocks", dock.get("totalDocks"));
        res.put("topSystems", top.get("systems"));
        res.put("topStations", top.get("stations"));
        res.put("singleHopTrades", cmdrScanService.getSingleHopTradeRoutes());
        res.put("loopTrades", cmdrScanService.getLoopTradeRoutes());
        res.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.ok(res);
    }
}
