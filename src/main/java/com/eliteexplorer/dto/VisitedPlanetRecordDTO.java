package com.eliteexplorer.dto;

import java.util.ArrayList;
import java.util.List;

public class VisitedPlanetRecordDTO {
    private String systemName;
    private Long systemAddress;
    private String planetName;
    private Integer bodyId;
    private int touchdownCount = 0;
    private String firstTouchdown;
    private String lastTouchdown;
    private boolean stratumCollected = false;
    private String stratumSpecies;
    private String stratumVariant;
    private String stratumAnalyzedAt;
    private List<String> allOrganicsCollected = new ArrayList<>();

    public VisitedPlanetRecordDTO() {
    }

    public VisitedPlanetRecordDTO(String systemName, Long systemAddress, String planetName, Integer bodyId) {
        this.systemName = systemName;
        this.systemAddress = systemAddress;
        this.planetName = planetName;
        this.bodyId = bodyId;
    }

    public String getSystemName() {
        return systemName;
    }

    public void setSystemName(String systemName) {
        this.systemName = systemName;
    }

    public Long getSystemAddress() {
        return systemAddress;
    }

    public void setSystemAddress(Long systemAddress) {
        this.systemAddress = systemAddress;
    }

    public String getPlanetName() {
        return planetName;
    }

    public void setPlanetName(String planetName) {
        this.planetName = planetName;
    }

    public Integer getBodyId() {
        return bodyId;
    }

    public void setBodyId(Integer bodyId) {
        this.bodyId = bodyId;
    }

    public int getTouchdownCount() {
        return touchdownCount;
    }

    public void setTouchdownCount(int touchdownCount) {
        this.touchdownCount = touchdownCount;
    }

    public void incrementTouchdown(String timestamp) {
        this.touchdownCount++;
        if (this.firstTouchdown == null) {
            this.firstTouchdown = timestamp;
        }
        this.lastTouchdown = timestamp;
    }

    public String getFirstTouchdown() {
        return firstTouchdown;
    }

    public void setFirstTouchdown(String firstTouchdown) {
        this.firstTouchdown = firstTouchdown;
    }

    public String getLastTouchdown() {
        return lastTouchdown;
    }

    public void setLastTouchdown(String lastTouchdown) {
        this.lastTouchdown = lastTouchdown;
    }

    public boolean isStratumCollected() {
        return stratumCollected;
    }

    public void setStratumCollected(boolean stratumCollected) {
        this.stratumCollected = stratumCollected;
    }

    public String getStratumSpecies() {
        return stratumSpecies;
    }

    public void setStratumSpecies(String stratumSpecies) {
        this.stratumSpecies = stratumSpecies;
    }

    public String getStratumVariant() {
        return stratumVariant;
    }

    public void setStratumVariant(String stratumVariant) {
        this.stratumVariant = stratumVariant;
    }

    public String getStratumAnalyzedAt() {
        return stratumAnalyzedAt;
    }

    public void setStratumAnalyzedAt(String stratumAnalyzedAt) {
        this.stratumAnalyzedAt = stratumAnalyzedAt;
    }

    public List<String> getAllOrganicsCollected() {
        return allOrganicsCollected;
    }

    public void setAllOrganicsCollected(List<String> allOrganicsCollected) {
        this.allOrganicsCollected = allOrganicsCollected;
    }

    public void addOrganic(String species, String timestamp) {
        if (species != null && !species.isBlank() && !allOrganicsCollected.contains(species)) {
            allOrganicsCollected.add(species);
        }
        if (species != null && species.toLowerCase().contains("stratum")) {
            this.stratumCollected = true;
            this.stratumSpecies = species;
            if (this.stratumAnalyzedAt == null) {
                this.stratumAnalyzedAt = timestamp;
            }
        }
    }
}
