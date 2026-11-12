package com.quaternity.server.model;

public enum GameState {
    LOBBY("Sala de Espera"),
    RUNNING("Em Andamento"),
    PAUSED("Pausada"),
    GAME_OVER("Finalizada"),
    ABORTED("Cancelada");

    private final String description;

    GameState(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
