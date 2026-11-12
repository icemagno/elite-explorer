package com.quaternity.server.model.dto;

import com.quaternity.server.model.ArmyColor;
import com.quaternity.server.model.GameState;
import com.quaternity.server.model.GameTable;
import com.quaternity.server.model.PlayerSlot;

import java.util.LinkedHashMap;
import java.util.Map;

public class TableSummaryDto {
    private String id;
    private String name;
    private GameState state;
    private ArmyColor activeTurn;
    private int baseMinutes;
    private int incrementSeconds;
    private int readyCount;
    private int connectedCount;
    private int aliveCount;
    private int moveCount;
    private ArmyColor winner;
    private Map<String, Boolean> colorAvailability;
    private Map<String, PlayerSlot> players;
    private long createdAt;
    private String language;
    private String gameType;

    public TableSummaryDto() {}

    public static TableSummaryDto fromTable(GameTable table) {
        TableSummaryDto dto = new TableSummaryDto();
        dto.setId(table.getId());
        dto.setName(table.getName());
        dto.setState(table.getState());
        dto.setActiveTurn(table.getActiveTurn());
        dto.setBaseMinutes(table.getBaseMinutes());
        dto.setIncrementSeconds(table.getIncrementSeconds());
        dto.setLanguage(table.getLanguage());
        dto.setGameType(table.getGameType());
        dto.setReadyCount(table.getReadyCount());
        dto.setConnectedCount(table.getConnectedCount());
        dto.setAliveCount(table.getAliveCount());
        dto.setMoveCount(table.getMovesHistory() != null ? table.getMovesHistory().size() : 0);
        dto.setWinner(table.getWinner());
        dto.setCreatedAt(table.getCreatedAt());

        Map<String, Boolean> avail = new LinkedHashMap<>();
        Map<String, PlayerSlot> playersMap = new LinkedHashMap<>();
        for (ArmyColor color : ArmyColor.values()) {
            avail.put(color.name().toLowerCase(), table.isColorAvailable(color));
            PlayerSlot slot = table.getPlayers().get(color);
            playersMap.put(color.name().toLowerCase(), slot);
        }
        dto.setColorAvailability(avail);
        dto.setPlayers(playersMap);

        return dto;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public GameState getState() {
        return state;
    }

    public void setState(GameState state) {
        this.state = state;
    }

    public ArmyColor getActiveTurn() {
        return activeTurn;
    }

    public void setActiveTurn(ArmyColor activeTurn) {
        this.activeTurn = activeTurn;
    }

    public int getBaseMinutes() {
        return baseMinutes;
    }

    public void setBaseMinutes(int baseMinutes) {
        this.baseMinutes = baseMinutes;
    }

    public int getIncrementSeconds() {
        return incrementSeconds;
    }

    public void setIncrementSeconds(int incrementSeconds) {
        this.incrementSeconds = incrementSeconds;
    }

    public int getReadyCount() {
        return readyCount;
    }

    public void setReadyCount(int readyCount) {
        this.readyCount = readyCount;
    }

    public int getConnectedCount() {
        return connectedCount;
    }

    public void setConnectedCount(int connectedCount) {
        this.connectedCount = connectedCount;
    }

    public int getAliveCount() {
        return aliveCount;
    }

    public void setAliveCount(int aliveCount) {
        this.aliveCount = aliveCount;
    }

    public int getMoveCount() {
        return moveCount;
    }

    public void setMoveCount(int moveCount) {
        this.moveCount = moveCount;
    }

    @com.fasterxml.jackson.annotation.JsonIgnore
    public java.util.List<Object> getMovesHistory() {
        return java.util.Collections.nCopies(Math.max(0, moveCount), "");
    }

    public ArmyColor getWinner() {
        return winner;
    }

    public void setWinner(ArmyColor winner) {
        this.winner = winner;
    }

    public Map<String, Boolean> getColorAvailability() {
        return colorAvailability;
    }

    public void setColorAvailability(Map<String, Boolean> colorAvailability) {
        this.colorAvailability = colorAvailability;
    }

    public Map<String, PlayerSlot> getPlayers() {
        return players;
    }

    public void setPlayers(Map<String, PlayerSlot> players) {
        this.players = players;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getGameType() {
        return gameType;
    }

    public void setGameType(String gameType) {
        this.gameType = gameType;
    }
}
