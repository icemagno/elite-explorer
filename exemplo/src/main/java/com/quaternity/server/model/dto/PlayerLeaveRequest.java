package com.quaternity.server.model.dto;

public class PlayerLeaveRequest {
    private String player;
    private String color;
    private String sessionId;
    private String clientToken;

    public PlayerLeaveRequest() {}

    public PlayerLeaveRequest(String player, String sessionId) {
        this.player = player;
        this.color = player;
        this.sessionId = sessionId;
        this.clientToken = sessionId;
    }

    public PlayerLeaveRequest(String player, String color, String clientToken) {
        this.player = player;
        this.color = color;
        this.clientToken = clientToken;
        this.sessionId = clientToken;
    }

    public String getEffectiveColor() {
        if (color != null && !color.trim().isEmpty()) {
            return color.trim();
        }
        if (player != null && !player.trim().isEmpty()) {
            return player.trim();
        }
        return null;
    }

    public String getEffectiveSessionId() {
        if (clientToken != null && !clientToken.trim().isEmpty()) {
            return clientToken.trim();
        }
        if (sessionId != null && !sessionId.trim().isEmpty()) {
            return sessionId.trim();
        }
        return null;
    }

    public String getPlayer() {
        return player;
    }

    public void setPlayer(String player) {
        this.player = player;
        if (this.color == null) this.color = player;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
        if (this.player == null) this.player = color;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getClientToken() {
        return clientToken;
    }

    public void setClientToken(String clientToken) {
        this.clientToken = clientToken;
    }
}
