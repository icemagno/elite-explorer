package com.quaternity.server.model.dto;

public class PlayerReadyRequest {
    private String player;
    private String color;
    private Boolean ready = true;

    public PlayerReadyRequest() {}

    public PlayerReadyRequest(String player, Boolean ready) {
        this.player = player;
        this.color = player;
        this.ready = ready != null ? ready : true;
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

    public Boolean getReady() {
        return ready != null ? ready : true;
    }

    public void setReady(Boolean ready) {
        this.ready = ready != null ? ready : true;
    }
}
