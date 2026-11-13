package com.eliteexplorer.service;

import com.eliteexplorer.model.PlayerStatus;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
public class CopilotMarketService {

    private static final Logger log = LoggerFactory.getLogger(CopilotMarketService.class);

    private final JournalWatcherService journalWatcherService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private static final String LOCAL_CMDRSCAN_URL = "http://localhost:8081/api/market/top";
    private static final String REMOTE_CMDRSCAN_URL = "http://j1scorpii.com.br:36058/api/market/top";

    public CopilotMarketService(JournalWatcherService journalWatcherService, ObjectMapper objectMapper) {
        this.journalWatcherService = journalWatcherService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
    }

    public Map<String, Object> getTop20MarketOpportunities(Integer customCargo) {
        PlayerStatus status = journalWatcherService.getPlayerStatus();
        int cargo = (customCargo != null && customCargo > 0) ? customCargo : Math.max(1, status.getCargoCapacity());
        String shipType = (status.getShipType() != null && !status.getShipType().isBlank()) ? status.getShipType() : "Nave";

        List<Map<String, Object>> rawRoutes = fetchRawRoutesFromCmdrScan();
        String dataSource = "LOCAL_CMDRSCAN";

        if (rawRoutes == null || rawRoutes.isEmpty()) {
            rawRoutes = fetchRawRoutesFromRemote();
            dataSource = "REMOTE_CMDRSCAN";
        }

        if (rawRoutes == null || rawRoutes.isEmpty()) {
            rawRoutes = getFallbackCuratedRoutes();
            dataSource = "CURATED_GALACTIC_INTEL";
        }

        List<Map<String, Object>> enrichedRoutes = new ArrayList<>();
        int rank = 1;
        for (Map<String, Object> raw : rawRoutes) {
            Map<String, Object> item = new LinkedHashMap<>(raw);
            item.put("rank", rank++);

            int profitDelta = toInt(raw.get("profitDelta"), 0);
            long totalShipProfit = (long) profitDelta * cargo;

            item.put("playerCargo", cargo);
            item.put("playerShip", shipType);
            item.put("playerProfitTotal", totalShipProfit);
            item.put("playerProfitFormatted", formatCreditAmount(totalShipProfit));

            if (!item.containsKey("t9Profit") || item.get("t9Profit") == null) {
                long t9Profit = (long) profitDelta * 720;
                item.put("t9Profit", formatCreditAmount(t9Profit));
            }

            enrichedRoutes.add(item);
            if (enrichedRoutes.size() >= 20) break;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commander", status.getCommander());
        result.put("shipType", shipType);
        result.put("cargoCapacity", cargo);
        result.put("journalCargo", status.getCargoCapacity());
        result.put("currentSystem", status.getCurrentSystem());
        result.put("currentStation", status.getCurrentStation());
        result.put("isDocked", status.isDocked());
        result.put("source", dataSource);
        result.put("totalRoutes", enrichedRoutes.size());
        result.put("routes", enrichedRoutes);
        result.put("timestamp", System.currentTimeMillis());

        return result;
    }

    private List<Map<String, Object>> fetchRawRoutesFromCmdrScan() {
        return fetchFromUrl(LOCAL_CMDRSCAN_URL);
    }

    private List<Map<String, Object>> fetchRawRoutesFromRemote() {
        return fetchFromUrl(REMOTE_CMDRSCAN_URL);
    }

    private List<Map<String, Object>> fetchFromUrl(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200 && response.body() != null && !response.body().isBlank()) {
                List<Map<String, Object>> list = objectMapper.readValue(response.body(), new TypeReference<List<Map<String, Object>>>() {});
                if (list != null && !list.isEmpty()) {
                    return list;
                }
            }
        } catch (Exception e) {
            log.debug("Could not fetch market routes from {}: {}", url, e.getMessage());
        }
        return Collections.emptyList();
    }

    private String formatCreditAmount(long credits) {
        if (credits >= 1_000_000_000L) {
            return String.format(Locale.US, "%.2fB", credits / 1_000_000_000.0);
        } else if (credits >= 1_000_000L) {
            return String.format(Locale.US, "%.1fM", credits / 1_000_000.0);
        } else if (credits >= 1_000L) {
            return String.format(Locale.US, "%.0fK", credits / 1_000.0);
        } else {
            return String.valueOf(credits);
        }
    }

    private int toInt(Object obj, int defaultValue) {
        if (obj == null) return defaultValue;
        if (obj instanceof Number num) return num.intValue();
        try {
            return Integer.parseInt(obj.toString().replaceAll("[^0-9-]", ""));
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private List<Map<String, Object>> getFallbackCuratedRoutes() {
        List<Map<String, Object>> routes = new ArrayList<>();
        routes.add(createRoute("Bromellite", 111385, 17.5, "L",
                "V6W-65W", "Njulngan", 1525, 499,
                "Perets's Genetics", "HIP 13644", 112910, 600, "80.2M"));
        routes.add(createRoute("Alexandrite", 76420, 19.8, "M",
                "Sutter Terminal", "Groombridge 1618", 14500, 1200,
                "Al-Din Prospect", "LHS 3006", 90920, 3100, "55.0M"));
        routes.add(createRoute("Tritium", 62450, 14.2, "L",
                "Cavalieri", "Electra", 51200, 8900,
                "Blackiron Credit Services", "IC 2602 Sector QT-Y b1-7", 113650, 15200, "45.0M"));
        routes.add(createRoute("Gold", 43200, 11.8, "L",
                "Worlidge Hub", "Exphiay", 4850, 18450,
                "Hencke Orbital", "Sorbago", 48050, 32400, "31.1M"));
        routes.add(createRoute("Platinum", 39800, 16.4, "L",
                "Gooch Orbital", "LHS 1197", 52100, 9400,
                "Bowersox Mines", "Wolf 359", 91900, 18500, "28.7M"));
        routes.add(createRoute("Monazite", 38900, 21.1, "L",
                "Bao Terminal", "LP 876-26", 18200, 1500,
                "Vonarburg Enterprise", "Wyrd", 57100, 4200, "28.0M"));
        routes.add(createRoute("Painite", 37500, 13.9, "L",
                "Cartwright Ring", "Beta Hydri", 32400, 3100,
                "McKay Orbital", "Ross 128", 69900, 7800, "27.0M"));
        routes.add(createRoute("Musgravite", 35200, 18.3, "M",
                "Baker Hub", "Aulin", 22100, 2400,
                "Chamberlain Port", "Eranin", 57300, 5600, "25.3M"));
        routes.add(createRoute("Void Opals", 33400, 22.5, "L",
                "Leonard Dock", "Sol", 45000, 1800,
                "Fisher's Rest", "Aldebaran", 78400, 4900, "24.0M"));
        routes.add(createRoute("Grandidierite", 31200, 15.6, "L",
                "Trevithick Dock", "LHS 3447", 19800, 2200,
                "Dalton Gateway", "LHS 3447", 51000, 6100, "22.5M"));
        routes.add(createRoute("Serendibite", 29800, 20.4, "L",
                "Noli Dock", "Wolf 406", 26500, 3400,
                "Patterson Enterprise", "Sirus", 56300, 8200, "21.5M"));
        routes.add(createRoute("Palladium", 27400, 12.3, "L",
                "Burnham Hub", "LHS 3447", 13200, 14200,
                "Euler Port", "Luyten's Star", 40600, 28000, "19.7M"));
        routes.add(createRoute("Low Temperature Diamonds", 26500, 24.1, "L",
                "Gaiman Dock", "49 Arietis", 38200, 2900,
                "Gorbachev Station", "Sol", 64700, 6500, "19.1M"));
        routes.add(createRoute("Bertrandite", 22400, 9.4, "L",
                "Jameson Memorial", "Shinrarta Dezhra", 18200, 26000,
                "Hencke Orbital", "Sorbago", 40600, 48000, "16.1M"));
        routes.add(createRoute("Agronomic Treatment", 21800, 10.7, "L",
                "Liman von Sanders", "Aphra", 3200, 45000,
                "Smoot Station", "Chona", 25000, 89000, "15.7M"));
        routes.add(createRoute("Silver", 19500, 14.8, "L",
                "Oleskiw Platform", "LTT 15574", 4500, 31000,
                "Bessel Gateway", "Kremainn", 24000, 62000, "14.0M"));
        routes.add(createRoute("CMM Composite", 17200, 13.1, "L",
                "Banting Vision", "I Carinae", 5800, 22000,
                "Daedalus", "Sol", 23000, 41000, "12.4M"));
        routes.add(createRoute("Superconductors", 15800, 16.9, "L",
                "Rousseau Orbital", "BD+48 738", 6400, 19000,
                "O'Connor Terminal", "LHS 28", 22200, 38000, "11.4M"));
        routes.add(createRoute("Beryllium", 14300, 11.5, "L",
                "Cleve Hub", "Eravate", 7900, 28000,
                "Ackerman Market", "Eravate", 22200, 52000, "10.3M"));
        routes.add(createRoute("Consumer Technology", 12900, 18.2, "L",
                "Mattingly Port", "Tau Ceti", 6100, 25000,
                "Titan City", "Sol", 19000, 47000, "9.3M"));
        return routes;
    }

    private Map<String, Object> createRoute(String comm, int profit, double dist, String pad,
                                            String buyStation, String buySystem, int buyPrice, int buyStock,
                                            String sellStation, String sellSystem, int sellPrice, int sellDemand,
                                            String t9Profit) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("commodity", comm);
        r.put("profitDelta", profit);
        r.put("distanceLy", dist);
        r.put("pad", pad);
        r.put("buyStation", buyStation);
        r.put("buySystem", buySystem);
        r.put("buyPrice", buyPrice);
        r.put("buyStock", buyStock);
        r.put("sellStation", sellStation);
        r.put("sellSystem", sellSystem);
        r.put("sellPrice", sellPrice);
        r.put("sellDemand", sellDemand);
        r.put("t9Profit", t9Profit);
        return r;
    }
}
