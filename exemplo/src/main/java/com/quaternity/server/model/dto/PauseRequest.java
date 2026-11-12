package com.quaternity.server.model.dto;

public class PauseRequest {
    private Boolean isPaused;
    private Boolean paused;
    private String reason;
    private String sessionId;
    private String clientToken;

    public PauseRequest() {}

    public PauseRequest(Boolean isPaused, String reason) {
        this.isPaused = isPaused;
        this.paused = isPaused;
        this.reason = reason;
    }

    public String getEffectiveSessionId() {
        if (clientToken != null && !clientToken.trim().isEmpty()) return clientToken.trim();
        if (sessionId != null && !sessionId.trim().isEmpty()) return sessionId.trim();
        return null;
    }

    public String getSessionId() {
        return getEffectiveSessionId();
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
        if (this.clientToken == null) this.clientToken = sessionId;
    }

    public String getClientToken() {
        return getEffectiveSessionId();
    }

    public void setClientToken(String clientToken) {
        this.clientToken = clientToken;
        if (this.sessionId == null) this.sessionId = clientToken;
    }

    public Boolean getEffectiveIsPaused() {
        if (paused != null) return paused;
        if (isPaused != null) return isPaused;
        return null;
    }

    public Boolean getIsPaused() {
        return getEffectiveIsPaused();
    }

    public void setIsPaused(Boolean isPaused) {
        this.isPaused = isPaused;
        if (this.paused == null) this.paused = isPaused;
    }

    public Boolean getPaused() {
        return getEffectiveIsPaused();
    }

    public void setPaused(Boolean paused) {
        this.paused = paused;
        if (this.isPaused == null) this.isPaused = paused;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
