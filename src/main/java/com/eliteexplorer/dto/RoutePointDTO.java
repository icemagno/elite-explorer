package com.eliteexplorer.dto;

public class RoutePointDTO {
    private String starSystem;
    private double x;
    private double y;
    private double z;
    private String starClass;

    public RoutePointDTO() {
    }

    public RoutePointDTO(String starSystem, double x, double y, double z, String starClass) {
        this.starSystem = starSystem;
        this.x = x;
        this.y = y;
        this.z = z;
        this.starClass = starClass;
    }

    public String getStarSystem() {
        return starSystem;
    }

    public void setStarSystem(String starSystem) {
        this.starSystem = starSystem;
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

    public String getStarClass() {
        return starClass;
    }

    public void setStarClass(String starClass) {
        this.starClass = starClass;
    }
}
