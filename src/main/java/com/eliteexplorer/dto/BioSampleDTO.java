package com.eliteexplorer.dto;

public class BioSampleDTO {

    private int sampleNumber; // 1, 2 ou 3
    private String scanType; // Log, Sample, Analyse
    private String genus;
    private String species;
    private String variant;
    private double latitude;
    private double longitude;
    private long timestamp;
    private long baseValue;
    private long bonusValue;
    private double minColonyDistance; // em metros

    public BioSampleDTO() {
    }

    public BioSampleDTO(int sampleNumber, String scanType, String genus, String species, String variant,
                        double latitude, double longitude, long timestamp, long baseValue, double minColonyDistance) {
        this.sampleNumber = sampleNumber;
        this.scanType = scanType;
        this.genus = genus != null ? genus : "Desconhecido";
        this.species = species != null ? species : "Espécie Biológica";
        this.variant = variant != null ? variant : "";
        this.latitude = latitude;
        this.longitude = longitude;
        this.timestamp = timestamp;
        this.baseValue = baseValue > 0 ? baseValue : 19010800L;
        this.bonusValue = this.baseValue * 4;
        this.minColonyDistance = minColonyDistance > 0 ? minColonyDistance : 500.0;
    }

    public int getSampleNumber() {
        return sampleNumber;
    }

    public void setSampleNumber(int sampleNumber) {
        this.sampleNumber = sampleNumber;
    }

    public String getScanType() {
        return scanType;
    }

    public void setScanType(String scanType) {
        this.scanType = scanType;
    }

    public String getGenus() {
        return genus;
    }

    public void setGenus(String genus) {
        this.genus = genus;
    }

    public String getSpecies() {
        return species;
    }

    public void setSpecies(String species) {
        this.species = species;
    }

    public String getVariant() {
        return variant;
    }

    public void setVariant(String variant) {
        this.variant = variant;
    }

    public double getLatitude() {
        return latitude;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public long getBaseValue() {
        return baseValue;
    }

    public void setBaseValue(long baseValue) {
        this.baseValue = baseValue;
    }

    public long getBonusValue() {
        return bonusValue;
    }

    public void setBonusValue(long bonusValue) {
        this.bonusValue = bonusValue;
    }

    public double getMinColonyDistance() {
        return minColonyDistance;
    }

    public void setMinColonyDistance(double minColonyDistance) {
        this.minColonyDistance = minColonyDistance;
    }

    public static double getOfficialColonyDistance(String genus) {
        if (genus == null) return 500.0;
        String g = genus.toLowerCase().trim();
        return switch (g) {
            case "stratum" -> 500.0;
            case "recepta", "concha", "aleoida", "clypeus", "frutexa" -> 150.0;
            case "tussock" -> 200.0;
            case "cactoida", "fungoida" -> 300.0;
            case "bacterium", "fonticula" -> 500.0;
            case "tubus", "osseus" -> 800.0;
            default -> 500.0;
        };
    }

    public static long getOfficialBaseValue(String species, String genus) {
        if (species != null && species.toLowerCase().contains("stratum tectonicas")) {
            return 19010800L;
        }
        if (species != null && species.toLowerCase().contains("recepta deltahedron")) {
            return 16035000L;
        }
        if (species != null && species.toLowerCase().contains("clypeus speculoculum")) {
            return 8418000L;
        }
        if (genus != null) {
            String g = genus.toLowerCase().trim();
            return switch (g) {
                case "stratum" -> 19010800L;
                case "recepta" -> 16035000L;
                case "clypeus" -> 8418000L;
                case "tubus" -> 7420000L;
                case "frutexa" -> 7747000L;
                case "cactoida" -> 4000000L;
                case "tussock" -> 3500000L;
                case "fungoida" -> 2500000L;
                case "concha" -> 2200000L;
                case "osseus" -> 2000000L;
                case "bacterium" -> 1000000L;
                default -> 5000000L;
            };
        }
        return 19010800L;
    }
}
