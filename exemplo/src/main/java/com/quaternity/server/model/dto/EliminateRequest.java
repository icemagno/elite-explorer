package com.quaternity.server.model.dto;

public class EliminateRequest {
    private String color;
    private String reason; // checkmate, resignation, timeout

    public EliminateRequest() {}

    public EliminateRequest(String color, String reason) {
        this.color = color;
        this.reason = reason;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
