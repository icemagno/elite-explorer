package com.eliteexplorer.dto;

public class TrafficEventDTO {
    private String id;
    private String type; // "JUMP_IN" ou "JUMP_OUT"
    private String systemName;
    private double x;
    private double y;
    private double z;
    private long timestamp;
    private String commander;
    private String source; // "EDDN" ou "LOCAL"

    public TrafficEventDTO() {
    }

    public TrafficEventDTO(String id, String type, String systemName, double x, double y, double z, long timestamp, String commander, String source) {
        this.id = id;
        this.type = type;
        this.systemName = systemName;
        this.x = x;
        this.y = y;
        this.z = z;
        this.timestamp = timestamp;
        this.commander = commander;
        this.source = source;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getSystemName() {
        return systemName;
    }

    public void setSystemName(String systemName) {
        this.systemName = systemName;
    }

    public double getX() {
        return x;
    }

    public void setX(double x) {
        this.x = x;
    }

    public double getY() {
        return y;
    }

    public void setY(double y) {
        this.y = y;
    }

    public double getZ() {
        return z;
    }

    public void setZ(double z) {
        this.z = z;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public String getCommander() {
        return commander;
    }

    public void setCommander(String commander) {
        this.commander = commander;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
