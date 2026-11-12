package com.quaternity.server.model;

import java.util.*;

public class GameTable {
    private String id;
    private String name;
    private GameState state;
    private ArmyColor activeTurn;
    private int baseMinutes;
    private int incrementSeconds;
    private Map<ArmyColor, PlayerSlot> players;
    private ArmyColor winner;
    private long createdAt;
    private long startedAt;
    private long lastTimestamp;
    private List<MoveRecord> movesHistory;
    private String pauseReason;
    private String language = "pt"; // "pt", "en", "es"
    private String gameType = "INCLUSIVE"; // "INCLUSIVE", "CONVENTIONAL"

    public GameTable() {
        this.players = new LinkedHashMap<>();
        this.movesHistory = new ArrayList<>();
    }

    public GameTable(String id, String name, int baseMinutes, int incrementSeconds) {
        this(id, name, baseMinutes, incrementSeconds, "pt", "INCLUSIVE");
    }

    public GameTable(String id, String name, int baseMinutes, int incrementSeconds, String language, String gameType) {
        this.id = id;
        this.name = (name == null || name.trim().isEmpty()) ? "Mesa " + id.substring(0, Math.min(4, id.length())) : name.trim();
        this.baseMinutes = baseMinutes > 0 ? baseMinutes : 15;
        this.incrementSeconds = incrementSeconds >= 0 ? incrementSeconds : 5;
        this.language = (language != null && !language.trim().isEmpty()) ? language.trim().toLowerCase() : "pt";
        this.gameType = (gameType != null && !gameType.trim().isEmpty()) ? gameType.trim().toUpperCase() : "INCLUSIVE";
        this.state = GameState.LOBBY;
        this.activeTurn = ArmyColor.WHITE;
        this.winner = null;
        this.createdAt = System.currentTimeMillis();
        this.startedAt = 0;
        this.lastTimestamp = 0;
        this.movesHistory = new ArrayList<>();

        long initialTimeMs = (long) this.baseMinutes * 60 * 1000;
        this.players = new LinkedHashMap<>();
        for (ArmyColor color : ArmyColor.values()) {
            this.players.put(color, new PlayerSlot(color, initialTimeMs));
        }
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

    public Map<ArmyColor, PlayerSlot> getPlayers() {
        return players;
    }

    public void setPlayers(Map<ArmyColor, PlayerSlot> players) {
        this.players = players;
    }

    public ArmyColor getWinner() {
        return winner;
    }

    public void setWinner(ArmyColor winner) {
        this.winner = winner;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }

    public long getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(long startedAt) {
        this.startedAt = startedAt;
    }

    public long getLastTimestamp() {
        return lastTimestamp;
    }

    public void setLastTimestamp(long lastTimestamp) {
        this.lastTimestamp = lastTimestamp;
    }

    public List<MoveRecord> getMovesHistory() {
        return movesHistory;
    }

    public void setMovesHistory(List<MoveRecord> movesHistory) {
        this.movesHistory = movesHistory;
    }

    // Métodos utilitários
    public int getConnectedCount() {
        if (players == null) return 0;
        return (int) players.values().stream().filter(PlayerSlot::isConnected).count();
    }

    public int getReadyCount() {
        if (players == null) return 0;
        return (int) players.values().stream().filter(PlayerSlot::isReady).count();
    }

    public int getAliveCount() {
        if (players == null) return 0;
        return (int) players.values().stream().filter(PlayerSlot::isAlive).count();
    }

    public boolean isColorAvailable(ArmyColor color) {
        if (players == null || color == null) return false;
        PlayerSlot slot = players.get(color);
        return slot != null && !slot.isConnected();
    }

    public ArmyColor getFirstAvailableColor() {
        if (players == null) return null;
        for (ArmyColor color : ArmyColor.values()) {
            if (isColorAvailable(color)) {
                return color;
            }
        }
        return null;
    }

    public boolean isAllConnected() {
        return getConnectedCount() == 4;
    }

    public boolean isAllReady() {
        return getConnectedCount() == 4 && getReadyCount() == 4;
    }

    public String getPauseReason() {
        return pauseReason;
    }

    public void setPauseReason(String pauseReason) {
        this.pauseReason = pauseReason;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = (language != null && !language.trim().isEmpty()) ? language.trim().toLowerCase() : "pt";
    }

    public String getGameType() {
        return gameType;
    }

    public void setGameType(String gameType) {
        this.gameType = (gameType != null && !gameType.trim().isEmpty()) ? gameType.trim().toUpperCase() : "INCLUSIVE";
    }
}
