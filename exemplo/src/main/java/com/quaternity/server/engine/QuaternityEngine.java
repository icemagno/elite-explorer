package com.quaternity.server.engine;

import com.quaternity.server.model.ArmyColor;
import com.quaternity.server.model.GameState;
import com.quaternity.server.model.GameTable;
import com.quaternity.server.model.MoveRecord;
import com.quaternity.server.model.PlayerSlot;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Motor de Regras Oficiais do Quaternity Chess.
 * 
 * Implementa com exatidão as regras de tempo:
 * 1. Tempo total com desconto apenas na vez do exército ativo.
 * 2. Derrota por esgotamento de tempo (Time Forfeit) ao atingir 00:00.
 * 3. Incremento por lance (Fischer) creditado após cada jogada.
 * 4. Sinalização de Mate / Queda de bandeira com pausa momentânea automática.
 * 5. Omissão de turno: exércitos eliminados são saltados automaticamente.
 * 6. Detecção de vitória quando resta apenas 1 exército ativo.
 */
@Component
public class QuaternityEngine {

    public synchronized boolean startGame(GameTable table) {
        if (table == null || table.getState() != GameState.LOBBY) {
            return false;
        }

        int readyCount = table.getReadyCount();
        if (readyCount < 2) {
            return false; // Mínimo de 2 para início de partida
        }

        long now = System.currentTimeMillis();
        table.setStartedAt(now);
        table.setLastTimestamp(now + 1000L); // Carência oficial de 1 segundo para locução antes de decrementar
        table.setState(GameState.RUNNING);

        // Marca jogadores não conectados como Ausentes
        for (Map.Entry<ArmyColor, PlayerSlot> entry : table.getPlayers().entrySet()) {
            PlayerSlot slot = entry.getValue();
            if (!slot.isReady()) {
                slot.setAlive(false);
                slot.setEliminationReason("Ausente no início");
            }
        }

        // Define o primeiro jogador ativo (Branco se ativo, senão o primeiro na ordem canônica)
        PlayerSlot whiteSlot = table.getPlayers().get(ArmyColor.WHITE);
        if (whiteSlot != null && whiteSlot.isAlive()) {
            table.setActiveTurn(ArmyColor.WHITE);
        } else {
            table.setActiveTurn(getNextActivePlayer(table, ArmyColor.WHITE));
        }

        return true;
    }

    public synchronized MoveRecord processPlayerMove(GameTable table, ArmyColor color) {
        if (table == null || table.getState() != GameState.RUNNING) {
            return null;
        }

        // Valida se o jogador que clicou é o da vez
        if (color == null || color != table.getActiveTurn()) {
            return null;
        }

        long now = System.currentTimeMillis();
        updateElapsedTimeInternal(table, now);

        ArmyColor previousPlayer = table.getActiveTurn();
        PlayerSlot prevSlot = table.getPlayers().get(previousPlayer);

        long timeBeforeIncrement = prevSlot != null ? prevSlot.getRemainingMs() : 0;

        // Aplica o incremento Fischer (+N segundos ao exército que concluiu a jogada)
        if (prevSlot != null && prevSlot.isAlive()) {
            long incMs = table.getIncrementSeconds() * 1000L;
            prevSlot.setRemainingMs(prevSlot.getRemainingMs() + incMs);
        }

        // Avança o turno para o próximo jogador ativo
        ArmyColor nextPlayer = getNextActivePlayer(table, previousPlayer);
        table.setActiveTurn(nextPlayer);
        table.setLastTimestamp(now + 1000L); // Carência oficial de 1 segundo para locução antes de decrementar

        int moveNumber = table.getMovesHistory().size() + 1;
        MoveRecord record = new MoveRecord(
                moveNumber,
                previousPlayer,
                nextPlayer,
                now,
                prevSlot != null ? prevSlot.getRemainingMs() : 0,
                timeBeforeIncrement
        );
        table.getMovesHistory().add(record);

        return record;
    }

