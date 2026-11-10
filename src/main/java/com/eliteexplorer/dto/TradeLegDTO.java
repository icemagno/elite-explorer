package com.eliteexplorer.dto;

public class TradeLegDTO {
    private String commodity;
    private String buyPrice;
    private String supply;
    private String sellPrice;
    private String profitDelta;
    private String demand;
    private String fromStation;
    private String fromSystem;
    private String toStation;
    private String toSystem;

    public TradeLegDTO() {
    }

    public TradeLegDTO(String commodity, String buyPrice, String supply, String sellPrice, String profitDelta,
                       String demand, String fromStation, String fromSystem, String toStation, String toSystem) {
        this.commodity = commodity;
        this.buyPrice = buyPrice;
        this.supply = supply;
        this.sellPrice = sellPrice;
        this.profitDelta = profitDelta;
        this.demand = demand;
        this.fromStation = fromStation;
        this.fromSystem = fromSystem;
        this.toStation = toStation;
        this.toSystem = toSystem;
    }

    public String getCommodity() {
        return commodity;
    }

    public void setCommodity(String commodity) {
        this.commodity = commodity;
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

    public String getProfitDelta() {
        return profitDelta;
    }

    public void setProfitDelta(String profitDelta) {
        this.profitDelta = profitDelta;
    }

    public String getDemand() {
        return demand;
    }

    public void setDemand(String demand) {
        this.demand = demand;
    }

    public String getFromStation() {
        return fromStation;
    }

    public void setFromStation(String fromStation) {
        this.fromStation = fromStation;
    }

    public String getFromSystem() {
        return fromSystem;
    }

    public void setFromSystem(String fromSystem) {
        this.fromSystem = fromSystem;
    }

    public String getToStation() {
        return toStation;
    }

    public void setToStation(String toStation) {
        this.toStation = toStation;
    }

    public String getToSystem() {
        return toSystem;
    }

    public void setToSystem(String toSystem) {
        this.toSystem = toSystem;
    }
}
