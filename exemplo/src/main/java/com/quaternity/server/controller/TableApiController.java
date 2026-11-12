package com.quaternity.server.controller;

import com.quaternity.server.model.ArmyColor;
import com.quaternity.server.model.GameTable;
import com.quaternity.server.model.dto.*;
import com.quaternity.server.service.TableManagerService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
public class TableApiController {

    private static final Logger log = LoggerFactory.getLogger(TableApiController.class);

    private final TableManagerService tableManagerService;

    @Value("${server.port:8080}")
    private int serverPort;

    public TableApiController(TableManagerService tableManagerService) {
        this.tableManagerService = tableManagerService;
    }

    // --- ENDPOINTS OFICIAIS DA API REST ---

    @GetMapping("/api/tables")
    public List<TableSummaryDto> listTables() {
        return tableManagerService.getAllTables().stream()
                .map(TableSummaryDto::fromTable)
                .toList();
    }

    @PostMapping("/api/tables")
    public ResponseEntity<TableSummaryDto> createTable(@RequestBody(required = false) CreateTableRequest request) {
        String name = (request != null) ? request.getName() : null;
        Integer mins = (request != null) ? request.getBaseMinutes() : null;
        Integer inc = (request != null) ? request.getIncrementSeconds() : null;

        String lang = (request != null) ? request.getLanguage() : null;
        String gameType = (request != null) ? request.getGameType() : null;

        GameTable created = tableManagerService.createTable(name, mins, inc, lang, gameType);
        return ResponseEntity.status(HttpStatus.CREATED).body(TableSummaryDto.fromTable(created));
    }

    @GetMapping("/api/tables/{id}")
    public ResponseEntity<?> getTable(@PathVariable String id) {
        Optional<GameTable> opt = tableManagerService.getTable(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Mesa não encontrada: " + id));
        }
        return ResponseEntity.ok(TableSummaryDto.fromTable(opt.get()));
    }