    public synchronized EngineEvent updateElapsedTime(GameTable table) {
        if (table == null || table.getState() != GameState.RUNNING) {
            return null;
        }

        long now = System.currentTimeMillis();
        long delta = now - table.getLastTimestamp();
        if (delta <= 0) {
            return null; // Ainda na carência de 1 segundo
        }
        table.setLastTimestamp(now);

        PlayerSlot currentSlot = table.getPlayers().get(table.getActiveTurn());
        if (currentSlot != null && currentSlot.isAlive()) {
            long newTime = Math.max(0, currentSlot.getRemainingMs() - delta);
            currentSlot.setRemainingMs(newTime);

            // Derrota por tempo (Time Forfeit)
            if (newTime <= 0) {
                ArmyColor timedOutColor = currentSlot.getColor();
                EngineEvent elimEvent = eliminatePlayer(table, timedOutColor, "timeout");
                // Pausa imediatamente para organização do tabuleiro físico
                table.setState(table.getState() == GameState.GAME_OVER ? GameState.GAME_OVER : GameState.PAUSED);
                return new EngineEvent(
                        EngineEventType.TIMEOUT,
                        timedOutColor,
                        table.getActiveTurn(),
                        elimEvent.isGameOver(),
                        elimEvent.getWinner(),
                        "Tempo esgotado! Exército " + timedOutColor.getDisplayName() + " eliminado por tempo."
                );
            }
        }

        return null;
    }

    public synchronized EngineEvent eliminatePlayer(GameTable table, ArmyColor color, String reason) {
        if (table == null || color == null) {
            return null;
        }

        PlayerSlot slot = table.getPlayers().get(color);
        if (slot == null || !slot.isAlive()) {
            return null;
        }

        // Converte códigos internos como FLAG_DROP para texto em português claro
        String cleanReason = (reason != null && !reason.trim().isEmpty()) ? reason.trim() : "Bandeira Baixada";
        if (cleanReason.equalsIgnoreCase("FLAG_DROP")) {
            cleanReason = "Bandeira Baixada";
        }

        slot.setAlive(false);
        slot.setEliminationReason(cleanReason);

        int aliveCount = table.getAliveCount();
        if (aliveCount <= 1) {
            table.setState(GameState.GAME_OVER);
            ArmyColor winner = table.getPlayers().values().stream()
                    .filter(PlayerSlot::isAlive)
                    .map(PlayerSlot::getColor)
                    .findFirst()
                    .orElse(null);
            table.setWinner(winner);

            return new EngineEvent(
                    EngineEventType.GAME_OVER,
                    color,
                    null,
                    true,
                    winner,
                    "Fim de jogo! Vitória do Exército " + (winner != null ? winner.getDisplayName() : "Nenhum")
            );
        }

        // Se o jogador eliminado era o da vez, passa imediatamente para o próximo
        if (table.getActiveTurn() == color) {
            table.setActiveTurn(getNextActivePlayer(table, color));
            table.setLastTimestamp(System.currentTimeMillis() + 1000L); // Carência oficial de 1 segundo para locução
        }

        // Conforme as regras: a partida é pausada momentaneamente
        table.setState(GameState.PAUSED);
        String pauseText;
        if (cleanReason.toLowerCase().contains("abandono")) {
            pauseText = "O exército " + color.getDisplayName() + " abandonou a partida e foi eliminado.";
        } else if (cleanReason.equalsIgnoreCase("Bandeira Baixada") || cleanReason.toLowerCase().contains("bandeira")) {
            pauseText = "O exército " + color.getDisplayName() + " teve sua bandeira baixada e foi eliminado da disputa.";
        } else {
            pauseText = "Exército " + color.getDisplayName() + " eliminado (" + cleanReason + ").";
        }
        table.setPauseReason(pauseText);

        return new EngineEvent(
                EngineEventType.ELIMINATION,
                color,
                table.getActiveTurn(),
                false,
                null,
                "Bandeira baixada! Exército " + color.getDisplayName() + " eliminado. Turno omitido."
        );
    }

    public synchronized boolean pauseGame(GameTable table, String reason) {
        if (table == null || table.getState() != GameState.RUNNING) {
            return false;
        }
        updateElapsedTimeInternal(table, System.currentTimeMillis());
        table.setState(GameState.PAUSED);
        table.setPauseReason(reason != null && !reason.trim().isEmpty() ? reason.trim() : "Partida pausada manualmente.");
        return true;
    }

