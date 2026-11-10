package com.eliteexplorer.dto;

public class VoidSectorDTO {
    private String id;
    private double centerX;
    private double centerY;
    private double centerZ;
    private double size;
    private double expectedDensity;
    private double voidScore; // 0.0 a 1.0 (probabilidade de ser um vazio inexplorado)
    private int neighborCount;
    private double distanceToPlayer; // Distância do centro do vazio até a nave
    private String waypointSystemName; // Sistema mais próximo da borda na direção do jogador
    private double waypointDistanceToPlayer; // Distância desse waypoint até a nave
    private double waypointDistanceToVoid; // Distância desse waypoint até o centro do vazio
    private Double waypointX;
    private Double waypointY;
    private Double waypointZ;

    // Metadados da Quebra de Sequência Procedural (Stellar Forge)
    private String systemName;        // Nome exato previsto: "Synuefe HC-L a76-2"
    private String boxPrefix;         // Prefixo da caixa: "Synuefe HC-L a76-"
    private String massCode;          // Código de massa: "A", "B", "C", "D"
    private double accuracyLy;        // Precisão da caixa em ly (10, 20, 40)
    private int missingSequence;      // Número da sequência ausente (ex: 2)
    private int knownSiblingCount;    // Quantidade de sistemas irmãos conhecidos (ex: 3)
    private String siblingsSample;    // Ex: "a76-0, a76-1, a76-3"

    public VoidSectorDTO() {
    }

    public double getDistanceToPlayer() {
        return distanceToPlayer;
    }

    public void setDistanceToPlayer(double distanceToPlayer) {
        this.distanceToPlayer = distanceToPlayer;
    }

    public String getWaypointSystemName() {
        return waypointSystemName;
    }

    public void setWaypointSystemName(String waypointSystemName) {
        this.waypointSystemName = waypointSystemName;
    }

    public double getWaypointDistanceToPlayer() {
        return waypointDistanceToPlayer;
    }

    public void setWaypointDistanceToPlayer(double waypointDistanceToPlayer) {
        this.waypointDistanceToPlayer = waypointDistanceToPlayer;
    }

    public double getWaypointDistanceToVoid() {
        return waypointDistanceToVoid;
    }

    public void setWaypointDistanceToVoid(double waypointDistanceToVoid) {
        this.waypointDistanceToVoid = waypointDistanceToVoid;
    }

    public Double getWaypointX() {
        return waypointX;
    }

    public void setWaypointX(Double waypointX) {
        this.waypointX = waypointX;
    }

    public Double getWaypointY() {
        return waypointY;
    }

    public void setWaypointY(Double waypointY) {
        this.waypointY = waypointY;
    }

    public Double getWaypointZ() {
        return waypointZ;
    }

    public void setWaypointZ(Double waypointZ) {
        this.waypointZ = waypointZ;
    }

    public VoidSectorDTO(String id, double centerX, double centerY, double centerZ, double size, double expectedDensity, double voidScore, int neighborCount) {
        this.id = id;
        this.centerX = centerX;
        this.centerY = centerY;
        this.centerZ = centerZ;
        this.size = size;
        this.expectedDensity = expectedDensity;
        this.voidScore = voidScore;
        this.neighborCount = neighborCount;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public double getCenterX() {
        return centerX;
    }

    public void setCenterX(double centerX) {
        this.centerX = centerX;
    }

    public double getCenterY() {
        return centerY;
    }

    public void setCenterY(double centerY) {
        this.centerY = centerY;
    }

    public double getCenterZ() {
        return centerZ;
    }

    public void setCenterZ(double centerZ) {
        this.centerZ = centerZ;
    }

    public double getSize() {
        return size;
    }

    public void setSize(double size) {
        this.size = size;
    }

    public double getExpectedDensity() {
        return expectedDensity;
    }

    public void setExpectedDensity(double expectedDensity) {
        this.expectedDensity = expectedDensity;
    }

    public double getVoidScore() {
        return voidScore;
    }

    public void setVoidScore(double voidScore) {
        this.voidScore = voidScore;
    }

    public int getNeighborCount() {
        return neighborCount;
    }

    public void setNeighborCount(int neighborCount) {
        this.neighborCount = neighborCount;
    }

    public String getSystemName() {
        return systemName;
    }

    public void setSystemName(String systemName) {
        this.systemName = systemName;
    }

    public String getBoxPrefix() {
        return boxPrefix;
    }

    public void setBoxPrefix(String boxPrefix) {
        this.boxPrefix = boxPrefix;
    }

    public String getMassCode() {
        return massCode;
    }

    public void setMassCode(String massCode) {
        this.massCode = massCode;
    }

    public double getAccuracyLy() {
        return accuracyLy;
    }

    public void setAccuracyLy(double accuracyLy) {
        this.accuracyLy = accuracyLy;
    }

    public int getMissingSequence() {
        return missingSequence;
    }

    public void setMissingSequence(int missingSequence) {
        this.missingSequence = missingSequence;
    }

    public int getKnownSiblingCount() {
        return knownSiblingCount;
    }

    public void setKnownSiblingCount(int knownSiblingCount) {
        this.knownSiblingCount = knownSiblingCount;
    }

    public String getSiblingsSample() {
        return siblingsSample;
    }

    public void setSiblingsSample(String siblingsSample) {
        this.siblingsSample = siblingsSample;
    }
}
