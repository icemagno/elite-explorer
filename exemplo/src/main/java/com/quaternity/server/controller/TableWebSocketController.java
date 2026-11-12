package com.quaternity.server.controller;

import com.quaternity.server.model.ArmyColor;
import com.quaternity.server.model.dto.EliminateRequest;
import com.quaternity.server.model.dto.PauseRequest;
import com.quaternity.server.model.dto.PlayerMoveRequest;
import com.quaternity.server.model.dto.PlayerReadyRequest;
import com.quaternity.server.model.dto.PlayerRegisterRequest;
import com.quaternity.server.service.TableManagerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class TableWebSocketController {

    private static final Logger log = LoggerFactory.getLogger(TableWebSocketController.class);

    private final TableManagerService tableManagerService;

    public TableWebSocketController(TableManagerService tableManagerService) {
        this.tableManagerService = tableManagerService;
    }

    @MessageMapping("/table/{tableId}/register")
    public void handleRegister(@DestinationVariable String tableId,
                               @Payload(required = false) PlayerRegisterRequest request,
                               SimpMessageHeaderAccessor headerAccessor) {
        String wsSessionId = headerAccessor != null ? headerAccessor.getSessionId() : null;
        if (wsSessionId != null && request != null && request.getColor() != null) {
            ArmyColor color = ArmyColor.fromString(request.getColor());
            if (color != null) {
                tableManagerService.registerWebSocketSession(wsSessionId, tableId, color, request.getClientToken());
            }
        }
    }

    @MessageMapping("/table/{tableId}/ready")
    public void handleReady(@DestinationVariable String tableId, @Payload PlayerReadyRequest request) {
        if (request != null && request.getEffectiveColor() != null) {
            ArmyColor color = ArmyColor.fromString(request.getEffectiveColor());
            if (color != null) {
                tableManagerService.setPlayerReady(tableId, color, request.getReady());
            }
        }
    }

    @MessageMapping("/table/{tableId}/rename")
    public void handleRename(@DestinationVariable String tableId, @Payload(required = false) java.util.Map<String, String> payload) {
        if (payload != null && payload.get("color") != null) {
            ArmyColor color = ArmyColor.fromString(payload.get("color"));
            if (color != null) {
                tableManagerService.updatePlayerName(tableId, color, payload.get("clientToken"), payload.get("newName"));
            }
        }
    }

    @MessageMapping("/table/{tableId}/move")
    public void handleMove(@DestinationVariable String tableId, @Payload(required = false) PlayerMoveRequest request) {
        ArmyColor color = null;
        String clientToken = null;
        if (request != null && request.getPlayer() != null && !request.getPlayer().trim().isEmpty()) {
            color = ArmyColor.fromString(request.getPlayer());
            clientToken = request.getClientToken();
        }
        log.info("Recebido WebSocket /move: mesa={}, cor={}, clientToken={}", tableId, color, clientToken);
        boolean ok = tableManagerService.playerMove(tableId, color, clientToken);
        if (!ok) {
            log.warn("Movimento WebSocket recusado: mesa={}, cor={}, clientToken={}", tableId, color, clientToken);
        }
    }

    @MessageMapping("/table/{tableId}/pause")
    public void handlePause(@DestinationVariable String tableId, @Payload(required = false) PauseRequest request) {
        log.warn("Tentativa de pausar/retomar via WebSocket ignorada: mesa={}. Somente o administrador pode pausar o jogo.", tableId);
    }

    @MessageMapping("/table/{tableId}/eliminate")
    public void handleEliminate(@DestinationVariable String tableId, @Payload EliminateRequest request) {
        if (request != null && request.getColor() != null) {
            ArmyColor color = ArmyColor.fromString(request.getColor());
            if (color != null) {
                String reason = request.getReason() != null ? request.getReason() : "Bandeira baixada";
                tableManagerService.eliminatePlayer(tableId, color, reason);
            }
        }
    }

    @MessageMapping("/table/{tableId}/reinstate")
    public void handleReinstate(@DestinationVariable String tableId, @Payload EliminateRequest request) {
        if (request != null && request.getColor() != null) {
            ArmyColor color = ArmyColor.fromString(request.getColor());
            if (color != null) {
                tableManagerService.reinstatePlayer(tableId, color);
            }
        }
    }

    @MessageMapping("/table/{tableId}/undo")
    public void handleUndo(@DestinationVariable String tableId) {
        tableManagerService.undoMove(tableId);
    }
}
