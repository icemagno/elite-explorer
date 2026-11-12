package com.quaternity.server.model.dto;

public class PlayerMoveRequest {
    private String player; // white, red, black, green
    private String color;  // alias aceito para compatibilidade
    private String clientToken;

    public PlayerMoveRequest() {}

    public PlayerMoveRequest(String player) {
        this.player = player;
        this.color = player;
    }

    public PlayerMoveRequest(String player, String clientToken) {
        this.player = player;
        this.color = player;
        this.clientToken = clientToken;
    }

    public String getClientToken() {
        return clientToken;
    }

    public void setClientToken(String clientToken) {
        this.clientToken = clientToken;
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

    public String getPlayer() {
        return getEffectiveColor();
    }

    public void setPlayer(String player) {
        this.player = player;
        if (this.color == null) {
            this.color = player;
        }
    }

    public String getColor() {
        return getEffectiveColor();
    }

    public void setColor(String color) {
        this.color = color;
        if (this.player == null) {
            this.player = color;
        }
    }
}
