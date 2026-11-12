package com.quaternity.server.model;

public class PlayerSlot {
    private ArmyColor color;
    private boolean connected; // Indica se um jogador ocupou este exército na mesa
    private boolean ready;     // Indica se o jogador confirmou "Pronto para iniciar"
    private String playerName;
    private String sessionId;
    private String clientIp;
    private long remainingMs;
    private boolean alive;
    private String eliminationReason;

    public PlayerSlot() {}

    public PlayerSlot(ArmyColor color, long initialTimeMs) {
        this.color = color;
        this.connected = false;
        this.ready = false;
        this.playerName = "Aguardando...";
        this.remainingMs = initialTimeMs;
        this.alive = true;
        this.eliminationReason = null;
    }

    public ArmyColor getColor() {
        return color;
    }

    public void setColor(ArmyColor color) {
        this.color = color;
    }

    public boolean isConnected() {
        return connected;
    }

    public void setConnected(boolean connected) {
        this.connected = connected;
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }

    public String getPlayerName() {
        return playerName;
    }

    public void setPlayerName(String playerName) {
        this.playerName = playerName;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getClientIp() {
        return clientIp;
    }

    public void setClientIp(String clientIp) {
        this.clientIp = clientIp;
    }

    public long getRemainingMs() {
        return remainingMs;
    }

    public void setRemainingMs(long remainingMs) {
        this.remainingMs = Math.max(0, remainingMs);
    }

    public boolean isAlive() {
        return alive;
    }

    public void setAlive(boolean alive) {
        this.alive = alive;
    }

    public String getEliminationReason() {
        return eliminationReason;
    }

    public void setEliminationReason(String eliminationReason) {
        this.eliminationReason = eliminationReason;
    }

    public String getFormattedTime() {
        if (remainingMs <= 0) return "00:00";
        long totalSeconds = remainingMs / 1000;
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;

        if (totalSeconds < 10) {
            long tenths = (remainingMs % 1000) / 100;
            return String.format("%02d:%02d.%d", minutes, seconds, tenths);
        }
        return String.format("%02d:%02d", minutes, seconds);
    }
}
