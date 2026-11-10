package com.eliteexplorer.dto;

public class OutboundTradeDTO {
    private String commodity;
    private String originStation;
    private String originSystem;
    private String originDistance;
    private String destStation;
    private String destSystem;
    private String destDistance;
    private String buyPrice;
    private String supply;
    private String sellPrice;
    private String demand;
    private long profitPerUnit;
    private long profitTotalTrip;
    private String profitPerUnitFormatted;
    private String profitTotalTripFormatted;
    private String routeDistance;
    private double routeDistanceNumeric;
    private String updated;

    public OutboundTradeDTO() {
    }

    public String getCommodity() {
        return commodity;
    }

    public void setCommodity(String commodity) {
        this.commodity = commodity;
    }

    public String getOriginStation() {
        return originStation;
    }

    public void setOriginStation(String originStation) {
        this.originStation = originStation;
    }

    public String getOriginSystem() {
        return originSystem;
    }

    public void setOriginSystem(String originSystem) {
        this.originSystem = originSystem;
    }

    public String getOriginDistance() {
        return originDistance;
    }

    public void setOriginDistance(String originDistance) {
        this.originDistance = originDistance;
    }

    public String getDestStation() {
        return destStation;
    }

    public void setDestStation(String destStation) {
        this.destStation = destStation;
    }

    public String getDestSystem() {
        return destSystem;
    }

    public void setDestSystem(String destSystem) {
        this.destSystem = destSystem;
    }

    public String getDestDistance() {
        return destDistance;
    }

    public void setDestDistance(String destDistance) {
        this.destDistance = destDistance;
    }

    public String getBuyPrice() {
        return buyPrice;
    }

    public void setBuyPrice(String buyPrice) {
        this.buyPrice = buyPrice;
    }

    public String getSupply() {
        return supply;
    }

    public void setSupply(String supply) {
        this.supply = supply;
    }

    public String getSellPrice() {
        return sellPrice;
    }

    public void setSellPrice(String sellPrice) {
        this.sellPrice = sellPrice;
    }

    public String getDemand() {
        return demand;
    }

    public void setDemand(String demand) {
        this.demand = demand;
    }

    public long getProfitPerUnit() {
        return profitPerUnit;
    }

    public void setProfitPerUnit(long profitPerUnit) {
        this.profitPerUnit = profitPerUnit;
    }

    public long getProfitTotalTrip() {
        return profitTotalTrip;
    }

    public void setProfitTotalTrip(long profitTotalTrip) {
        this.profitTotalTrip = profitTotalTrip;
    }

    public String getProfitPerUnitFormatted() {
        return profitPerUnitFormatted;
    }

    public void setProfitPerUnitFormatted(String profitPerUnitFormatted) {
        this.profitPerUnitFormatted = profitPerUnitFormatted;
    }

    public String getProfitTotalTripFormatted() {
        return profitTotalTripFormatted;
    }

    public void setProfitTotalTripFormatted(String profitTotalTripFormatted) {
        this.profitTotalTripFormatted = profitTotalTripFormatted;
    }

    public String getRouteDistance() {
        return routeDistance;
    }

    public void setRouteDistance(String routeDistance) {
        this.routeDistance = routeDistance;
    }

    public double getRouteDistanceNumeric() {
        return routeDistanceNumeric;
    }

    public void setRouteDistanceNumeric(double routeDistanceNumeric) {
        this.routeDistanceNumeric = routeDistanceNumeric;
    }

    public String getUpdated() {
        return updated;
    }

    public void setUpdated(String updated) {
        this.updated = updated;
    }
}
