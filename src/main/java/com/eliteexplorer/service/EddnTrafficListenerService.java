package com.eliteexplorer.service;

import com.eliteexplorer.dto.TrafficEventDTO;
import com.eliteexplorer.model.PlayerStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.zeromq.SocketType;
import org.zeromq.ZContext;
import org.zeromq.ZMQ;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.Inflater;

@Service
public class EddnTrafficListenerService {

    private static final Logger log = LoggerFactory.getLogger(EddnTrafficListenerService.class);
    private static final String EDDN_RELAY_URL = "tcp://eddn.edcd.io:9500";
    private static final double DEFAULT_CUBE_RADIUS = 75.0; // Raio em anos-luz monitorado ao redor da nave

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final JournalWatcherService journalWatcherService;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final List<TrafficEventDTO> recentEvents = new CopyOnWriteArrayList<>();
    private final Map<String, CommanderTrack> knownCommanders = new ConcurrentHashMap<>();

    private Thread listenerThread;
    private ZContext zContext;

    public EddnTrafficListenerService(@Lazy JournalWatcherService journalWatcherService) {
        this.journalWatcherService = journalWatcherService;
    }

    @PostConstruct
    public void start() {
        running.set(true);
        listenerThread = new Thread(this::listenEddnStream, "eddn-traffic-stream");
        listenerThread.setDaemon(true);
        listenerThread.start();
        log.info("📡 Escuta de tráfego de Comandantes via EDDN iniciada em segundo plano ({})", EDDN_RELAY_URL);
    }

    @PreDestroy
    public void stop() {
        running.set(false);
        if (zContext != null) {
            try {
                zContext.close();
            } catch (Exception e) {
                log.debug("Erro ao encerrar contexto ZMQ do EDDN: {}", e.getMessage());
            }
        }
        if (listenerThread != null) {
            listenerThread.interrupt();
        }
    }

    private void listenEddnStream() {
        while (running.get()) {
            try (ZContext context = new ZContext()) {
                this.zContext = context;
                ZMQ.Socket subscriber = context.createSocket(SocketType.SUB);
                subscriber.connect(EDDN_RELAY_URL);
                subscriber.subscribe("".getBytes(ZMQ.CHARSET));
                subscriber.setReceiveTimeOut(10000); // 10 segundos timeout

                log.info("✅ Conectado ao relay EDDN (ZeroMQ: 9500). Monitorando saltos da galáxia...");

                byte[] buffer = new byte[2048];

                while (running.get()) {
                    byte[] received = subscriber.recv(0);
                    if (received == null) continue;

                    try {
                        // Decomprime zlib
                        Inflater inflater = new Inflater();
                        inflater.setInput(received);
                        ByteArrayOutputStream outputStream = new ByteArrayOutputStream(received.length * 2);
                        while (!inflater.finished()) {
                            int count = inflater.inflate(buffer);
                            if (count <= 0 && inflater.needsInput()) break;
                            outputStream.write(buffer, 0, count);
                        }
                        inflater.end();

                        String json = outputStream.toString(StandardCharsets.UTF_8);
                        processEddnMessage(json);
                    } catch (Exception e) {
                        // Ignora pacotes corrompidos eventuais
                    }
                }
            } catch (Exception e) {
                if (running.get()) {
                    log.warn("Reconectando ao EDDN em 5 segundos devido a: {}", e.getMessage());
                    try {
                        Thread.sleep(5000);
                    } catch (InterruptedException ie) {
                        break;
                    }
                }
            }
        }
    }

