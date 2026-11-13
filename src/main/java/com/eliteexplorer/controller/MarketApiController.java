package com.eliteexplorer.controller;

import com.eliteexplorer.service.CopilotMarketService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class MarketApiController {

    private final CopilotMarketService copilotMarketService;

    public MarketApiController(CopilotMarketService copilotMarketService) {
        this.copilotMarketService = copilotMarketService;
    }

    @GetMapping("/market/top")
    public ResponseEntity<Map<String, Object>> getTopMarketRoutes(
            @RequestParam(value = "cargo", required = false) Integer cargo) {
        return ResponseEntity.ok(copilotMarketService.getTop20MarketOpportunities(cargo));
    }
}
