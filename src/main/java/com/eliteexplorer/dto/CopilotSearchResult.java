package com.eliteexplorer.dto;

import com.eliteexplorer.model.PlayerStatus;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public class CopilotSearchResult {
    private boolean success;
    private String errorMessage;
    private PlayerStatus playerStatus;
    private String searchSystem;
    private int cargoCapacity;
    private int totalOutboundTrades;
    private List<OutboundTradeDTO> trades = new ArrayList<>();
    private String inaraUrl;
    private String fetchedAt;

    public CopilotSearchResult() {
        this.fetchedAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
    }

    public static CopilotSearchResult success(PlayerStatus playerStatus, String searchSystem, int cargoCapacity, String inaraUrl, List<OutboundTradeDTO> trades) {
        CopilotSearchResult res = new CopilotSearchResult();
        res.setSuccess(true);
        res.setPlayerStatus(playerStatus);
        res.setSearchSystem(searchSystem);
        res.setCargoCapacity(cargoCapacity);
        res.setInaraUrl(inaraUrl);
        res.setTrades(trades != null ? trades : new ArrayList<>());
        res.setTotalOutboundTrades(res.getTrades().size());
        return res;
    }

    public static CopilotSearchResult failure(String errorMessage, PlayerStatus playerStatus, String searchSystem) {
        CopilotSearchResult res = new CopilotSearchResult();
        res.setSuccess(false);
        res.setErrorMessage(errorMessage);
        res.setPlayerStatus(playerStatus);
        res.setSearchSystem(searchSystem);
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

    public PlayerStatus getPlayerStatus() {
        return playerStatus;
    }

    public void setPlayerStatus(PlayerStatus playerStatus) {
        this.playerStatus = playerStatus;
    }

    public String getSearchSystem() {
        return searchSystem;
    }

    public void setSearchSystem(String searchSystem) {
        this.searchSystem = searchSystem;
    }

    public int getCargoCapacity() {
        return cargoCapacity;
    }

    public void setCargoCapacity(int cargoCapacity) {
        this.cargoCapacity = cargoCapacity;
    }

    public int getTotalOutboundTrades() {
        return totalOutboundTrades;
    }

    public void setTotalOutboundTrades(int totalOutboundTrades) {
        this.totalOutboundTrades = totalOutboundTrades;
    }

    public List<OutboundTradeDTO> getTrades() {
        return trades;
    }

    public void setTrades(List<OutboundTradeDTO> trades) {
        this.trades = trades;
    }

    public String getInaraUrl() {
        return inaraUrl;
    }

    public void setInaraUrl(String inaraUrl) {
        this.inaraUrl = inaraUrl;
    }

    public String getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(String fetchedAt) {
        this.fetchedAt = fetchedAt;
    }
}
