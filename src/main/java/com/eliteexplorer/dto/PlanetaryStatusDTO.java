package com.eliteexplorer.dto;

import java.util.ArrayList;
import java.util.List;

public class PlanetaryStatusDTO {

    private boolean onPlanetSurface = false;
    private boolean inPlanetaryOrbit = false;
    private boolean landed = false;
    private boolean inSrv = false;
    private boolean onFoot = false;
    private boolean glideMode = false;

    private String commander = "";
    private String currentSystem = "";
    private String bodyName = "";
    private Integer bodyId = null;
    private Double latitude = 0.0;
    private Double longitude = 0.0;
    private Double altitude = 0.0;
    private Double heading = 0.0;
    private Double surfaceGravity = 0.0;
    private String atmosphereType = "";
    private Double planetRadius = null;

    private Double touchdownLat = null;
    private Double touchdownLong = null;
    private Double distanceToTouchdown = null; // em metros

    private List<BioSampleDTO> activeBioSamples = new ArrayList<>();
    private BioSampleDTO lastBioSample = null;
    private Double distanceToLastBioSample = null; // em metros
    private Boolean geneticDiversityReached = null;

    private List<SurfaceFeatureDTO> surfaceFeatures = new ArrayList<>();
    private Integer bioSignalsCount = null;
    private Integer geoSignalsCount = null;
    private Integer humanSignalsCount = null;
    private Integer miningSignalsCount = null;

    private long lastUpdateTimestamp = System.currentTimeMillis();

    public PlanetaryStatusDTO() {
    }

    public boolean isOnPlanetSurface() {
        return onPlanetSurface;
    }

    public void setOnPlanetSurface(boolean onPlanetSurface) {
        this.onPlanetSurface = onPlanetSurface;
    }

    public boolean isInPlanetaryOrbit() {
        return inPlanetaryOrbit;
    }

    public void setInPlanetaryOrbit(boolean inPlanetaryOrbit) {
        this.inPlanetaryOrbit = inPlanetaryOrbit;
    }

    public boolean isLanded() {
        return landed;
    }

    public void setLanded(boolean landed) {
        this.landed = landed;
    }

    public boolean isInSrv() {
        return inSrv;
    }

    public void setInSrv(boolean inSrv) {
        this.inSrv = inSrv;
    }

    public boolean isOnFoot() {
        return onFoot;
    }

    public void setOnFoot(boolean onFoot) {
        this.onFoot = onFoot;
    }

    public boolean isGlideMode() {
        return glideMode;
    }

    public void setGlideMode(boolean glideMode) {
        this.glideMode = glideMode;
    }

    public String getCommander() {
        return commander;
    }

    public void setCommander(String commander) {
        this.commander = commander;
    }

    public String getCurrentSystem() {
        return currentSystem;
    }

    public void setCurrentSystem(String currentSystem) {
        this.currentSystem = currentSystem;
    }

    public String getBodyName() {
        return bodyName;
    }

    public void setBodyName(String bodyName) {
        this.bodyName = bodyName;
    }

    public Integer getBodyId() {
        return bodyId;
    }

    public void setBodyId(Integer bodyId) {
        this.bodyId = bodyId;
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

    public Double getAltitude() {
        return altitude;
    }

    public void setAltitude(Double altitude) {
        this.altitude = altitude;
    }

    public Double getHeading() {
        return heading;
    }

    public void setHeading(Double heading) {
        this.heading = heading;
    }

    public Double getSurfaceGravity() {
        return surfaceGravity;
    }

    public void setSurfaceGravity(Double surfaceGravity) {
        this.surfaceGravity = surfaceGravity;
    }

    public String getAtmosphereType() {
        return atmosphereType;
    }

    public void setAtmosphereType(String atmosphereType) {
        this.atmosphereType = atmosphereType;
    }

    public Double getPlanetRadius() {
        return planetRadius;
    }

    public void setPlanetRadius(Double planetRadius) {
        this.planetRadius = planetRadius;
    }

    public Double getTouchdownLat() {
        return touchdownLat;
    }

    public void setTouchdownLat(Double touchdownLat) {
        this.touchdownLat = touchdownLat;
    }

    public Double getTouchdownLong() {
        return touchdownLong;
    }

    public void setTouchdownLong(Double touchdownLong) {
        this.touchdownLong = touchdownLong;
    }

    public Double getDistanceToTouchdown() {
        return distanceToTouchdown;
    }

    public void setDistanceToTouchdown(Double distanceToTouchdown) {
        this.distanceToTouchdown = distanceToTouchdown;
    }

    public List<BioSampleDTO> getActiveBioSamples() {
        return activeBioSamples;
    }

    public void setActiveBioSamples(List<BioSampleDTO> activeBioSamples) {
        this.activeBioSamples = activeBioSamples != null ? activeBioSamples : new ArrayList<>();
    }

    public BioSampleDTO getLastBioSample() {
        return lastBioSample;
    }

    public void setLastBioSample(BioSampleDTO lastBioSample) {
        this.lastBioSample = lastBioSample;
    }

    public Double getDistanceToLastBioSample() {
        return distanceToLastBioSample;
    }

    public void setDistanceToLastBioSample(Double distanceToLastBioSample) {
        this.distanceToLastBioSample = distanceToLastBioSample;
    }

    public Boolean getGeneticDiversityReached() {
        return geneticDiversityReached;
    }

    public void setGeneticDiversityReached(Boolean geneticDiversityReached) {
        this.geneticDiversityReached = geneticDiversityReached;
    }

    public List<SurfaceFeatureDTO> getSurfaceFeatures() {
        return surfaceFeatures;
    }

    public void setSurfaceFeatures(List<SurfaceFeatureDTO> surfaceFeatures) {
        this.surfaceFeatures = surfaceFeatures != null ? surfaceFeatures : new ArrayList<>();
    }

    public Integer getBioSignalsCount() {
        return bioSignalsCount;
    }

    public void setBioSignalsCount(Integer bioSignalsCount) {
        this.bioSignalsCount = bioSignalsCount;
    }

    public Integer getGeoSignalsCount() {
        return geoSignalsCount;
    }

    public void setGeoSignalsCount(Integer geoSignalsCount) {
        this.geoSignalsCount = geoSignalsCount;
    }

    public Integer getHumanSignalsCount() {
        return humanSignalsCount;
    }

    public void setHumanSignalsCount(Integer humanSignalsCount) {
        this.humanSignalsCount = humanSignalsCount;
    }

    public Integer getMiningSignalsCount() {
        return miningSignalsCount;
    }

    public void setMiningSignalsCount(Integer miningSignalsCount) {
        this.miningSignalsCount = miningSignalsCount;
    }

    public long getLastUpdateTimestamp() {
        return lastUpdateTimestamp;
    }

    public void setLastUpdateTimestamp(long lastUpdateTimestamp) {
        this.lastUpdateTimestamp = lastUpdateTimestamp;
    }
}
