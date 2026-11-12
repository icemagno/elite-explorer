package com.cmdrscan.controller;

import com.cmdrscan.service.CmdrScanService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class HeatmapApiController {

    private final CmdrScanService cmdrScanService;

    public HeatmapApiController(CmdrScanService cmdrScanService) {
        this.cmdrScanService = cmdrScanService;
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