    @PostMapping("/api/tables/{id}/join")
    public ResponseEntity<?> joinTable(@PathVariable String id,
                                       @RequestBody(required = false) JoinTableRequest request,
                                       HttpServletRequest httpRequest) {
        String playerName = (request != null) ? request.getPlayerName() : null;
        String color = (request != null) ? request.getColor() : null;
        String clientIp = httpRequest.getRemoteAddr();
        String sessionId = (request != null && request.getClientToken() != null && !request.getClientToken().trim().isEmpty())
                ? request.getClientToken().trim()
                : httpRequest.getSession(true).getId();

        TableManagerService.JoinResult result = tableManagerService.joinTable(id, playerName, color, clientIp, sessionId);
        if (!result.isSuccess()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "status", "error",
                    "joined", false,
                    "error", result.getMessage()
            ));
        }

        GameTable updatedTable = result.getTable();
        TableSummaryDto tableDto = (updatedTable != null) ? TableSummaryDto.fromTable(updatedTable) : null;

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "ok");
        response.put("joined", true);
        response.put("assignedColor", result.getAssignedColor().name().toLowerCase());
        response.put("assignedColorName", result.getAssignedColor().getDisplayName());
        response.put("tableId", id);
        response.put("message", result.getMessage());
        response.put("table", tableDto);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/tables/{id}/ready")
    public ResponseEntity<?> setPlayerReady(@PathVariable String id, @RequestBody PlayerReadyRequest request) {
        if (request == null || request.getEffectiveColor() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cor do jogador não informada"));
        }
        ArmyColor color = ArmyColor.fromString(request.getEffectiveColor());
        if (color == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cor inválida: " + request.getEffectiveColor()));
        }

        boolean ok = tableManagerService.setPlayerReady(id, color, request.getReady());
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Não foi possível atualizar a confirmação. Verifique se o jogador está na mesa e se ela ainda está na sala de espera."
            ));
        }

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "color", color.name().toLowerCase(),
                "ready", request.getReady()
        ));
    }

    @PostMapping("/api/tables/{id}/leave")
    public ResponseEntity<?> leaveTable(@PathVariable String id, @RequestBody(required = false) PlayerLeaveRequest request) {
        if (request != null && request.getEffectiveColor() != null) {
            ArmyColor color = ArmyColor.fromString(request.getEffectiveColor());
            if (color != null) {
                String sessionId = request.getEffectiveSessionId();
                boolean left = tableManagerService.leaveTable(id, color, sessionId);
                if (left) {
                    return ResponseEntity.ok(Map.of("status", "ok", "message", "Jogador saiu da mesa com sucesso."));
                } else {
                    return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Não foi possível sair da mesa."));
                }
            }
        }
        return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Dados inválidos para sair da mesa."));
    }

    @PostMapping("/api/tables/{id}/rename")
    public ResponseEntity<?> renamePlayer(@PathVariable String id, @RequestBody(required = false) Map<String, String> body) {
        if (body == null || !body.containsKey("color")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cor não informada"));
        }
        ArmyColor color = ArmyColor.fromString(body.get("color"));
        if (color == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cor inválida: " + body.get("color")));
        }
        String clientToken = body.get("clientToken");
        String newName = body.get("newName");

        boolean ok = tableManagerService.updatePlayerName(id, color, clientToken, newName);
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Não foi possível alterar o nome do jogador."));
        }

        return ResponseEntity.ok(Map.of("status", "ok", "color", color.name().toLowerCase(), "newName", (newName != null ? newName.trim() : "")));
    }

    @PostMapping("/api/tables/{id}/start")
    public ResponseEntity<?> startTable(@PathVariable String id) {
        boolean started = tableManagerService.startGame(id);
        if (!started) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "status", "error",
                    "message", "Não foi possível iniciar a partida. Verifique se os 4 jogadores estão conectados e prontos."
            ));
        }
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Partida iniciada com sucesso!"));
    }

    @PostMapping("/api/tables/{id}/move")
    public ResponseEntity<?> playerMove(@PathVariable String id,
                                        @RequestBody(required = false) PlayerMoveRequest request,
                                        HttpServletRequest httpRequest) {
        ArmyColor color = null;
        if (request != null && request.getPlayer() != null && !request.getPlayer().trim().isEmpty()) {
            color = ArmyColor.fromString(request.getPlayer());
        }
        String sessionId = (request != null && request.getClientToken() != null && !request.getClientToken().trim().isEmpty())
                ? request.getClientToken().trim()
                : httpRequest.getSession(true).getId();

        log.info("Recebida requisição REST POST /api/tables/{}/move: cor={}, sessionId={}", id, color, sessionId);
        boolean ok = tableManagerService.playerMove(id, color, sessionId);
        if (!ok) {
            log.warn("Movimento REST recusado para a mesa {}: cor={}, sessionId={}", id, color, sessionId);
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Lance rejeitado. Verifique se a partida está em andamento e se é a vez deste exército."
            ));
        }

        return ResponseEntity.ok(Map.of("status", "ok", "moveReceived", true));
    }

    @PostMapping("/api/tables/{id}/pause")
    public ResponseEntity<?> pauseTable(@PathVariable String id, @RequestBody(required = false) PauseRequest request) {
        boolean shouldPause = true;
        if (request != null && request.getEffectiveIsPaused() != null) {
            shouldPause = request.getEffectiveIsPaused();
        }
        String reason = (request != null && request.getReason() != null) ? request.getReason() : "Solicitado pelo participante";
        String sessionId = request != null ? request.getEffectiveSessionId() : null;
        log.info("Recebida requisição para alterar pausa na mesa '{}': shouldPause={}, motivo='{}', sessionId={}", id, shouldPause, reason, sessionId);

        boolean ok = tableManagerService.pauseTable(id, shouldPause, reason, sessionId);
        if (!ok) {
            log.warn("Não foi possível alterar a pausa da mesa '{}': shouldPause={}", id, shouldPause);
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Não foi possível alterar a pausa da mesa " + id
            ));
        }

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "isPaused", shouldPause,
                "paused", shouldPause,
                "message", shouldPause ? "Partida pausada." : "Partida retomada."
        ));
    }

    @PostMapping("/api/tables/{id}/eliminate")
    public ResponseEntity<?> eliminatePlayer(@PathVariable String id, @RequestBody EliminateRequest request) {
        if (request == null || request.getColor() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cor do jogador não informada"));
        }
        ArmyColor color = ArmyColor.fromString(request.getColor());
        if (color == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cor inválida: " + request.getColor()));
        }
        String reason = (request.getReason() != null) ? request.getReason() : "Bandeira baixada";

        boolean ok = tableManagerService.eliminatePlayer(id, color, reason);
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("error", "Não foi possível eliminar este jogador"));
        }

        return ResponseEntity.ok(Map.of("status", "ok", "eliminated", true, "color", color.name().toLowerCase()));
    }

    @PostMapping("/api/tables/{id}/reinstate")
    public ResponseEntity<?> reinstatePlayer(@PathVariable String id, @RequestBody EliminateRequest request) {
        if (request == null || request.getColor() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cor do jogador não informada"));
        }
        ArmyColor color = ArmyColor.fromString(request.getColor());
        if (color == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cor inválida: " + request.getColor()));
        }

        boolean ok = tableManagerService.reinstatePlayer(id, color);
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("error", "Não foi possível reintegrar o jogador " + color.getDisplayName()));
        }

        return ResponseEntity.ok(Map.of("status", "ok", "reinstated", true, "color", color.name().toLowerCase()));
    }

    @PostMapping("/api/tables/{id}/undo")
    public ResponseEntity<?> undoLastMove(@PathVariable String id) {
        boolean ok = tableManagerService.undoMove(id);
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nenhum lance disponível para desfazer ou partida não iniciada"));
        }
        return ResponseEntity.ok(Map.of("status", "ok", "undone", true));
    }

    @PostMapping("/api/tables/{id}/abort")
    public ResponseEntity<?> abortTable(@PathVariable String id) {
        boolean ok = tableManagerService.abortTable(id);
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("error", "Não foi possível cancelar a partida"));
        }
        return ResponseEntity.ok(Map.of("status", "ok", "aborted", true));
    }

    @DeleteMapping("/api/tables/{id}")
    public ResponseEntity<?> deleteTable(@PathVariable String id) {
        boolean ok = tableManagerService.deleteTable(id);
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Mesa não encontrada para exclusão: " + id));
        }
        return ResponseEntity.ok(Map.of("status", "ok", "deleted", true));
    }

    // --- ENDPOINTS DE COMPATIBILIDADE GLOBAL ---

    @GetMapping("/ping")
    public Map<String, Object> ping() {
        return Map.of(
                "status", "ok",
                "type", "PONG",
                "server", "QuaternityCentralServer",
                "port", serverPort,
                "activeTables", tableManagerService.getAllTables().size(),
                "hostTime", System.currentTimeMillis()
        );
    }

    @GetMapping("/status")
    public ResponseEntity<?> defaultStatus() {
        List<GameTable> all = tableManagerService.getAllTables();
        if (all.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "ok", "message", "Nenhuma mesa criada ainda"));
        }
        return ResponseEntity.ok(TableSummaryDto.fromTable(all.get(0)));
    }
}
