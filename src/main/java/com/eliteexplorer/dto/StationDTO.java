package com.eliteexplorer.dto;

public class StationDTO {
    private String name;
    private String type;
    private double distanceLs;
    private boolean hasShipyard;
    private boolean hasOutfitting;
    private boolean hasMarket;
    private String bodyName;

    public StationDTO() {}

    public StationDTO(String name, String type, double distanceLs, boolean hasShipyard, boolean hasOutfitting, boolean hasMarket, String bodyName) {
        this.name = name;
        this.type = type;
        this.distanceLs = distanceLs;
        this.hasShipyard = hasShipyard;
        this.hasOutfitting = hasOutfitting;
        this.hasMarket = hasMarket;
        this.bodyName = bodyName;
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

    public double getDistanceLs() {
        return distanceLs;
    }

    public void setDistanceLs(double distanceLs) {
        this.distanceLs = distanceLs;
    }

    public boolean isHasShipyard() {
        return hasShipyard;
    }

    public void setHasShipyard(boolean hasShipyard) {
        this.hasShipyard = hasShipyard;
    }

    public boolean isHasOutfitting() {
        return hasOutfitting;
    }

    public void setHasOutfitting(boolean hasOutfitting) {
        this.hasOutfitting = hasOutfitting;
    }

    public boolean isHasMarket() {
        return hasMarket;
    }

    public void setHasMarket(boolean hasMarket) {
        this.hasMarket = hasMarket;
    }

    public String getBodyName() {
        return bodyName;
    }

    public void setBodyName(String bodyName) {
        this.bodyName = bodyName;
    }
}
