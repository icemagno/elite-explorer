package com.quaternity.server.config;

import com.quaternity.server.service.TableManagerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class WebSocketEventListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);

    private final TableManagerService tableManagerService;

    public WebSocketEventListener(TableManagerService tableManagerService) {
        this.tableManagerService = tableManagerService;
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.debug("SessionDisconnectEvent capturado para sessionId: {}", sessionId);
        tableManagerService.handleWebSocketDisconnect(sessionId);
    }
}
