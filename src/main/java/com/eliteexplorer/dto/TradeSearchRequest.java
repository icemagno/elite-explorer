package com.eliteexplorer.dto;

public class TradeSearchRequest {
    private String system = "Col 285 Sector EG-D a42-1";
    private Integer cargoCapacity = 36;
    private Integer maxDistance = 80;
    private Integer maxAgeHours = 72;
    private Integer padSize = 1; // 1 = any/large, 2 = medium, etc.

    public TradeSearchRequest() {
    }

    public TradeSearchRequest(String system, Integer cargoCapacity, Integer maxDistance) {
        if (system != null && !system.isBlank()) {
            this.system = system.trim();
        }
        if (cargoCapacity != null && cargoCapacity > 0) {
            this.cargoCapacity = cargoCapacity;
        }
        if (maxDistance != null && maxDistance > 0) {
            this.maxDistance = maxDistance;
        }
    }

    public String getSystem() {
        return system;
    }

    public void setSystem(String system) {
        if (system != null && !system.isBlank()) {
            this.system = system.trim();
        }
    }

    public Integer getCargoCapacity() {
        return cargoCapacity;
    }

    public void setCargoCapacity(Integer cargoCapacity) {
        if (cargoCapacity != null && cargoCapacity > 0) {
            this.cargoCapacity = cargoCapacity;
        }
    }

    public Integer getMaxDistance() {
        return maxDistance;
    }

    public void setMaxDistance(Integer maxDistance) {
        if (maxDistance != null && maxDistance > 0) {
            this.maxDistance = maxDistance;
        }
    }

    public Integer getMaxAgeHours() {
        return maxAgeHours;
    }

    public void setMaxAgeHours(Integer maxAgeHours) {
        this.maxAgeHours = maxAgeHours;
    }

    public Integer getPadSize() {
        return padSize;
    }

    public void setPadSize(Integer padSize) {
        this.padSize = padSize;
    }
}