    public synchronized boolean resumeGame(GameTable table) {
        if (table == null || table.getState() != GameState.PAUSED) {
            return false;
        }
        table.setLastTimestamp(System.currentTimeMillis() + 1000L); // Carência oficial de 1 segundo para locução
        table.setState(GameState.RUNNING);
        table.setPauseReason(null);
        return true;
    }

    public synchronized boolean abortGame(GameTable table) {
        if (table == null || table.getState() == GameState.ABORTED) {
            return false;
        }
        table.setState(GameState.ABORTED);
        return true;
    }

    public synchronized MoveRecord undoLastMove(GameTable table) {
        if (table == null || table.getMovesHistory().isEmpty()) {
            return null;
        }

        long now = System.currentTimeMillis();
        if (table.getState() == GameState.RUNNING) {
            updateElapsedTimeInternal(table, now);
        }

        List<MoveRecord> history = table.getMovesHistory();
        MoveRecord lastMove = history.remove(history.size() - 1);

        ArmyColor restoredPlayer = lastMove.getPlayer();
        table.setActiveTurn(restoredPlayer);
        table.setLastTimestamp(now);

        PlayerSlot slot = table.getPlayers().get(restoredPlayer);
        if (slot != null) {
            slot.setRemainingMs(lastMove.getTimeBeforeIncrementMs());
        }

        return lastMove;
    }

    public synchronized boolean reinstatePlayer(GameTable table, ArmyColor color) {
        if (table == null || color == null) {
            return false;
        }

        PlayerSlot slot = table.getPlayers().get(color);
        if (slot == null || slot.isAlive()) {
            return false;
        }

        // Reintegra o jogador (remove a bandeira negra conforme Seção 9 do PDF e onGame do HTML)
        slot.setAlive(true);
        slot.setEliminationReason(null);

        // Se a partida havia terminado por eliminação dos outros 3, retorna para PAUSED
        if (table.getState() == GameState.GAME_OVER) {
            table.setState(GameState.PAUSED);
            table.setWinner(null);
        }

        return true;
    }

    public ArmyColor getNextActivePlayer(GameTable table, ArmyColor fromColor) {
        if (fromColor == null) fromColor = ArmyColor.WHITE;
        ArmyColor candidate = fromColor;
        for (int i = 0; i < 4; i++) {
            candidate = candidate.nextCanonical();
            PlayerSlot slot = table.getPlayers().get(candidate);
            if (slot != null && slot.isAlive()) {
                return candidate;
            }
        }
        return fromColor;
    }

    private void updateElapsedTimeInternal(GameTable table, long now) {
        if (table.getState() != GameState.RUNNING) return;
        long delta = now - table.getLastTimestamp();
        table.setLastTimestamp(now);

        PlayerSlot currentSlot = table.getPlayers().get(table.getActiveTurn());
        if (currentSlot != null && currentSlot.isAlive()) {
            currentSlot.setRemainingMs(Math.max(0, currentSlot.getRemainingMs() - delta));
        }
    }

    // Estrutura de eventos do motor
    public enum EngineEventType {
        TIMEOUT,
        ELIMINATION,
        GAME_OVER
    }

    public static class EngineEvent {
        private final EngineEventType type;
        private final ArmyColor subjectPlayer;
        private final ArmyColor nextPlayer;
        private final boolean gameOver;
        private final ArmyColor winner;
        private final String message;

        public EngineEvent(EngineEventType type, ArmyColor subjectPlayer, ArmyColor nextPlayer, boolean gameOver, ArmyColor winner, String message) {
            this.type = type;
            this.subjectPlayer = subjectPlayer;
            this.nextPlayer = nextPlayer;
            this.gameOver = gameOver;
            this.winner = winner;
            this.message = message;
        }

        public EngineEventType getType() {
            return type;
        }

        public ArmyColor getSubjectPlayer() {
            return subjectPlayer;
        }

        public ArmyColor getNextPlayer() {
            return nextPlayer;
        }

        public boolean isGameOver() {
            return gameOver;
        }

        public ArmyColor getWinner() {
            return winner;
        }

        public String getMessage() {
            return message;
        }
    }
}
