package com.quaternity.server.model.dto;

public class JoinTableRequest {
    private String playerName;
    private String color;
    private String clientToken;

    public JoinTableRequest() {}

    public JoinTableRequest(String playerName, String color) {
        this.playerName = playerName;
        this.color = color;
    }

    public JoinTableRequest(String playerName, String color, String clientToken) {
        this.playerName = playerName;
        this.color = color;
        this.clientToken = clientToken;
    }

    public String getPlayerName() {
        return playerName;
    }

    public void setPlayerName(String playerName) {
        this.playerName = playerName;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getClientToken() {
        return clientToken;
    }

    public void setClientToken(String clientToken) {
        this.clientToken = clientToken;
    }
}
