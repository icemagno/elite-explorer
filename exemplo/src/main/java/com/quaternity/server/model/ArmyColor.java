package com.quaternity.server.model;

public enum ArmyColor {
    WHITE("Branco", "#CCD4CA", "#0f172a"),
    RED("Vermelho", "#9D0400", "#ffffff"),
    BLACK("Preto", "#000000", "#ffffff"),
    GREEN("Verde", "#26C000", "#ffffff");

    private final String displayName;
    private final String hexColor;
    private final String textColor;

    ArmyColor(String displayName, String hexColor, String textColor) {
        this.displayName = displayName;
        this.hexColor = hexColor;
        this.textColor = textColor;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getHexColor() {
        return hexColor;
    }

    public String getTextColor() {
        return textColor;
    }

    /**
     * Retorna a próxima cor na ordem canônica do Quaternity:
     * Branco -> Vermelho -> Preto -> Verde -> Branco...
     */
    public ArmyColor nextCanonical() {
        return switch (this) {
            case WHITE -> RED;
            case RED -> BLACK;
            case BLACK -> GREEN;
            case GREEN -> WHITE;
        };
    }

    public static ArmyColor fromString(String value) {
        if (value == null) return null;
        String normalized = value.trim().toUpperCase();
        for (ArmyColor color : values()) {
            if (color.name().equals(normalized) || color.displayName.equalsIgnoreCase(normalized)) {
                return color;
            }
        }
        return null;
    }
}
