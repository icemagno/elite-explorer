package com.eliteexplorer.dto;

import java.util.ArrayList;
import java.util.List;

public class GalaxyCubeResponse {
    private String centralSystem;
    private double centerX;
    private double centerY;
    private double centerZ;
    private double cubeSize;
    private int totalKnownSystems;
    private int detectedVoidCount;
    private List<StarSystemDTO> systems = new ArrayList<>();
    private List<VoidSectorDTO> voidSectors = new ArrayList<>();
    private List<RoutePointDTO> activeRoute = new ArrayList<>();

    public GalaxyCubeResponse() {
    }

    public List<RoutePointDTO> getActiveRoute() {
        return activeRoute;
    }

    public void setActiveRoute(List<RoutePointDTO> activeRoute) {
        this.activeRoute = activeRoute;
    }

    public String getCentralSystem() {
        return centralSystem;
    }

    public void setCentralSystem(String centralSystem) {
        this.centralSystem = centralSystem;
    }

    public double getCenterX() {
        return centerX;
    }

    public void setCenterX(double centerX) {
        this.centerX = centerX;
    }

    public double getCenterY() {
        return centerY;
    }

    public void setCenterY(double centerY) {
        this.centerY = centerY;
    }

    public double getCenterZ() {
        return centerZ;
    }

    public void setCenterZ(double centerZ) {
        this.centerZ = centerZ;
    }

    public double getCubeSize() {
        return cubeSize;
    }

    public void setCubeSize(double cubeSize) {
        this.cubeSize = cubeSize;
    }

    public int getTotalKnownSystems() {
        return totalKnownSystems;
    }

    public void setTotalKnownSystems(int totalKnownSystems) {
        this.totalKnownSystems = totalKnownSystems;
    }

    public int getDetectedVoidCount() {
        return detectedVoidCount;
    }

    public void setDetectedVoidCount(int detectedVoidCount) {
        this.detectedVoidCount = detectedVoidCount;
    }

    public List<StarSystemDTO> getSystems() {
        return systems;
    }

    public void setSystems(List<StarSystemDTO> systems) {
        this.systems = systems;
    }

    public List<VoidSectorDTO> getVoidSectors() {
        return voidSectors;
    }

    public void setVoidSectors(List<VoidSectorDTO> voidSectors) {
        this.voidSectors = voidSectors;
    }
}
