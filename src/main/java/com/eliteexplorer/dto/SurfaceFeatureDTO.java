package com.eliteexplorer.dto;

public class SurfaceFeatureDTO {

    private String id;
    private String name;
    private String type; // SETTLEMENT, PORT, BIO_SITE, GEO_SITE, EXPLORATION_POI, CRASH_SITE, LANDING_SITE
    private String subType; // Agriculture, Extraction, Military, Research, Fumarole, Guardian, Thargoid
    private Double latitude;
    private Double longitude;
    private String bodyName;
    private Double distanceMeters;
    private String description;
    private boolean discoveredByPlayer;
    private boolean gpsConfirmed = true;

    public SurfaceFeatureDTO() {
    }

    public SurfaceFeatureDTO(String id, String name, String type, String subType, Double latitude, Double longitude, String bodyName, String description) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.subType = subType;
        this.latitude = latitude;
        this.longitude = longitude;
        this.bodyName = bodyName;
        this.description = description;
        this.discoveredByPlayer = false;
        this.gpsConfirmed = (latitude != null && longitude != null);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getSubType() {
        return subType;
    }

    public void setSubType(String subType) {
        this.subType = subType;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getBodyName() {
        return bodyName;
    }

    public void setBodyName(String bodyName) {
        this.bodyName = bodyName;
    }

    public Double getDistanceMeters() {
        return distanceMeters;
    }

    public void setDistanceMeters(Double distanceMeters) {
        this.distanceMeters = distanceMeters;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isDiscoveredByPlayer() {
        return discoveredByPlayer;
    }

    public void setDiscoveredByPlayer(boolean discoveredByPlayer) {
        this.discoveredByPlayer = discoveredByPlayer;
    }

    public boolean isGpsConfirmed() {
        return gpsConfirmed;
    }

    public void setGpsConfirmed(boolean gpsConfirmed) {
        this.gpsConfirmed = gpsConfirmed;
    }
}
