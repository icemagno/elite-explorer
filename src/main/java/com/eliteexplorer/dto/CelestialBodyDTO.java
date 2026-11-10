package com.eliteexplorer.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class CelestialBodyDTO {

    private Long id64;
    private Integer bodyId;
    private String name;
    private String type; // "Star", "Planet"
    private String subType; // "G (White-Yellow) Star", "High metal content world", etc.
    private Integer parentId; // ID of the parent body (null if root star)
    private String parentType; // "Star", "Planet", "Null"
    private Double distanceToArrival; // em Ls
    private Boolean isLandable;
    private Double gravity; // em G
    private Double radius; // em km
    private Double earthMasses;
    private Double surfaceTemperature; // em K
    private Double surfacePressure; // em atm
    private String atmosphereType;
    private String volcanismType;
    private String terraformingState;

    // Parâmetros Orbitais Keplerianos
    private Double semiMajorAxis; // valor original (AU ou metros)
    private Double semiMajorAxisAu; // padronizado em AU
    private Double orbitalEccentricity; // 0.0 a 1.0
    private Double orbitalInclination; // em graus
    private Double argOfPeriapsis; // em graus
    private Double ascendingNode; // em graus (longitude do nó ascendente)
    private Double meanAnomaly; // em graus (anomalia média)
    private Long scanTimeMs; // Epoch millis do scan (para propagação temporal exata)
    private Double orbitalPeriod; // em dias
    private Double rotationalPeriod; // em dias
    private Boolean rotationalPeriodTidallyLocked;
    private Double axialTilt; // em graus

    // Propriedades Estelares
    private Boolean isMainStar;
    private String spectralClass;
    private String luminosity;
    private Double absoluteMagnitude;
    private Double solarMasses;
    private Double solarRadius;
    private Boolean isScoopable;

    // Anéis e Materiais
    private List<BodyRingDTO> rings = new ArrayList<>();
    private List<BodyRingDTO> belts = new ArrayList<>();
    private Map<String, Double> materials;

    // Sinais DSS & Exploração
    private Integer bioSignalsCount;
    private Integer geoSignalsCount;
    private Integer humanSignalsCount;
    private Boolean wasDiscovered;
    private Boolean wasMapped;

    public CelestialBodyDTO() {
    }

    public static class BodyRingDTO {
        private String name;
        private String type; // "Rocky", "Icy", "Metallic", "Metal Rich"
        private Double mass;
        private Double innerRadius; // em km
        private Double outerRadius; // em km

        public BodyRingDTO() {
        }

        public BodyRingDTO(String name, String type, Double mass, Double innerRadius, Double outerRadius) {
            this.name = name;
            this.type = type;
            this.mass = mass;
            this.innerRadius = innerRadius;
            this.outerRadius = outerRadius;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Double getMass() { return mass; }
        public void setMass(Double mass) { this.mass = mass; }
        public Double getInnerRadius() { return innerRadius; }
        public void setInnerRadius(Double innerRadius) { this.innerRadius = innerRadius; }
        public Double getOuterRadius() { return outerRadius; }
        public void setOuterRadius(Double outerRadius) { this.outerRadius = outerRadius; }
    }

    // Getters e Setters
    public Long getId64() { return id64; }
    public void setId64(Long id64) { this.id64 = id64; }

    public Integer getBodyId() { return bodyId; }
    public void setBodyId(Integer bodyId) { this.bodyId = bodyId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSubType() { return subType; }
    public void setSubType(String subType) { this.subType = subType; }

    public Integer getParentId() { return parentId; }
    public void setParentId(Integer parentId) { this.parentId = parentId; }

    public String getParentType() { return parentType; }
    public void setParentType(String parentType) { this.parentType = parentType; }

    public Double getDistanceToArrival() { return distanceToArrival; }
    public void setDistanceToArrival(Double distanceToArrival) { this.distanceToArrival = distanceToArrival; }

    public Boolean getIsLandable() { return isLandable; }
    public void setIsLandable(Boolean isLandable) { this.isLandable = isLandable; }

    public Double getGravity() { return gravity; }
    public void setGravity(Double gravity) { this.gravity = gravity; }

    public Double getRadius() { return radius; }
    public void setRadius(Double radius) { this.radius = radius; }

    public Double getEarthMasses() { return earthMasses; }
    public void setEarthMasses(Double earthMasses) { this.earthMasses = earthMasses; }

    public Double getSurfaceTemperature() { return surfaceTemperature; }
    public void setSurfaceTemperature(Double surfaceTemperature) { this.surfaceTemperature = surfaceTemperature; }

    public Double getSurfacePressure() { return surfacePressure; }
    public void setSurfacePressure(Double surfacePressure) { this.surfacePressure = surfacePressure; }

    public String getAtmosphereType() { return atmosphereType; }
    public void setAtmosphereType(String atmosphereType) { this.atmosphereType = atmosphereType; }

    public String getVolcanismType() { return volcanismType; }
    public void setVolcanismType(String volcanismType) { this.volcanismType = volcanismType; }

    public String getTerraformingState() { return terraformingState; }
    public void setTerraformingState(String terraformingState) { this.terraformingState = terraformingState; }

    public Double getSemiMajorAxis() { return semiMajorAxis; }
    public void setSemiMajorAxis(Double semiMajorAxis) { this.semiMajorAxis = semiMajorAxis; }

    public Double getSemiMajorAxisAu() { return semiMajorAxisAu; }
    public void setSemiMajorAxisAu(Double semiMajorAxisAu) { this.semiMajorAxisAu = semiMajorAxisAu; }

    public Double getOrbitalEccentricity() { return orbitalEccentricity; }
    public void setOrbitalEccentricity(Double orbitalEccentricity) { this.orbitalEccentricity = orbitalEccentricity; }

    public Double getOrbitalInclination() { return orbitalInclination; }
    public void setOrbitalInclination(Double orbitalInclination) { this.orbitalInclination = orbitalInclination; }

    public Double getArgOfPeriapsis() { return argOfPeriapsis; }
    public void setArgOfPeriapsis(Double argOfPeriapsis) { this.argOfPeriapsis = argOfPeriapsis; }

    public Double getAscendingNode() { return ascendingNode; }
    public void setAscendingNode(Double ascendingNode) { this.ascendingNode = ascendingNode; }

    public Double getMeanAnomaly() { return meanAnomaly; }
    public void setMeanAnomaly(Double meanAnomaly) { this.meanAnomaly = meanAnomaly; }

    public Long getScanTimeMs() { return scanTimeMs; }
    public void setScanTimeMs(Long scanTimeMs) { this.scanTimeMs = scanTimeMs; }

    public Double getOrbitalPeriod() { return orbitalPeriod; }
    public void setOrbitalPeriod(Double orbitalPeriod) { this.orbitalPeriod = orbitalPeriod; }

    public Double getRotationalPeriod() { return rotationalPeriod; }
    public void setRotationalPeriod(Double rotationalPeriod) { this.rotationalPeriod = rotationalPeriod; }

    public Boolean getRotationalPeriodTidallyLocked() { return rotationalPeriodTidallyLocked; }
    public void setRotationalPeriodTidallyLocked(Boolean rotationalPeriodTidallyLocked) { this.rotationalPeriodTidallyLocked = rotationalPeriodTidallyLocked; }

    public Double getAxialTilt() { return axialTilt; }
    public void setAxialTilt(Double axialTilt) { this.axialTilt = axialTilt; }

    public Boolean getIsMainStar() { return isMainStar; }
    public void setIsMainStar(Boolean isMainStar) { this.isMainStar = isMainStar; }

    public String getSpectralClass() { return spectralClass; }
    public void setSpectralClass(String spectralClass) { this.spectralClass = spectralClass; }

    public String getLuminosity() { return luminosity; }
    public void setLuminosity(String luminosity) { this.luminosity = luminosity; }

    public Double getAbsoluteMagnitude() { return absoluteMagnitude; }
    public void setAbsoluteMagnitude(Double absoluteMagnitude) { this.absoluteMagnitude = absoluteMagnitude; }

    public Double getSolarMasses() { return solarMasses; }
    public void setSolarMasses(Double solarMasses) { this.solarMasses = solarMasses; }

    public Double getSolarRadius() { return solarRadius; }
    public void setSolarRadius(Double solarRadius) { this.solarRadius = solarRadius; }

    public Boolean getIsScoopable() { return isScoopable; }
    public void setIsScoopable(Boolean isScoopable) { this.isScoopable = isScoopable; }

    public List<BodyRingDTO> getRings() { return rings; }
    public void setRings(List<BodyRingDTO> rings) { this.rings = rings; }

    public List<BodyRingDTO> getBelts() { return belts; }
    public void setBelts(List<BodyRingDTO> belts) { this.belts = belts; }

    public Map<String, Double> getMaterials() { return materials; }
    public void setMaterials(Map<String, Double> materials) { this.materials = materials; }

    public Integer getBioSignalsCount() { return bioSignalsCount; }
    public void setBioSignalsCount(Integer bioSignalsCount) { this.bioSignalsCount = bioSignalsCount; }

    public Integer getGeoSignalsCount() { return geoSignalsCount; }
    public void setGeoSignalsCount(Integer geoSignalsCount) { this.geoSignalsCount = geoSignalsCount; }

    public Integer getHumanSignalsCount() { return humanSignalsCount; }
    public void setHumanSignalsCount(Integer humanSignalsCount) { this.humanSignalsCount = humanSignalsCount; }

    public Boolean getWasDiscovered() { return wasDiscovered; }
    public void setWasDiscovered(Boolean wasDiscovered) { this.wasDiscovered = wasDiscovered; }

    public Boolean getWasMapped() { return wasMapped; }
    public void setWasMapped(Boolean wasMapped) { this.wasMapped = wasMapped; }
}
