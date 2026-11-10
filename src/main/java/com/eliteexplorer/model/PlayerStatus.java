package com.eliteexplorer.model;

public class PlayerStatus {
    private String commander = "Desconhecido";
    private String currentSystem = "Col 285 Sector EG-D a42-1";
    private String currentStation = "";
    private boolean isDocked = false;
    private String shipType = "Desconhecida";
    private String shipRaw = "";
    private String shipName = "";
    private int cargoCapacity = 36;
    private String lastEvent = "";
    private String lastEventTime = "";
    private boolean journalFound = false;
    private String journalPath = "";
    private String journalFile = "";
    private long systemChangeTimestamp = System.currentTimeMillis();

    private Double posX = null;
    private Double posY = null;
    private Double posZ = null;
    private boolean hasCoordinates = false;
    private String starClass = "";
    private long navRouteTimestamp = System.currentTimeMillis();

    public PlayerStatus() {
    }

    public long getNavRouteTimestamp() {
        return navRouteTimestamp;
    }

    public void setNavRouteTimestamp(long navRouteTimestamp) {
        this.navRouteTimestamp = navRouteTimestamp;
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

    public boolean isHasCoordinates() {
        return hasCoordinates;
    }

    public void setCoordinates(Double x, Double y, Double z) {
        this.posX = x;
        this.posY = y;
        this.posZ = z;
        this.hasCoordinates = (x != null && y != null && z != null);
    }

    public String getStarClass() {
        return starClass;
    }

    public void setStarClass(String starClass) {
        if (starClass != null) {
            this.starClass = starClass.trim();
        }
    }

    public String getCommander() {
        return commander;
    }

    public void setCommander(String commander) {
        if (commander != null && !commander.isBlank()) {
            this.commander = commander.trim();
        }
    }

    public String getCurrentSystem() {
        return currentSystem;
    }

    public void setCurrentSystem(String currentSystem) {
        if (currentSystem != null && !currentSystem.isBlank()) {
            this.currentSystem = currentSystem.trim();
        }
    }

    public String getCurrentStation() {
        return currentStation;
    }

    public void setCurrentStation(String currentStation) {
        this.currentStation = currentStation != null ? currentStation.trim() : "";
    }

    public boolean isDocked() {
        return isDocked;
    }

    public void setDocked(boolean docked) {
        isDocked = docked;
    }

    public String getShipType() {
        return shipType;
    }

    public void setShipType(String shipType) {
        this.shipType = shipType != null ? shipType : "Desconhecida";
    }

    public String getShipRaw() {
        return shipRaw;
    }

    public void setShipRaw(String shipRaw) {
        this.shipRaw = shipRaw != null ? shipRaw : "";
        this.shipType = formatShipName(this.shipRaw);
    }

    public String getShipName() {
        return shipName;
    }

    public void setShipName(String shipName) {
        this.shipName = shipName != null ? shipName : "";
    }

    public int getCargoCapacity() {
        return cargoCapacity;
    }

    public void setCargoCapacity(int cargoCapacity) {
        if (cargoCapacity > 0) {
            this.cargoCapacity = cargoCapacity;
        }
    }

    public String getLastEvent() {
        return lastEvent;
    }

    public void setLastEvent(String lastEvent) {
        this.lastEvent = lastEvent;
    }

    public String getLastEventTime() {
        return lastEventTime;
    }

    public void setLastEventTime(String lastEventTime) {
        this.lastEventTime = lastEventTime;
    }

    public boolean isJournalFound() {
        return journalFound;
    }

    public void setJournalFound(boolean journalFound) {
        this.journalFound = journalFound;
    }

    public String getJournalPath() {
        return journalPath;
    }

    public void setJournalPath(String journalPath) {
        this.journalPath = journalPath;
    }

    public String getJournalFile() {
        return journalFile;
    }

    public void setJournalFile(String journalFile) {
        this.journalFile = journalFile;
    }

    public long getSystemChangeTimestamp() {
        return systemChangeTimestamp;
    }

    public void setSystemChangeTimestamp(long systemChangeTimestamp) {
        this.systemChangeTimestamp = systemChangeTimestamp;
    }

    public static String formatShipName(String raw) {
        if (raw == null || raw.isBlank()) return "Nave";
        String lower = raw.toLowerCase().trim();
        return switch (lower) {
            case "krait_mkii" -> "Krait Mk II";
            case "krait_light" -> "Krait Phantom";
            case "cobramkiii" -> "Cobra Mk III";
            case "cobramkiv" -> "Cobra Mk IV";
            case "viper" -> "Viper Mk III";
            case "viper_mkiv" -> "Viper Mk IV";
            case "asp" -> "Asp Explorer";
            case "asp_scout" -> "Asp Scout";
            case "anaconda" -> "Anaconda";
            case "python" -> "Python";
            case "python_nx" -> "Python Mk II";
            case "cutter" -> "Imperial Cutter";
            case "clipper" -> "Imperial Clipper";
            case "courier" -> "Imperial Courier";
            case "type6" -> "Type-6 Transporter";
            case "type7" -> "Type-7 Transporter";
            case "type9" -> "Type-9 Heavy";
            case "type10" -> "Type-10 Defender";
            case "federation_corvette" -> "Federal Corvette";
            case "federation_dropship" -> "Federal Dropship";
            case "federation_gunship" -> "Federal Gunship";
            case "federation_assault_ship" -> "Federal Assault Ship";
            case "diamondbackxl" -> "Diamondback Explorer";
            case "diamondback" -> "Diamondback Scout";
            case "dolphin" -> "Dolphin";
            case "orca" -> "Orca";
            case "belugaliner" -> "Beluga Liner";
            case "hauler" -> "Hauler";
            case "adder" -> "Adder";
            case "sidewinder" -> "Sidewinder";
            case "eagle" -> "Eagle";
            case "empire_eagle" -> "Imperial Eagle";
            case "ferdelance" -> "Fer-de-Lance";
            case "mamba" -> "Mamba";
            case "keelback" -> "Keelback";
            case "alliance_chieftain" -> "Alliance Chieftain";
            case "alliance_crusader" -> "Alliance Crusader";
            case "alliance_challenger" -> "Alliance Challenger";
            case "mandalay" -> "Mandalay";
            default -> {
                String clean = raw.replace("_", " ");
                yield Character.toUpperCase(clean.charAt(0)) + clean.substring(1);
            }
        };
    }
}