    private void processEddnMessage(String json) {
        if (!json.contains("journal/1") || !json.contains("\"StarPos\"")) {
            return;
        }

        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode message = root.path("message");
            String event = message.path("event").asText("");
            boolean isJumpEvent = "FSDJump".equalsIgnoreCase(event) || "CarrierJump".equalsIgnoreCase(event);

            String targetSystem = message.path("StarSystem").asText("");
            JsonNode starPos = message.path("StarPos");
            if (!starPos.isArray() || starPos.size() < 3 || targetSystem.isBlank()) {
                return;
            }

            double targetX = starPos.get(0).asDouble();
            double targetY = starPos.get(1).asDouble();
            double targetZ = starPos.get(2).asDouble();

            String uploaderId = root.path("header").path("uploaderID").asText("");
            String software = root.path("header").path("softwareName").asText("CMDR");

            long now = System.currentTimeMillis();

            // Atualiza presença conhecida do CMDR para qualquer evento com StarPos (Location, Docked, Scan, FSDJump...)
            if (!uploaderId.isBlank()) {
                CommanderTrack previous = knownCommanders.get(uploaderId);
                knownCommanders.put(uploaderId, new CommanderTrack(targetSystem, targetX, targetY, targetZ, now));

                if (knownCommanders.size() > 500) {
                    knownCommanders.entrySet().removeIf(e -> (now - e.getValue().timestamp) > 1_200_000L);
                }

                if (!isJumpEvent) {
                    return;
                }

                PlayerStatus player = journalWatcherService.getPlayerStatus();
                if (player.getPosX() == null || player.getPosY() == null || player.getPosZ() == null) {
                    return;
                }

                double px = player.getPosX();
                double py = player.getPosY();
                double pz = player.getPosZ();

                // 1. Checa se o Comandante pulou de um sistema anterior que estava dentro do nosso cubo (JUMP_OUT)
                if (previous != null) {
                    double distOldToPlayer = calculateDistance(previous.x, previous.y, previous.z, px, py, pz);
                    if (distOldToPlayer <= DEFAULT_CUBE_RADIUS) {
                        recordTrafficEvent(new TrafficEventDTO(
                                UUID.randomUUID().toString(),
                                "JUMP_OUT",
                                previous.systemName,
                                previous.x,
                                previous.y,
                                previous.z,
                                now,
                                software,
                                "EDDN"
                        ));
                        log.info("🌌 [EDDN TRAFFIC] Comandante partiu de '{}' (JUMP_OUT, {:.1f} ly da nave) via {}",
                                previous.systemName, distOldToPlayer, software);
                    }
                }

                // 2. Checa se o sistema de destino (onde acabou de ingressar) está dentro do nosso cubo (JUMP_IN)
                double distNewToPlayer = calculateDistance(targetX, targetY, targetZ, px, py, pz);
                if (distNewToPlayer <= DEFAULT_CUBE_RADIUS) {
                    recordTrafficEvent(new TrafficEventDTO(
                            UUID.randomUUID().toString(),
                            "JUMP_IN",
                            targetSystem,
                            targetX,
                            targetY,
                            targetZ,
                            now,
                            software,
                            "EDDN"
                    ));
                    log.info("⚡ [EDDN TRAFFIC] Comandante ingressou em '{}' (JUMP_IN, {:.1f} ly da nave) via {}",
                            targetSystem, distNewToPlayer, software);
                }
            } else if (isJumpEvent) {
                PlayerStatus player = journalWatcherService.getPlayerStatus();
                if (player.getPosX() == null || player.getPosY() == null || player.getPosZ() == null) {
                    return;
                }
                double distNewToPlayer = calculateDistance(targetX, targetY, targetZ,
                        player.getPosX(), player.getPosY(), player.getPosZ());
                if (distNewToPlayer <= DEFAULT_CUBE_RADIUS) {
                    recordTrafficEvent(new TrafficEventDTO(
                            UUID.randomUUID().toString(),
                            "JUMP_IN",
                            targetSystem,
                            targetX,
                            targetY,
                            targetZ,
                            now,
                            software,
                            "EDDN"
                    ));
                }
            }

        } catch (Exception e) {
            log.debug("Mensagem EDDN ignorada ao processar tráfego: {}", e.getMessage());
        }
    }

    public int countActiveCommandersInCube() {
        PlayerStatus player = journalWatcherService.getPlayerStatus();
        if (player.getPosX() == null || player.getPosY() == null || player.getPosZ() == null) {
            return 0;
        }
        double px = player.getPosX();
        double py = player.getPosY();
        double pz = player.getPosZ();
        long now = System.currentTimeMillis();
        knownCommanders.entrySet().removeIf(e -> (now - e.getValue().timestamp) > 1_200_000L);

        int count = 0;
        for (CommanderTrack track : knownCommanders.values()) {
            if (calculateDistance(track.x, track.y, track.z, px, py, pz) <= DEFAULT_CUBE_RADIUS) {
                count++;
            }
        }
        return count;
    }

    public synchronized void recordTrafficEvent(TrafficEventDTO event) {
        recentEvents.add(event);
        // Mantém os últimos 50 eventos (janela de retenção de 30 minutos para o histórico do HUD)
        long cutoff = System.currentTimeMillis() - 1800000L;
        recentEvents.removeIf(e -> e.getTimestamp() < cutoff);
        if (recentEvents.size() > 50) {
            recentEvents.remove(0);
        }
    }

    public List<TrafficEventDTO> getRecentEvents(long since) {
        List<TrafficEventDTO> list = new ArrayList<>();
        for (TrafficEventDTO ev : recentEvents) {
            if (ev.getTimestamp() > since) {
                list.add(ev);
            }
        }
        return list;
    }

    private double calculateDistance(double x1, double y1, double z1, double x2, double y2, double z2) {
        double dx = x1 - x2;
        double dy = y1 - y2;
        double dz = z1 - z2;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private static class CommanderTrack {
        final String systemName;
        final double x, y, z;
        final long timestamp;

        CommanderTrack(String systemName, double x, double y, double z, long timestamp) {
            this.systemName = systemName;
            this.x = x;
            this.y = y;
            this.z = z;
            this.timestamp = timestamp;
        }
    }
}
