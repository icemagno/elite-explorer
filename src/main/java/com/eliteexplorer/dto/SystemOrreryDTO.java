package com.eliteexplorer.dto;

import java.util.ArrayList;
import java.util.List;

public class SystemOrreryDTO {

    private String systemName;
    private Long systemAddress;
    private Double posX;
    private Double posY;
    private Double posZ;
    private String primaryStarClass;
    private int totalBodies;
    private List<CelestialBodyDTO> bodies = new ArrayList<>();
    private long lastUpdated;

    public SystemOrreryDTO() {
        this.lastUpdated = System.currentTimeMillis();
    }

    public SystemOrreryDTO(String systemName, Long systemAddress, Double posX, Double posY, Double posZ, String primaryStarClass) {
        this.systemName = systemName;
        this.systemAddress = systemAddress;
        this.posX = posX;
        this.posY = posY;
        this.posZ = posZ;
        this.primaryStarClass = primaryStarClass;
        this.lastUpdated = System.currentTimeMillis();
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

    public Double getPosX() {
        return posX;
    }

    public void setPosX(Double posX) {
        this.posX = posX;
    }

    public Double getPosY() {
        return posY;
    }

    public void setPosY(Double posY) {
        this.posY = posY;
    }

    public Double getPosZ() {
        return posZ;
    }

    public void setPosZ(Double posZ) {
        this.posZ = posZ;
    }

    public String getPrimaryStarClass() {
        return primaryStarClass;
    }

    public void setPrimaryStarClass(String primaryStarClass) {
        this.primaryStarClass = primaryStarClass;
    }

    public int getTotalBodies() {
        return totalBodies;
    }

    public void setTotalBodies(int totalBodies) {
        this.totalBodies = totalBodies;
    }

    public List<CelestialBodyDTO> getBodies() {
        return bodies;
    }

    public void setBodies(List<CelestialBodyDTO> bodies) {
        this.bodies = bodies;
        this.totalBodies = bodies != null ? bodies.size() : 0;
    }

    public long getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(long lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
}
