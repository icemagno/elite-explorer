package com.eliteexplorer.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SseNotificationService {

    private static final Logger log = LoggerFactory.getLogger(SseNotificationService.class);

    // Timeout de 30 minutos para cada conexão SSE; navegador reconecta automaticamente se expirar
    private static final Long SSE_TIMEOUT = 30 * 60 * 1000L;

    private final List<SseEmitter> activeEmitters = new CopyOnWriteArrayList<>();

    /**
     * Registra um novo cliente/navegador para receber eventos via Server-Sent Events (SSE).
     */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        activeEmitters.add(emitter);

        emitter.onCompletion(() -> activeEmitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            activeEmitters.remove(emitter);
        });
        emitter.onError(e -> {
            activeEmitters.remove(emitter);
        });

        // Evento inicial de boas-vindas / handshake
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data("{\"status\":\"connected\",\"clients\":" + activeEmitters.size() + "}"));
            log.debug("📡 [SSE] Novo cliente conectado ao stream de eventos. Total ativos: {}", activeEmitters.size());
        } catch (IOException e) {
            activeEmitters.remove(emitter);
        }

        return emitter;
    }

    /**
     * Transmite um evento assíncrono para todas as abas/telas conectadas instantaneamente.
     */
    public void broadcastEvent(String eventName, Object data) {
        if (activeEmitters.isEmpty()) return;

        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();

        for (SseEmitter emitter : activeEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(data));
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }

        if (!deadEmitters.isEmpty()) {
            activeEmitters.removeAll(deadEmitters);
            log.debug("📡 [SSE] Removidos {} clientes desconectados. Restantes: {}", deadEmitters.size(), activeEmitters.size());
        }
    }

    /**
     * Heartbeat a cada 25 segundos para manter a conexão SSE viva e prevenir timeouts de proxies/navegadores
     */
    @Scheduled(fixedRate = 25000)
    public void sendHeartbeat() {
        if (activeEmitters.isEmpty()) return;
        broadcastEvent("ping", "{\"t\":" + System.currentTimeMillis() + "}");
    }

    public int getActiveClientCount() {
        return activeEmitters.size();
    }
}
