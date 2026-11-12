package com.quaternity.server.service;

import com.quaternity.server.engine.QuaternityEngine;
import com.quaternity.server.model.ArmyColor;
import com.quaternity.server.model.GameState;
import com.quaternity.server.model.GameTable;
import com.quaternity.server.model.MoveRecord;
import com.quaternity.server.model.PlayerSlot;
import com.quaternity.server.model.dto.TableSummaryDto;
import com.quaternity.server.repository.TableRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class TableManagerService {

    private static final Logger log = LoggerFactory.getLogger(TableManagerService.class);

    private final TableRepository tableRepository;
    private final QuaternityEngine engine;
    private final SimpMessagingTemplate messagingTemplate;
    private final AtomicInteger tableCounter = new AtomicInteger(1);

    public record WsSessionBinding(String tableId, ArmyColor color, String clientToken) {}
    private final Map<String, WsSessionBinding> wsSessions = new ConcurrentHashMap<>();

    private final ScheduledExecutorService countdownExecutor = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, ScheduledFuture<?>> pendingCountdowns = new ConcurrentHashMap<>();

    private void cancelPendingCountdown(String tableId) {
        ScheduledFuture<?> future = pendingCountdowns.remove(tableId);
        if (future != null && !future.isDone()) {
            future.cancel(true);
        }
    }

    public TableManagerService(TableRepository tableRepository,
                               QuaternityEngine engine,
                               SimpMessagingTemplate messagingTemplate) {
        this.tableRepository = tableRepository;
        this.engine = engine;
        this.messagingTemplate = messagingTemplate;

        // Cria uma mesa padrão inicial para conveniência
        createTable("Mesa 1", 15, 5, "pt", "INCLUSIVE");
    }

    public synchronized GameTable createTable(String name, Integer baseMinutes, Integer incrementSeconds) {
        return createTable(name, baseMinutes, incrementSeconds, "pt", "INCLUSIVE");
    }

    public synchronized GameTable createTable(String name, Integer baseMinutes, Integer incrementSeconds, String language, String gameType) {
        int index = tableCounter.getAndIncrement();
        String id = "mesa-" + index;
        String finalName = (name != null && !name.trim().isEmpty()) ? name.trim() : "Mesa " + index;
        int mins = (baseMinutes != null && baseMinutes > 0) ? baseMinutes : 15;
        int inc = (incrementSeconds != null && incrementSeconds >= 0) ? incrementSeconds : 5;

        GameTable table = new GameTable(id, finalName, mins, inc, language, gameType);
        tableRepository.save(table);

        log.info("Nova mesa criada com sucesso: ID={}, Nome='{}', Tempo={}m+{}s, Idioma={}, Tipo={}",
                id, finalName, mins, inc, table.getLanguage(), table.getGameType());
        broadcastTablesList();
        return table;
    }

    public Optional<GameTable> getTable(String id) {
        return tableRepository.findById(id);
    }

    public List<GameTable> getAllTables() {
        return tableRepository.findAll();
    }

    public synchronized JoinResult joinTable(String tableId, String playerName, String requestedColorStr, String clientIp, String sessionId) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) {
            return new JoinResult(false, "Mesa não encontrada com o ID: " + tableId, null, null);
        }

        GameTable table = opt.get();
        if (table.getState() == GameState.GAME_OVER || table.getState() == GameState.ABORTED) {
            return new JoinResult(false, "Esta partida já foi encerrada.", null, table);
        }

        ArmyColor requestedColor = ArmyColor.fromString(requestedColorStr);
        ArmyColor assignedColor = null;

        // 1. Verifica se o cliente já está na mesa (pelo identificador único de sessão/token da aba) reconectando
        if (sessionId != null && !sessionId.trim().isEmpty()) {
            for (Map.Entry<ArmyColor, PlayerSlot> entry : table.getPlayers().entrySet()) {
                PlayerSlot slot = entry.getValue();
                if (sessionId.equals(slot.getSessionId())) {
                    assignedColor = entry.getKey();
                    slot.setConnected(true);
                    slot.setClientIp(clientIp);
                    if (playerName != null && !playerName.trim().isEmpty()) {
                        slot.setPlayerName(playerName.trim());
                    }
                    tableRepository.save(table);
                    log.info("Jogador '{}' reconectado na mesa '{}' ({}) com o exército {}",
                            slot.getPlayerName(), table.getName(), table.getId(), assignedColor.getDisplayName());
                    broadcastTableSync(table);
                    broadcastTablesList();
                    return new JoinResult(true, "Reconectado com sucesso como " + assignedColor.getDisplayName(), assignedColor, table);
                }
            }
        }

        // 1.1 Se o cliente solicitou uma cor específica e o nome coincide com o ocupante do slot, permite re-vincular a sessão
        if (requestedColor != null && playerName != null && !playerName.trim().isEmpty()) {
            PlayerSlot slot = table.getPlayers().get(requestedColor);
            if (slot != null && slot.getPlayerName() != null &&
                    slot.getPlayerName().trim().equalsIgnoreCase(playerName.trim()) &&
                    !slot.getPlayerName().trim().startsWith("Jogador (")) {
                assignedColor = requestedColor;
                slot.setConnected(true);
                slot.setClientIp(clientIp);
                if (sessionId != null && !sessionId.trim().isEmpty()) {
                    slot.setSessionId(sessionId);
                }
                tableRepository.save(table);
                log.info("Jogador '{}' re-vinculou sessão na mesa '{}' ({}) com o exército {}",
                        slot.getPlayerName(), table.getName(), table.getId(), assignedColor.getDisplayName());
                broadcastTableSync(table);
                broadcastTablesList();
                return new JoinResult(true, "Reconectado com sucesso como " + assignedColor.getDisplayName(), assignedColor, table);
            }
        }

        // 2. Novo jogador conectando: só permitido se a mesa estiver em LOBBY
        if (table.getState() != GameState.LOBBY) {
            return new JoinResult(false, "Esta partida já foi iniciada nesta mesa e não aceita novos jogadores.", null, table);
        }

        // 3. Novo jogador conectando no Lobby: atribui a cor solicitada se livre, ou a próxima na ordem canônica
        if (requestedColor != null && table.isColorAvailable(requestedColor)) {
            assignedColor = requestedColor;
        } else {
            assignedColor = table.getFirstAvailableColor();
        }

        if (assignedColor == null) {
            return new JoinResult(false, "A mesa já está lotada (4/4 jogadores conectados).", null, table);
        }

        PlayerSlot slot = table.getPlayers().get(assignedColor);
        slot.setConnected(true);
        slot.setReady(false); // Aguarda confirmação na tela "Pronto para iniciar?"
        slot.setPlayerName((playerName != null && !playerName.trim().isEmpty()) ? playerName.trim() : "Jogador (" + assignedColor.getDisplayName() + ")");
        slot.setClientIp(clientIp);
        slot.setSessionId(sessionId);

        tableRepository.save(table);
        log.info("Jogador '{}' conectado na mesa '{}' ({}) com o exército {}. Aguardando confirmação de prontidão.",
                slot.getPlayerName(), table.getName(), table.getId(), assignedColor.getDisplayName());

        broadcastTableSync(table);
        broadcastTablesList();

        return new JoinResult(true, "Conectado com sucesso como " + assignedColor.getDisplayName(), assignedColor, table);
    }

    public synchronized boolean updatePlayerName(String tableId, ArmyColor color, String clientToken, String newName) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();
        PlayerSlot slot = table.getPlayers().get(color);
        if (slot == null) return false;

        if (clientToken != null && !clientToken.trim().isEmpty() && slot.getSessionId() != null) {
            if (!clientToken.trim().equals(slot.getSessionId())) {
                log.warn("Tentativa de renomear exército {} com token divergente: recebido={}, esperado={}",
                        color, clientToken, slot.getSessionId());
                return false;
            }
        }

        String sanitized = (newName != null && !newName.trim().isEmpty()) ? newName.trim() : "Jogador (" + color.getDisplayName() + ")";
        slot.setPlayerName(sanitized);
        tableRepository.save(table);
        log.info("Nome do jogador para o exército {} atualizado para '{}' na mesa '{}'",
                color.getDisplayName(), sanitized, table.getName());
        broadcastTableSync(table);
        broadcastTablesList();
        return true;
    }

    public synchronized boolean setPlayerReady(String tableId, ArmyColor color, boolean ready) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();
        if (table.getState() != GameState.LOBBY) {
            return false;
        }

        PlayerSlot slot = table.getPlayers().get(color);
        if (slot == null || !slot.isConnected()) {
            return false;
        }

        slot.setReady(ready);
        log.info("Jogador '{}' ({}) na mesa '{}' ({}) respondeu pronto={}",
                slot.getPlayerName(), color.getDisplayName(), table.getName(), table.getId(), ready);

        // Regra oficial: O jogo NÃO inicia automaticamente ao 4º jogador marcar pronto.
        // O início é MANUAL e EXCLUSIVO do Administrador após os 4 jogadores estarem conectados e prontos.
        tableRepository.save(table);
        broadcastTableSync(table);
        broadcastTablesList();
        return true;
    }

    public synchronized boolean leaveTable(String tableId, ArmyColor color) {
        return leaveTable(tableId, color, null);
    }

    public synchronized boolean leaveTable(String tableId, ArmyColor color, String sessionId) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();
        PlayerSlot slot = table.getPlayers().get(color);
        if (slot == null) {
            return false;
        }

        // Se sessionId foi fornecido e o slot possui sessionId registrado, valida correspondência
        if (sessionId != null && !sessionId.trim().isEmpty() && slot.getSessionId() != null && !sessionId.trim().equals(slot.getSessionId())) {
            log.warn("Tentativa de sair da mesa '{}' com sessão inválida: cor={}, sessionId={}, slotSessionId={}",
                    table.getName(), color, sessionId, slot.getSessionId());
            return false;
        }

        if (table.getState() == GameState.LOBBY) {
            if (!slot.isConnected()) {
                return false;
            }
            slot.setConnected(false);
            slot.setReady(false);
            slot.setPlayerName("Aguardando...");
            slot.setSessionId(null);
            slot.setClientIp(null);

            tableRepository.save(table);
            log.info("Exército {} liberado no lobby da mesa '{}'", color.getDisplayName(), table.getName());
            broadcastTableSync(table);
            broadcastTablesList();
            return true;
        }

        if (table.getState() == GameState.RUNNING || table.getState() == GameState.PAUSED) {
            slot.setConnected(false);
            if (slot.isAlive()) {
                engine.eliminatePlayer(table, color, "Bandeira Baixada / Abandono");
                log.info("Jogador {} abandonou a partida na mesa '{}'. Exército eliminado por abandono.",
                        color.getDisplayName(), table.getName());
            } else {
                log.info("Jogador {} (já eliminado) desconectou-se da mesa '{}'.",
                        color.getDisplayName(), table.getName());
            }

            tableRepository.save(table);
            broadcastTableSync(table);
            broadcastTablesList();
            return true;
        }

        if (table.getState() == GameState.GAME_OVER || table.getState() == GameState.ABORTED) {
            slot.setConnected(false);
            tableRepository.save(table);
            broadcastTableSync(table);
            broadcastTablesList();
            return true;
        }

        return false;
    }

    public void registerWebSocketSession(String wsSessionId, String tableId, ArmyColor color, String clientToken) {
        if (wsSessionId == null || tableId == null || color == null) return;
        wsSessions.put(wsSessionId, new WsSessionBinding(tableId, color, clientToken));
        log.info("Sessão WebSocket vinculada: wsSessionId={}, mesa={}, cor={}, token={}",
                wsSessionId, tableId, color.getDisplayName(), clientToken);
    }

    public void unregisterWebSocketSession(String wsSessionId) {
        if (wsSessionId != null) {
            wsSessions.remove(wsSessionId);
        }
    }

    public synchronized void handleWebSocketDisconnect(String wsSessionId) {
        if (wsSessionId == null) return;
        WsSessionBinding binding = wsSessions.remove(wsSessionId);
        if (binding == null) {
            return;
        }

        String tableId = binding.tableId();
        ArmyColor color = binding.color();
        String clientToken = binding.clientToken();

        log.info("WebSocket desconectado (wsSessionId={}): mesa={}, cor={}, clientToken={}",
                wsSessionId, tableId, color.getDisplayName(), clientToken);

        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return;

        GameTable table = opt.get();
        PlayerSlot slot = table.getPlayers().get(color);
        if (slot == null) return;

        // Se o slot possui clientToken registrado e não confere, ignora (outra aba já assumiu)
        if (clientToken != null && slot.getSessionId() != null && !clientToken.equals(slot.getSessionId())) {
            log.debug("Desconexão WebSocket de {} ignorada porque o slot pertence a outro token", color);
            return;
        }

        // Se a partida está em andamento ou pausada e o jogador está vivo: BAIXA BANDEIRA / ABANDONO
        if (table.getState() == GameState.RUNNING || table.getState() == GameState.PAUSED) {
            if (slot.isAlive()) {
                log.info("Jogador {} desconectou o WebSocket durante a partida na mesa '{}'. Exército eliminado por baixa de bandeira / abandono.",
                        color.getDisplayName(), table.getName());
                slot.setConnected(false);
                engine.eliminatePlayer(table, color, "Bandeira Baixada / Abandono");
                tableRepository.save(table);
                broadcastTableSync(table);
                broadcastTablesList();
            } else {
                slot.setConnected(false);
                tableRepository.save(table);
                broadcastTableSync(table);
                broadcastTablesList();
            }
        } else if (table.getState() == GameState.LOBBY) {
            // No Lobby, desconectar libera o exército para outros participantes
            log.info("Jogador {} desconectou o WebSocket na sala de espera da mesa '{}'. Liberando slot.",
                    color.getDisplayName(), table.getName());
            slot.setConnected(false);
            slot.setReady(false);
            slot.setPlayerName("Aguardando...");
            slot.setSessionId(null);
            slot.setClientIp(null);
            tableRepository.save(table);
            broadcastTableSync(table);
            broadcastTablesList();
        }
    }

    public synchronized boolean startGame(String tableId) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();
        if (table.getState() != GameState.LOBBY) {
            log.warn("Mesa '{}' não está em LOBBY para iniciar (estado atual: {})", table.getName(), table.getState());
            return false;
        }

        // Regras 1, 2 e 3: O início do jogo só será habilitado quando existir 4 jogadores e os 4 estiverem prontos
        if (table.getConnectedCount() < 4 || table.getReadyCount() < 4) {
            log.warn("Tentativa de iniciar mesa '{}' sem os 4 jogadores prontos (conectados: {}, prontos: {})",
                    table.getName(), table.getConnectedCount(), table.getReadyCount());
            return false;
        }

        cancelPendingCountdown(tableId);

        // Regra 4: Broadcast de contagem regressiva de 5 segundos
        messagingTemplate.convertAndSend("/topic/table/" + tableId + "/countdown",
                Map.of("action", "START", "duration", 5, "tableId", tableId));

        log.info("Contagem regressiva de 5s iniciada para início da mesa '{}' ({})", table.getName(), tableId);

        // Agenda o início efetivo do relógio para daqui a 5 segundos (5000 ms)
        ScheduledFuture<?> future = countdownExecutor.schedule(() -> {
            synchronized (TableManagerService.this) {
                Optional<GameTable> tOpt = tableRepository.findById(tableId);
                if (tOpt.isPresent()) {
                    GameTable currentTable = tOpt.get();
                    if (currentTable.getState() == GameState.LOBBY) {
                        boolean started = engine.startGame(currentTable);
                        if (started) {
                            tableRepository.save(currentTable);
                            log.info("Partida efetivamente iniciada na mesa '{}' ({}) após contagem de 5s",
                                    currentTable.getName(), currentTable.getId());
                            broadcastTableSync(currentTable);
                            broadcastTablesList();
                        }
                    }
                }
            }
        }, 5000, TimeUnit.MILLISECONDS);

        pendingCountdowns.put(tableId, future);
        return true;
    }

    public synchronized boolean playerMove(String tableId, ArmyColor color) {
        return playerMove(tableId, color, null);
    }

    public synchronized boolean playerMove(String tableId, ArmyColor color, String sessionId) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();
        if (table.getState() != GameState.RUNNING) return false;

        // 1. O exército deve corresponder ao turno ativo
        if (color == null || color != table.getActiveTurn()) {
            log.warn("Tentativa de jogada fora de turno na mesa '{}': solicitante={}, turnoAtivo={}",
                    table.getName(), color, table.getActiveTurn());
            return false;
        }

        // 2. Se a sessão/token do cliente for informada, valida se ele é o dono do exército da vez
        if (sessionId != null && !sessionId.trim().isEmpty()) {
            PlayerSlot slot = table.getPlayers().get(color);
            if (slot != null && slot.getSessionId() != null && !slot.getSessionId().equals(sessionId.trim())) {
                log.warn("Tentativa de mover exército de outro jogador na mesa '{}': exército={}, tokenEnviado={}, tokenDono={}",
                        table.getName(), color, sessionId, slot.getSessionId());
                return false;
            }
        }

        MoveRecord move = engine.processPlayerMove(table, color);
        if (move != null) {
            tableRepository.save(table);
            log.info("Lance executado com sucesso na mesa '{}' ({}): {} -> Próximo: {}",
                    table.getName(), table.getId(), color, table.getActiveTurn());
            broadcastTableSync(table);
            return true;
        }
        return false;
    }

    public synchronized boolean pauseTable(String tableId, boolean isPaused, String reason) {
        return pauseTable(tableId, isPaused, reason, null);
    }

    public synchronized boolean pauseTable(String tableId, boolean isPaused, String reason, String requestingSessionId) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();

        // Se uma sessão/token do solicitante for fornecida, valida se pertence a um jogador ativo
        if (requestingSessionId != null && !requestingSessionId.trim().isEmpty()) {
            PlayerSlot requesterSlot = table.getPlayers().values().stream()
                    .filter(s -> requestingSessionId.trim().equals(s.getSessionId()))
                    .findFirst().orElse(null);

            // Jogador com exército já eliminado não pode pausar nem retomar a partida
            if (requesterSlot != null && !requesterSlot.isAlive()) {
                log.warn("Tentativa de pausar/retomar mesa '{}' por jogador eliminado ({}) recusada.",
                        table.getName(), requesterSlot.getColor());
                return false;
            }
        }

        if (isPaused) {
            cancelPendingCountdown(tableId);
            boolean ok = engine.pauseGame(table, reason);
            if (ok) {
                tableRepository.save(table);
                log.info("Mesa '{}' ({}) PAUSADA", table.getName(), table.getId());
                broadcastTableSync(table);
                broadcastTablesList();
                return true;
            }
            return false;
        } else {
            // Retomada: se a mesa não estiver pausada, nada a fazer
            if (table.getState() != GameState.PAUSED) {
                return false;
            }

            cancelPendingCountdown(tableId);

            // Regra 11: Quando retomar o jogo, contagem regressiva de 5 segundos
            messagingTemplate.convertAndSend("/topic/table/" + tableId + "/countdown",
                    Map.of("action", "RESUME", "duration", 5, "tableId", tableId));

            log.info("Contagem regressiva de 5s iniciada para retomada da mesa '{}' ({})", table.getName(), tableId);

            ScheduledFuture<?> future = countdownExecutor.schedule(() -> {
                synchronized (TableManagerService.this) {
                    Optional<GameTable> tOpt = tableRepository.findById(tableId);
                    if (tOpt.isPresent()) {
                        GameTable currentTable = tOpt.get();
                        if (currentTable.getState() == GameState.PAUSED) {
                            boolean ok = engine.resumeGame(currentTable);
                            if (ok) {
                                tableRepository.save(currentTable);
                                log.info("Mesa '{}' ({}) RETOMADA após contagem de 5s", currentTable.getName(), currentTable.getId());
                                broadcastTableSync(currentTable);
                                broadcastTablesList();
                            }
                        }
                    }
                }
            }, 5000, TimeUnit.MILLISECONDS);

            pendingCountdowns.put(tableId, future);
            return true;
        }
    }

    public synchronized boolean eliminatePlayer(String tableId, ArmyColor color, String reason) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();
        QuaternityEngine.EngineEvent event = engine.eliminatePlayer(table, color, reason);
        if (event != null) {
            tableRepository.save(table);
            log.info("Exército {} eliminado na mesa '{}' ({}) motivo={}",
                    color.getDisplayName(), table.getName(), table.getId(), reason);
            broadcastTableSync(table);
            broadcastTablesList();
            return true;
        }
        return false;
    }

    public synchronized boolean reinstatePlayer(String tableId, ArmyColor color) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();
        boolean ok = engine.reinstatePlayer(table, color);
        if (ok) {
            tableRepository.save(table);
            log.info("Exército {} REINTEGRADO na mesa '{}' ({}) (Bandeira Negra removida)",
                    color.getDisplayName(), table.getName(), table.getId());
            broadcastTableSync(table);
            broadcastTablesList();
            return true;
        }
        return false;
    }

    public synchronized boolean undoMove(String tableId) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        GameTable table = opt.get();
        MoveRecord undone = engine.undoLastMove(table);
        if (undone != null) {
            tableRepository.save(table);
            log.info("Último lance desfeito na mesa '{}' ({}). Turno retornado para {}",
                    table.getName(), table.getId(), table.getActiveTurn().getDisplayName());
            broadcastTableSync(table);
            broadcastTablesList();
            return true;
        }
        return false;
    }

    public synchronized boolean abortTable(String tableId) {
        Optional<GameTable> opt = tableRepository.findById(tableId);
        if (opt.isEmpty()) return false;

        cancelPendingCountdown(tableId);
        GameTable table = opt.get();
        boolean ok = engine.abortGame(table);
        if (ok) {
            tableRepository.save(table);
            log.info("Partida na mesa '{}' ({}) CANCELADA", table.getName(), table.getId());
            broadcastTableSync(table);
            broadcastTablesList();
            return true;
        }
        return false;
    }

    public synchronized boolean deleteTable(String tableId) {
        cancelPendingCountdown(tableId);
        boolean deleted = tableRepository.deleteById(tableId);
        if (deleted) {
            log.info("Mesa {} excluída do servidor", tableId);
            messagingTemplate.convertAndSend("/topic/table/" + tableId + "/deleted", Map.of("deleted", true, "tableId", tableId));
            broadcastTablesList();
        }
        return deleted;
    }

    public void broadcastTableSync(GameTable table) {
        if (table == null) return;
        TableSummaryDto dto = TableSummaryDto.fromTable(table);
        messagingTemplate.convertAndSend("/topic/table/" + table.getId(), dto);
    }

    public void broadcastTablesList() {
        List<TableSummaryDto> summaries = tableRepository.findAll().stream()
                .map(TableSummaryDto::fromTable)
                .toList();
        messagingTemplate.convertAndSend("/topic/tables", summaries);
    }

    public static class JoinResult {
        private final boolean success;
        private final String message;
        private final ArmyColor assignedColor;
        private final GameTable table;

        public JoinResult(boolean success, String message, ArmyColor assignedColor, GameTable table) {
            this.success = success;
            this.message = message;
            this.assignedColor = assignedColor;
            this.table = table;
        }

        public boolean isSuccess() {
            return success;
        }

        public String getMessage() {
            return message;
        }

        public ArmyColor getAssignedColor() {
            return assignedColor;
        }

        public GameTable getTable() {
            return table;
        }
    }
}
