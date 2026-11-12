package com.quaternity.server.model.dto;

public class CreateTableRequest {
    private String name;
    private Integer baseMinutes;
    private Integer incrementSeconds;
    private String language;
    private String gameType;

    public CreateTableRequest() {}

    public CreateTableRequest(String name, Integer baseMinutes, Integer incrementSeconds) {
        this.name = name;
        this.baseMinutes = baseMinutes;
        this.incrementSeconds = incrementSeconds;
        this.language = "pt";
        this.gameType = "INCLUSIVE";
    }

    public CreateTableRequest(String name, Integer baseMinutes, Integer incrementSeconds, String language, String gameType) {
        this.name = name;
        this.baseMinutes = baseMinutes;
        this.incrementSeconds = incrementSeconds;
        this.language = language;
        this.gameType = gameType;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getBaseMinutes() {
        return baseMinutes;
    }

    public void setBaseMinutes(Integer baseMinutes) {
        this.baseMinutes = baseMinutes;
    }

    public Integer getIncrementSeconds() {
        return incrementSeconds;
    }

    public void setIncrementSeconds(Integer incrementSeconds) {
        this.incrementSeconds = incrementSeconds;
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
