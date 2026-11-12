package com.quaternity.server.model.dto;

public class PlayerRegisterRequest {
    private String color;
    private String player;
    private String clientToken;
    private String playerName;

    public PlayerRegisterRequest() {}

    public PlayerRegisterRequest(String color, String clientToken, String playerName) {
        this.color = color;
        this.clientToken = clientToken;
        this.playerName = playerName;
    }

    public String getColor() {
        return (color != null && !color.trim().isEmpty()) ? color : player;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getPlayer() {
        return player;
    }

    public void setPlayer(String player) {
        this.player = player;
    }

    public String getClientToken() {
        return clientToken;
    }

    public void setClientToken(String clientToken) {
        this.clientToken = clientToken;
    }

    public String getPlayerName() {
        return playerName;
    }

    public void setPlayerName(String playerName) {
        this.playerName = playerName;
    }
}
