package com.eliteexplorer.dto;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public class TradeSearchResult {
    private boolean success;
    private String errorMessage;
    private String searchSystem;
    private int cargo;
    private int maxDistance;
    private String inaraUrl;
    private int totalRoutes;
    private List<TradeRouteDTO> routes = new ArrayList<>();
    private String fetchedAt;

    public TradeSearchResult() {
        this.fetchedAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
    }

    public static TradeSearchResult success(String searchSystem, int cargo, int maxDistance, String inaraUrl, List<TradeRouteDTO> routes) {
        TradeSearchResult res = new TradeSearchResult();
        res.setSuccess(true);
        res.setSearchSystem(searchSystem);
        res.setCargo(cargo);
        res.setMaxDistance(maxDistance);
        res.setInaraUrl(inaraUrl);
        res.setRoutes(routes != null ? routes : new ArrayList<>());
        res.setTotalRoutes(res.getRoutes().size());
        return res;
    }

    public static TradeSearchResult failure(String errorMessage, String inaraUrl) {
        TradeSearchResult res = new TradeSearchResult();
        res.setSuccess(false);
        res.setErrorMessage(errorMessage);
        res.setInaraUrl(inaraUrl);
        return res;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getSearchSystem() {
        return searchSystem;
    }

    public void setSearchSystem(String searchSystem) {
        this.searchSystem = searchSystem;
    }

    public int getCargo() {
        return cargo;
    }

    public void setCargo(int cargo) {
        this.cargo = cargo;
    }

    public int getMaxDistance() {
        return maxDistance;
    }

    public void setMaxDistance(int maxDistance) {
        this.maxDistance = maxDistance;
    }

    public String getInaraUrl() {
        return inaraUrl;
    }

    public void setInaraUrl(String inaraUrl) {
        this.inaraUrl = inaraUrl;
    }

    public int getTotalRoutes() {
        return totalRoutes;
    }

    public void setTotalRoutes(int totalRoutes) {
        this.totalRoutes = totalRoutes;
    }

    public List<TradeRouteDTO> getRoutes() {
        return routes;
    }

    public void setRoutes(List<TradeRouteDTO> routes) {
        this.routes = routes;
    }

    public String getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(String fetchedAt) {
        this.fetchedAt = fetchedAt;
    }
}
