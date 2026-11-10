package com.eliteexplorer.dto;

public class StratumCandidateDTO {
    private String planetName;
    private String atmosphere;
    private double gravity;
    private int distanceLs;
    private boolean isFirstDiscovery; // true se não tiver comandante registrado no EDSM
    private boolean isConfirmed;      // true se confirmado no Spansh / EDDN
    private long valueCredits;        // Valor confirmado (ex: 19010800)
    private String species;           // ex: "Stratum Tectonicas"
    private long bodyId64;            // ID64 único do corpo celeste para validação no Spansh
    private Integer bioSignalsCount;  // Quantidade de sinais biológicos (se escaneado/mapeado)
    private double surfaceTemperature; // Temperatura média de superfície (Kelvin)
    private boolean wasMapped;        // true se alguém já mapeou com DSS ou enviou sinais à EDDN
    private boolean alreadyCollected = false; // true se o comandante já coletou Stratum aqui
    private String collectedDate;
    private boolean alreadyLanded = false;    // true se o comandante já pousou aqui
    private String landedDate;

    public StratumCandidateDTO() {
    }

    public StratumCandidateDTO(String planetName, String atmosphere, double gravity, int distanceLs, boolean isFirstDiscovery) {
        this(planetName, atmosphere, gravity, distanceLs, isFirstDiscovery, false, 0, null, 0L);
    }

    public StratumCandidateDTO(String planetName, String atmosphere, double gravity, int distanceLs, boolean isFirstDiscovery, boolean isConfirmed, long valueCredits, String species) {
        this(planetName, atmosphere, gravity, distanceLs, isFirstDiscovery, isConfirmed, valueCredits, species, 0L);
    }

    public StratumCandidateDTO(String planetName, String atmosphere, double gravity, int distanceLs, boolean isFirstDiscovery, boolean isConfirmed, long valueCredits, String species, long bodyId64) {
        this.planetName = planetName;
        this.atmosphere = atmosphere;
        this.gravity = gravity;
        this.distanceLs = distanceLs;
        this.isFirstDiscovery = isFirstDiscovery;
        this.isConfirmed = isConfirmed;
        this.valueCredits = valueCredits;
        this.species = species != null ? species : "Stratum Tectonicas";
        this.bodyId64 = bodyId64;
    }

    public long getBodyId64() {
        return bodyId64;
    }

    public void setBodyId64(long bodyId64) {
        this.bodyId64 = bodyId64;
    }

    public String getPlanetName() {
        return planetName;
    }

    public void setPlanetName(String planetName) {
        this.planetName = planetName;
    }

    public String getAtmosphere() {
        return atmosphere;
    }

    public void setAtmosphere(String atmosphere) {
        this.atmosphere = atmosphere;
    }

    public double getGravity() {
        return gravity;
    }

    public void setGravity(double gravity) {
        this.gravity = gravity;
    }

    public int getDistanceLs() {
        return distanceLs;
    }

    public void setDistanceLs(int distanceLs) {
        this.distanceLs = distanceLs;
    }

    public boolean isFirstDiscovery() {
        return isFirstDiscovery;
    }

    public void setFirstDiscovery(boolean firstDiscovery) {
        isFirstDiscovery = firstDiscovery;
    }

    public boolean isConfirmed() {
        return isConfirmed;
    }

    public void setConfirmed(boolean confirmed) {
        isConfirmed = confirmed;
    }

    public long getValueCredits() {
        return valueCredits;
    }

    public void setValueCredits(long valueCredits) {
        this.valueCredits = valueCredits;
    }

    public String getSpecies() {
        return species;
    }

    public void setSpecies(String species) {
        this.species = species;
    }

    public Integer getBioSignalsCount() {
        return bioSignalsCount;
    }

    public void setBioSignalsCount(Integer bioSignalsCount) {
        this.bioSignalsCount = bioSignalsCount;
    }

    public double getSurfaceTemperature() {
        return surfaceTemperature;
    }

    public void setSurfaceTemperature(double surfaceTemperature) {
        this.surfaceTemperature = surfaceTemperature;
    }

    public boolean isWasMapped() {
        return wasMapped;
    }

    public void setWasMapped(boolean wasMapped) {
        this.wasMapped = wasMapped;
    }

    public boolean isAlreadyCollected() {
        return alreadyCollected;
    }

    public void setAlreadyCollected(boolean alreadyCollected) {
        this.alreadyCollected = alreadyCollected;
    }

    public String getCollectedDate() {
        return collectedDate;
    }

    public void setCollectedDate(String collectedDate) {
        this.collectedDate = collectedDate;
    }

    public boolean isAlreadyLanded() {
        return alreadyLanded;
    }

    public void setAlreadyLanded(boolean alreadyLanded) {
        this.alreadyLanded = alreadyLanded;
    }

    public String getLandedDate() {
        return landedDate;
    }

    public void setLandedDate(String landedDate) {
        this.landedDate = landedDate;
    }
}
