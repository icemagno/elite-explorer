package com.eliteexplorer.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class StarSystemDTO {
    private String name;
    private double x;
    private double y;
    private double z;
    private double distance;
    private Integer bodyCount;
    private boolean coordsLocked;
    private String starType;
    private Boolean isScoopable;
    private Long population = 0L;
    private boolean inhabited = false;
    private java.util.List<StratumCandidateDTO> stratumCandidates = new java.util.ArrayList<>();

    public StarSystemDTO() {
    }

    public Long getPopulation() {
        return population != null ? population : 0L;
    }

    public void setPopulation(Long population) {
        this.population = population;
        if (population != null && population > 0) {
            this.inhabited = true;
        }
    }

    public boolean isInhabited() {
        return inhabited || (population != null && population > 0);
    }

    public void setInhabited(boolean inhabited) {
        this.inhabited = inhabited;
    }

    public java.util.List<StratumCandidateDTO> getStratumCandidates() {
        return stratumCandidates;
    }

    public void setStratumCandidates(java.util.List<StratumCandidateDTO> stratumCandidates) {
        this.stratumCandidates = stratumCandidates;
    }

    public boolean isHasStratumConfirmed() {
        if (stratumCandidates == null || stratumCandidates.isEmpty()) return false;
        for (StratumCandidateDTO c : stratumCandidates) {
            if (c.isConfirmed()) return true;
        }
        return false;
    }

    public boolean isHasStratumCandidate() {
        if (stratumCandidates == null || stratumCandidates.isEmpty()) return false;
        for (StratumCandidateDTO c : stratumCandidates) {
            if (!c.isConfirmed()) return true;
        }
        return false;
    }

    public void addStratumCandidate(StratumCandidateDTO candidate) {
        if (this.stratumCandidates == null) {
            this.stratumCandidates = new java.util.ArrayList<>();
        }
        // Evita duplicatas do mesmo planeta
        this.stratumCandidates.removeIf(c -> c.getPlanetName() != null && c.getPlanetName().equalsIgnoreCase(candidate.getPlanetName()));
        this.stratumCandidates.add(candidate);
    }

    public StarSystemDTO(String name, double x, double y, double z, double distance, Integer bodyCount) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
        this.distance = distance;
        this.bodyCount = bodyCount;
    }

    public StarSystemDTO(String name, double x, double y, double z, String starType, double distance) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
        this.starType = starType;
        this.distance = distance;
    }

    public String getStarType() {
        return starType;
    }

    public void setStarType(String starType) {
        this.starType = starType;
    }

    public Boolean getIsScoopable() {
        return isScoopable;
    }

    public void setIsScoopable(Boolean isScoopable) {
        this.isScoopable = isScoopable;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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

    public double getDistance() {
        return distance;
    }

    public void setDistance(double distance) {
        this.distance = distance;
    }

    public Integer getBodyCount() {
        return bodyCount;
    }

    public void setBodyCount(Integer bodyCount) {
        this.bodyCount = bodyCount;
    }

    public boolean isCoordsLocked() {
        return coordsLocked;
    }

    public void setCoordsLocked(boolean coordsLocked) {
        this.coordsLocked = coordsLocked;
    }
}
