package com.eliteexplorer.dto;

public class TradeRouteDTO {
    private String sourceStation;
    private String sourceSystem;
    private String sourceDistance;

    private String targetStation;
    private String targetSystem;
    private String targetDistance;

    // Outbound leg: Source Station -> Target Station
    private TradeLegDTO outbound;
    
    // Inbound/Return leg: Target Station -> Source Station
    private TradeLegDTO inbound;

    // Transaction & route stats
    private String routeDistance;
    private String distanceFromCenter;
    private String updated;
    private String profitPerUnit;
    private String profitPerTrip;
    private String profitPerHour;
    private String margin;

    // Numeric values for filtering / sorting
    private long profitPerTripNumeric;
    private long profitPerUnitNumeric;
    private long profitPerHourNumeric;
    private double routeDistanceNumeric;

    public TradeRouteDTO() {
    }

    public String getSourceStation() {
        return sourceStation;
    }

    public void setSourceStation(String sourceStation) {
        this.sourceStation = sourceStation;
    }

    public String getSourceSystem() {
        return sourceSystem;
    }

    public void setSourceSystem(String sourceSystem) {
        this.sourceSystem = sourceSystem;
    }

    public String getSourceDistance() {
        return sourceDistance;
    }

    public void setSourceDistance(String sourceDistance) {
        this.sourceDistance = sourceDistance;
    }

    public String getTargetStation() {
        return targetStation;
    }

    public void setTargetStation(String targetStation) {
        this.targetStation = targetStation;
    }

    public String getTargetSystem() {
        return targetSystem;
    }

    public void setTargetSystem(String targetSystem) {
        this.targetSystem = targetSystem;
    }

    public String getTargetDistance() {
        return targetDistance;
    }

    public void setTargetDistance(String targetDistance) {
        this.targetDistance = targetDistance;
    }

    public TradeLegDTO getOutbound() {
        return outbound;
    }

    public void setOutbound(TradeLegDTO outbound) {
        this.outbound = outbound;
    }

    public TradeLegDTO getInbound() {
        return inbound;
    }

    public void setInbound(TradeLegDTO inbound) {
        this.inbound = inbound;
    }

    public String getRouteDistance() {
        return routeDistance;
    }

    public void setRouteDistance(String routeDistance) {
        this.routeDistance = routeDistance;
    }

    public String getDistanceFromCenter() {
        return distanceFromCenter;
    }

    public void setDistanceFromCenter(String distanceFromCenter) {
        this.distanceFromCenter = distanceFromCenter;
    }

    public String getUpdated() {
        return updated;
    }

    public void setUpdated(String updated) {
        this.updated = updated;
    }

    public String getProfitPerUnit() {
        return profitPerUnit;
    }

    public void setProfitPerUnit(String profitPerUnit) {
        this.profitPerUnit = profitPerUnit;
    }

    public String getProfitPerTrip() {
        return profitPerTrip;
    }

    public void setProfitPerTrip(String profitPerTrip) {
        this.profitPerTrip = profitPerTrip;
    }

    public String getProfitPerHour() {
        return profitPerHour;
    }

    public void setProfitPerHour(String profitPerHour) {
        this.profitPerHour = profitPerHour;
    }

    public String getMargin() {
        return margin;
    }

    public void setMargin(String margin) {
        this.margin = margin;
    }

    public long getProfitPerTripNumeric() {
        return profitPerTripNumeric;
    }

    public void setProfitPerTripNumeric(long profitPerTripNumeric) {
        this.profitPerTripNumeric = profitPerTripNumeric;
    }

    public long getProfitPerUnitNumeric() {
        return profitPerUnitNumeric;
    }

    public void setProfitPerUnitNumeric(long profitPerUnitNumeric) {
        this.profitPerUnitNumeric = profitPerUnitNumeric;
    }

    public long getProfitPerHourNumeric() {
        return profitPerHourNumeric;
    }

    public void setProfitPerHourNumeric(long profitPerHourNumeric) {
        this.profitPerHourNumeric = profitPerHourNumeric;
    }

    public double getRouteDistanceNumeric() {
        return routeDistanceNumeric;
    }

    public void setRouteDistanceNumeric(double routeDistanceNumeric) {
        this.routeDistanceNumeric = routeDistanceNumeric;
    }
}
