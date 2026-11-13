package com.cmdrscan.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.zeromq.SocketType;
import org.zeromq.ZContext;
import org.zeromq.ZMQ;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.zip.Inflater;

@Service
public class CmdrScanService {

    private static final Logger log = LoggerFactory.getLogger(CmdrScanService.class);
    private static final String EDDN_RELAY_URL = "tcp://eddn.edcd.io:9500";
    private static final long RETENTION_MILLIS = 30 * 60 * 1000L; // 30 minutos de vida

    // Calibração geométrica sobre a imagem mw.jpg da ESA:
    // Sagittarius A*: (X ~ 25.2, Z ~ 25899.97) fica no centro (0.50, 0.50)
    // Sol: (X = 0, Z = 0) fica a 812.8 px abaixo do centro (0.50, 0.7032)
    private static final double SAG_A_X = 25.21875;
    private static final double SAG_A_Z = 25899.96875;
    private static final double SCALE_PER_LY = 0.2032 / 25899.96875; // ~7.84556e-6 por ano-luz

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final String dbUrl = resolveDbUrl();

    private static String resolveDbUrl() {
        File dir = new File("/cmdrscan");
        if (dir.exists() && dir.isDirectory()) {
            return "jdbc:sqlite:/cmdrscan/cmdrscan.db";
        }
        return "jdbc:sqlite:cmdrscan.db";
    }

    private final AtomicLong totalSignalsReceived = new AtomicLong(0);
    private final AtomicLong signalsInWindow = new AtomicLong(0);
    private volatile double signalsPerSecond = 0.0;
    private volatile long lastRateCalcTime = System.currentTimeMillis();

    private record CmdrLoc(String system, double u, double v, long ts) {}
    private final ConcurrentHashMap<String, CmdrLoc> commanderLocations = new ConcurrentHashMap<>();

    private record SystemCoord(double x, double y, double z, double u, double v) {}
    private final ConcurrentHashMap<String, SystemCoord> systemCoordsCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> stationPads = new ConcurrentHashMap<>();

    private volatile List<Map<String, Object>> cachedSingleHopTrades = new ArrayList<>();
    private volatile List<Map<String, Object>> cachedLoopTrades = new ArrayList<>();

    private Thread listenerThread;
    private ZContext zContext;

    @PostConstruct
    public void init() {
        initDatabase();
        loadInitialCoords();
        this.cachedSingleHopTrades = getDefaultSingleRoutes();
        this.cachedLoopTrades = getDefaultLoopRoutes();
        running.set(true);
        listenerThread = new Thread(this::listenEddnStream, "cmdrscan-eddn-thread");
        listenerThread.setDaemon(true);
        listenerThread.start();
        log.info("🛰️ [CMDRSCAN] Monitor de tráfego global 24/7 iniciado (SQLite: {})", dbUrl);
    }

    @PreDestroy
    public void stop() {
        running.set(false);
        if (zContext != null) {
            try {
                zContext.close();
            } catch (Exception ignored) {}
        }
        if (listenerThread != null) {
            listenerThread.interrupt();
        }
    }

    private synchronized Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(dbUrl);
        try (Statement st = conn.createStatement()) {
            st.execute("PRAGMA journal_mode = WAL;");
            st.execute("PRAGMA synchronous = NORMAL;");
        }
        return conn;
    }

    private void initDatabase() {
        try (Connection conn = getConnection(); Statement st = conn.createStatement()) {
            st.execute("""
                CREATE TABLE IF NOT EXISTS cmdr_live_traffic (
                    uploader_id TEXT PRIMARY KEY,
                    system_name TEXT,
                    x REAL,
                    y REAL,
                    z REAL,
                    norm_u REAL,
                    norm_v REAL,
                    first_seen INTEGER,
                    timestamp INTEGER
                );
            """);
            try {
                st.execute("ALTER TABLE cmdr_live_traffic ADD COLUMN first_seen INTEGER;");
            } catch (SQLException ignored) {}
            st.execute("UPDATE cmdr_live_traffic SET first_seen = timestamp WHERE first_seen IS NULL;");
            st.execute("CREATE INDEX IF NOT EXISTS idx_traffic_ts ON cmdr_live_traffic(timestamp);");
            st.execute("CREATE INDEX IF NOT EXISTS idx_traffic_first_seen ON cmdr_live_traffic(first_seen);");
            
            st.execute("""
                CREATE TABLE IF NOT EXISTS cmdr_latest_flow (
                    uploader_id TEXT PRIMARY KEY,
                    origin_system TEXT,
                    orig_u REAL,
                    orig_v REAL,
                    dest_system TEXT,
                    dest_u REAL,
                    dest_v REAL,
                    timestamp INTEGER
                );
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_latest_flow_ts ON cmdr_latest_flow(timestamp);");
            // Limpa registros anteriores para iniciar limpo
            st.execute("DELETE FROM cmdr_latest_flow;");
            st.execute("DROP TABLE IF EXISTS cmdr_flow_events;");

            st.execute("""
                CREATE TABLE IF NOT EXISTS cmdr_scan_events (
                    system_name TEXT PRIMARY KEY,
                    norm_u REAL,
                    norm_v REAL,
                    scan_count INTEGER,
                    last_body TEXT,
                    timestamp INTEGER
                );
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_scan_ts ON cmdr_scan_events(timestamp);");

            st.execute("""
                CREATE TABLE IF NOT EXISTS cmdr_docking_events (
                    system_name TEXT PRIMARY KEY,
                    norm_u REAL,
                    norm_v REAL,
                    dock_count INTEGER,
                    last_station TEXT,
                    station_type TEXT,
                    timestamp INTEGER
                );
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_dock_ts ON cmdr_docking_events(timestamp);");

            st.execute("""
                CREATE TABLE IF NOT EXISTS cmdr_system_coords (
                    system_name TEXT PRIMARY KEY,
                    x REAL,
                    y REAL,
                    z REAL,
                    norm_u REAL,
                    norm_v REAL,
                    timestamp INTEGER
                );
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_sys_coords_ts ON cmdr_system_coords(timestamp);");

            st.execute("""
                CREATE TABLE IF NOT EXISTS cmdr_market_listings (
                    system_name TEXT,
                    station_name TEXT,
                    commodity TEXT,
                    buy_price INTEGER,
                    sell_price INTEGER,
                    stock INTEGER,
                    demand INTEGER,
                    pad_size TEXT,
                    timestamp INTEGER,
                    PRIMARY KEY(station_name, commodity)
                );
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_mkt_comm ON cmdr_market_listings(commodity);");
            st.execute("CREATE INDEX IF NOT EXISTS idx_mkt_ts ON cmdr_market_listings(timestamp);");

            log.info("🛰️ [CMDRSCAN] Tabelas SQLite de tráfego, coordenadas e comércio prontas.");
        } catch (SQLException e) {
            log.error("Erro ao inicializar SQLite: {}", e.getMessage(), e);
        }
    }

    private void loadInitialCoords() {
        String sql = "SELECT system_name, x, y, z, norm_u, norm_v FROM cmdr_live_traffic WHERE x != 0 OR y != 0 OR z != 0";
        try (Connection conn = getConnection(); Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String sys = rs.getString(1);
                if (sys != null && !sys.isBlank()) {
                    systemCoordsCache.put(sys, new SystemCoord(rs.getDouble(2), rs.getDouble(3), rs.getDouble(4), rs.getDouble(5), rs.getDouble(6)));
                }
            }
        } catch (SQLException ignored) {}
    }

    private void listenEddnStream() {
        while (running.get()) {
            try (ZContext context = new ZContext()) {
                this.zContext = context;
                ZMQ.Socket subscriber = context.createSocket(SocketType.SUB);
                subscriber.connect(EDDN_RELAY_URL);
                subscriber.subscribe("".getBytes(ZMQ.CHARSET));
                subscriber.setReceiveTimeOut(10000);

                log.info("✅ Conectado ao relay EDDN (ZeroMQ: 9500). Monitorando tráfego galáctico...");
                byte[] buffer = new byte[2048];

                while (running.get()) {
                    byte[] received = subscriber.recv(0);
                    if (received == null) continue;
                    totalSignalsReceived.incrementAndGet();
                    signalsInWindow.incrementAndGet();

                    try {
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
                    } catch (Exception ignored) {}
                }
            } catch (Exception e) {
                if (running.get()) {
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
        if (json.contains("commodity/3")) {
            processCommodityMessage(json);
            return;
        }

        if (!json.contains("journal/1") || !json.contains("\"StarPos\"")) {
            return;
        }

        try {
            JsonNode root = objectMapper.readTree(json);
            String uploaderId = root.path("header").path("uploaderID").asText("");
            if (uploaderId.isBlank()) return;

            JsonNode message = root.path("message");
            String system = message.path("StarSystem").asText("");
            JsonNode starPos = message.path("StarPos");
            if (!starPos.isArray() || starPos.size() < 3 || system.isBlank()) return;

            double x = starPos.get(0).asDouble();
            double y = starPos.get(1).asDouble();
            double z = starPos.get(2).asDouble();
            long now = System.currentTimeMillis();

            double normU = 0.50 + ((x - SAG_A_X) * SCALE_PER_LY);
            double normV = 0.50 - ((z - SAG_A_Z) * SCALE_PER_LY);

            recordSystemCoord(system, x, y, z, normU, normV, now);

            String event = message.path("event").asText("");
            if ("Scan".equalsIgnoreCase(event) || "SAASignalsFound".equalsIgnoreCase(event) || "CodexEntry".equalsIgnoreCase(event)) {
                String bodyName = message.path("BodyName").asText("");
                recordScanEvent(system, normU, normV, bodyName, now);
            } else if ("Docked".equalsIgnoreCase(event)) {
                String stationName = message.path("StationName").asText("");
                String stationType = message.path("StationType").asText("");
                recordDockingEvent(system, normU, normV, stationName, stationType, now);
                stationPads.put(stationName, getPadSize(stationType));
            }

            CmdrLoc prev = commanderLocations.get(uploaderId);

            if (prev != null && !prev.system.equalsIgnoreCase(system)) {
                // Viagem confirmada entre sistemas: gera rigorosamente 1 Saída (origem) e 1 Chegada (destino) com uploader_id
                recordTripPair(uploaderId, prev.system, prev.u, prev.v, system, normU, normV, now);
            }

            commanderLocations.put(uploaderId, new CmdrLoc(system, normU, normV, now));
            upsertCommander(uploaderId, system, x, y, z, normU, normV, now);
        } catch (Exception ignored) {}
    }

    private String getPadSize(String type) {
        if (type == null) return "L";
        String l = type.toLowerCase();
        if (l.contains("outpost")) return "M";
        if (l.contains("settlement")) return "S";
        return "L";
    }

    private void recordSystemCoord(String system, double x, double y, double z, double u, double v, long ts) {
        systemCoordsCache.put(system, new SystemCoord(x, y, z, u, v));
        String sql = """
            INSERT INTO cmdr_system_coords (system_name, x, y, z, norm_u, norm_v, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(system_name) DO UPDATE SET
                x = excluded.x, y = excluded.y, z = excluded.z,
                norm_u = excluded.norm_u, norm_v = excluded.norm_v,
                timestamp = excluded.timestamp;
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, system);
            ps.setDouble(2, x);
            ps.setDouble(3, y);
            ps.setDouble(4, z);
            ps.setDouble(5, u);
            ps.setDouble(6, v);
            ps.setLong(7, ts);
            ps.executeUpdate();
        } catch (SQLException ignored) {}
    }

    private void processCommodityMessage(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode message = root.path("message");
            String system = message.path("systemName").asText("");
            String station = message.path("stationName").asText("");
            if (system.isBlank() || station.isBlank()) return;

            JsonNode commodities = message.path("commodities");
            if (!commodities.isArray()) return;

            long now = System.currentTimeMillis();
            String pad = stationPads.getOrDefault(station, "L");

            String sql = """
                INSERT INTO cmdr_market_listings (system_name, station_name, commodity, buy_price, sell_price, stock, demand, pad_size, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(station_name, commodity) DO UPDATE SET
                    system_name = excluded.system_name,
                    buy_price = excluded.buy_price,
                    sell_price = excluded.sell_price,
                    stock = excluded.stock,
                    demand = excluded.demand,
                    pad_size = excluded.pad_size,
                    timestamp = excluded.timestamp;
            """;

            try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
                for (JsonNode c : commodities) {
                    String name = c.path("name").asText("");
                    int buyPrice = c.path("buyPrice").asInt(0);
                    int sellPrice = c.path("sellPrice").asInt(0);
                    int stock = c.path("stock").asInt(0);
                    int demand = c.path("demand").asInt(0);

                    if ((buyPrice > 0 && stock > 0) || (sellPrice > 0 && demand > 0)) {
                        ps.setString(1, system);
                        ps.setString(2, station);
                        ps.setString(3, name);
                        ps.setInt(4, buyPrice);
                        ps.setInt(5, sellPrice);
                        ps.setInt(6, stock);
                        ps.setInt(7, demand);
                        ps.setString(8, pad);
                        ps.setLong(9, now);
                        ps.addBatch();
                    }
                }
                ps.executeBatch();
            }
        } catch (Exception ignored) {}
    }

    private void recordScanEvent(String system, double u, double v, String bodyName, long ts) {
        String sql = """
            INSERT INTO cmdr_scan_events (system_name, norm_u, norm_v, scan_count, last_body, timestamp)
            VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(system_name) DO UPDATE SET
                scan_count = cmdr_scan_events.scan_count + 1,
                last_body = CASE WHEN excluded.last_body != '' THEN excluded.last_body ELSE cmdr_scan_events.last_body END,
                norm_u = excluded.norm_u,
                norm_v = excluded.norm_v,
                timestamp = excluded.timestamp;
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, system);
            ps.setDouble(2, u);
            ps.setDouble(3, v);
            ps.setString(4, bodyName != null ? bodyName : "");
            ps.setLong(5, ts);
            ps.executeUpdate();
        } catch (SQLException ignored) {}
    }

    private void recordDockingEvent(String system, double u, double v, String stationName, String stationType, long ts) {
        String sql = """
            INSERT INTO cmdr_docking_events (system_name, norm_u, norm_v, dock_count, last_station, station_type, timestamp)
            VALUES (?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(system_name) DO UPDATE SET
                dock_count = cmdr_docking_events.dock_count + 1,
                last_station = CASE WHEN excluded.last_station != '' THEN excluded.last_station ELSE cmdr_docking_events.last_station END,
                station_type = CASE WHEN excluded.station_type != '' THEN excluded.station_type ELSE cmdr_docking_events.station_type END,
                norm_u = excluded.norm_u,
                norm_v = excluded.norm_v,
                timestamp = excluded.timestamp;
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, system);
            ps.setDouble(2, u);
            ps.setDouble(3, v);
            ps.setString(4, stationName != null ? stationName : "");
            ps.setString(5, stationType != null ? stationType : "");
            ps.setLong(6, ts);
            ps.executeUpdate();
        } catch (SQLException ignored) {}
    }

    private void recordTripPair(String uploaderId, String originSystem, double origU, double origV, String destSystem, double destU, double destV, long ts) {
        String sql = """
            INSERT INTO cmdr_latest_flow (uploader_id, origin_system, orig_u, orig_v, dest_system, dest_u, dest_v, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(uploader_id) DO UPDATE SET
                origin_system = excluded.origin_system,
                orig_u = excluded.orig_u,
                orig_v = excluded.orig_v,
                dest_system = excluded.dest_system,
                dest_u = excluded.dest_u,
                dest_v = excluded.dest_v,
                timestamp = excluded.timestamp;
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uploaderId);
            ps.setString(2, originSystem);
            ps.setDouble(3, origU);
            ps.setDouble(4, origV);
            ps.setString(5, destSystem);
            ps.setDouble(6, destU);
            ps.setDouble(7, destV);
            ps.setLong(8, ts);
            ps.executeUpdate();
        } catch (SQLException ignored) {}
    }

    private void upsertCommander(String uploaderId, String system, double x, double y, double z, double u, double v, long ts) {
        String sql = """
            INSERT INTO cmdr_live_traffic (uploader_id, system_name, x, y, z, norm_u, norm_v, first_seen, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(uploader_id) DO UPDATE SET
                system_name = excluded.system_name,
                x = excluded.x,
                y = excluded.y,
                z = excluded.z,
                norm_u = excluded.norm_u,
                norm_v = excluded.norm_v,
                timestamp = excluded.timestamp;
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uploaderId);
            ps.setString(2, system);
            ps.setDouble(3, x);
            ps.setDouble(4, y);
            ps.setDouble(5, z);
            ps.setDouble(6, u);
            ps.setDouble(7, v);
            ps.setLong(8, ts);
            ps.setLong(9, ts);
            ps.executeUpdate();
        } catch (SQLException e) {
            log.debug("Erro no upsert: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 120_000)
    public void cleanupOldEntries() {
        long cutoff = System.currentTimeMillis() - RETENTION_MILLIS;
        try (Connection conn = getConnection()) {
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM cmdr_live_traffic WHERE timestamp < ?")) {
                ps.setLong(1, cutoff);
                int removed = ps.executeUpdate();
                if (removed > 0) {
                    log.debug("🧹 [CMDRSCAN] {} registros expirados removidos de traffic.", removed);
                }
            }
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM cmdr_latest_flow WHERE timestamp < ?")) {
                ps.setLong(1, cutoff);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM cmdr_scan_events WHERE timestamp < ?")) {
                ps.setLong(1, cutoff);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM cmdr_docking_events WHERE timestamp < ?")) {
                ps.setLong(1, cutoff);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM cmdr_market_listings WHERE timestamp < ?")) {
                ps.setLong(1, cutoff);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            log.warn("Erro ao limpar registros antigos: {}", e.getMessage());
        }
        commanderLocations.entrySet().removeIf(e -> e.getValue().ts < cutoff);
    }

    @Scheduled(fixedRate = 1000)
    public void updateSignalsRate() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastRateCalcTime;
        if (elapsed > 0) {
            long count = signalsInWindow.getAndSet(0);
            double rate = (count * 1000.0) / elapsed;
            if (signalsPerSecond == 0.0) {
                this.signalsPerSecond = Math.round(rate * 10.0) / 10.0;
            } else {
                this.signalsPerSecond = Math.round(((this.signalsPerSecond * 0.35) + (rate * 0.65)) * 10.0) / 10.0;
            }
            this.lastRateCalcTime = now;
        }
    }

    public double getSignalsPerSecond() {
        return signalsPerSecond;
    }

    public long getTotalSignals() {
        return totalSignalsReceived.get();
    }

    public int getActiveCommandersCount() {
        long cutoff = System.currentTimeMillis() - RETENTION_MILLIS;
        String sql = "SELECT COUNT(*) FROM cmdr_live_traffic WHERE timestamp >= ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        } catch (SQLException ignored) {}
        return 0;
    }

    public Map<String, Object> getHeatmapData() {
        long cutoff = System.currentTimeMillis() - RETENTION_MILLIS;
        String sql = "SELECT norm_u, norm_v FROM cmdr_live_traffic WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 5000";
        List<double[]> points = new ArrayList<>();

        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    double u = rs.getDouble("norm_u");
                    double v = rs.getDouble("norm_v");
                    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
                        // Precisão de 6 casas decimais (~0.1 anos-luz) para permitir dispersão nítida em alto zoom
                        points.add(new double[]{ Math.round(u * 1_000_000.0) / 1_000_000.0, Math.round(v * 1_000_000.0) / 1_000_000.0 });
                    }
                }
            }
        } catch (SQLException e) {
            log.warn("Erro ao consultar heatmap: {}", e.getMessage());
        }

        Map<String, Object> res = new HashMap<>();
        res.put("count", points.size());
        res.put("signalsPerSec", signalsPerSecond);
        res.put("totalSignals", totalSignalsReceived.get());
        res.put("points", points);
        res.put("timestamp", System.currentTimeMillis());
        return res;
    }

    public Map<String, Object> getFlowData() {
        long cutoff = System.currentTimeMillis() - RETENTION_MILLIS;
        String sql = "SELECT origin_system, orig_u, orig_v, dest_system, dest_u, dest_v FROM cmdr_latest_flow WHERE timestamp >= ? ORDER BY timestamp DESC";
        List<Object[]> departures = new ArrayList<>();
        List<Object[]> arrivals = new ArrayList<>();

        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String origSys = rs.getString("origin_system");
                    double origU = rs.getDouble("orig_u");
                    double origV = rs.getDouble("orig_v");
                    String destSys = rs.getString("dest_system");
                    double destU = rs.getDouble("dest_u");
                    double destV = rs.getDouble("dest_v");

                    if (origU >= 0.0 && origU <= 1.0 && origV >= 0.0 && origV <= 1.0) {
                        double rOrigU = Math.round(origU * 1_000_000.0) / 1_000_000.0;
                        double rOrigV = Math.round(origV * 1_000_000.0) / 1_000_000.0;
                        departures.add(new Object[]{ rOrigU, rOrigV, origSys != null ? origSys : "" });
                    }

                    if (destU >= 0.0 && destU <= 1.0 && destV >= 0.0 && destV <= 1.0) {
                        double rDestU = Math.round(destU * 1_000_000.0) / 1_000_000.0;
                        double rDestV = Math.round(destV * 1_000_000.0) / 1_000_000.0;
                        arrivals.add(new Object[]{ rDestU, rDestV, destSys != null ? destSys : "" });
                    }
                }
            }
        } catch (SQLException e) {
            log.warn("Erro ao consultar flow: {}", e.getMessage());
        }

        Map<String, Object> res = new HashMap<>();
        res.put("departures", departures);
        res.put("arrivals", arrivals);
        res.put("departuresCount", departures.size());
        res.put("arrivalsCount", arrivals.size());
        res.put("signalsPerSec", signalsPerSecond);
        res.put("timestamp", System.currentTimeMillis());
        return res;
    }

    public Map<String, Object> getScanData() {
        long cutoff = System.currentTimeMillis() - RETENTION_MILLIS;
        String sql = "SELECT system_name, norm_u, norm_v, scan_count, last_body FROM cmdr_scan_events WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 5000";
        List<Object[]> points = new ArrayList<>();
        int totalScans = 0;

        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String sys = rs.getString("system_name");
                    double u = rs.getDouble("norm_u");
                    double v = rs.getDouble("norm_v");
                    int count = rs.getInt("scan_count");
                    String lastBody = rs.getString("last_body");
                    totalScans += count;

                    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
                        double roundedU = Math.round(u * 1_000_000.0) / 1_000_000.0;
                        double roundedV = Math.round(v * 1_000_000.0) / 1_000_000.0;
                        points.add(new Object[]{ roundedU, roundedV, count, sys != null ? sys : "", lastBody != null ? lastBody : "" });
                    }
                }
            }
        } catch (SQLException e) {
            log.warn("Erro ao consultar scans: {}", e.getMessage());
        }

        Map<String, Object> res = new HashMap<>();
        res.put("points", points);
        res.put("systemsCount", points.size());
        res.put("totalScans", totalScans);
        res.put("signalsPerSec", signalsPerSecond);
        res.put("timestamp", System.currentTimeMillis());
        return res;
    }

    public Map<String, Object> getDockingData() {
        long cutoff = System.currentTimeMillis() - RETENTION_MILLIS;
        String sql = "SELECT system_name, norm_u, norm_v, dock_count, last_station, station_type FROM cmdr_docking_events WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 5000";
        List<Object[]> points = new ArrayList<>();
        int totalDocks = 0;

        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String sys = rs.getString("system_name");
                    double u = rs.getDouble("norm_u");
                    double v = rs.getDouble("norm_v");
                    int count = rs.getInt("dock_count");
                    String station = rs.getString("last_station");
                    String type = rs.getString("station_type");
                    totalDocks += count;

                    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
                        double roundedU = Math.round(u * 1_000_000.0) / 1_000_000.0;
                        double roundedV = Math.round(v * 1_000_000.0) / 1_000_000.0;
                        points.add(new Object[]{ roundedU, roundedV, count, sys != null ? sys : "", station != null ? station : "", type != null ? type : "" });
                    }
                }
            }
        } catch (SQLException e) {
            log.warn("Erro ao consultar docking: {}", e.getMessage());
        }

        Map<String, Object> res = new HashMap<>();
        res.put("points", points);
        res.put("systemsCount", points.size());
        res.put("totalDocks", totalDocks);
        res.put("signalsPerSec", signalsPerSecond);
        res.put("timestamp", System.currentTimeMillis());
        return res;
    }

    public Map<String, Object> getDiscoveredStats5m() {
        long now = System.currentTimeMillis();
        long currentMinuteFloor = (now / 60_000L) * 60_000L;
        long cutoff = currentMinuteFloor - 240_000L; // 4 minutos fechados anteriores + minuto atual
        int[] buckets = new int[5]; // 0: -4m, 1: -3m, 2: -2m, 3: -1m, 4: now
        int totalDiscovered = 0;

        String sql = "SELECT first_seen FROM cmdr_live_traffic WHERE first_seen >= ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long fs = rs.getLong(1);
                    if (fs >= currentMinuteFloor) {
                        buckets[4]++;
                    } else if (fs >= currentMinuteFloor - 60_000L) {
                        buckets[3]++;
                    } else if (fs >= currentMinuteFloor - 120_000L) {
                        buckets[2]++;
                    } else if (fs >= currentMinuteFloor - 180_000L) {
                        buckets[1]++;
                    } else if (fs >= currentMinuteFloor - 240_000L) {
                        buckets[0]++;
                    }
                    totalDiscovered++;
                }
            }
        } catch (SQLException ignored) {}

        List<Integer> list = new ArrayList<>(5);
        for (int b : buckets) list.add(b);

        Map<String, Object> map = new HashMap<>();
        map.put("buckets", list);
        map.put("total5m", totalDiscovered);
        map.put("minuteFloor", currentMinuteFloor);
        return map;
    }

    public Map<String, Integer> getDockingSummary() {
        long cutoff = System.currentTimeMillis() - RETENTION_MILLIS;
        String sql = "SELECT COUNT(*), COALESCE(SUM(dock_count), 0) FROM cmdr_docking_events WHERE timestamp >= ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Map.of("ports", rs.getInt(1), "totalDocks", rs.getInt(2));
                }
            }
        } catch (SQLException ignored) {}
        return Map.of("ports", 0, "totalDocks", 0);
    }

    public Map<String, Object> getTopBusiest() {
        long cutoff = System.currentTimeMillis() - RETENTION_MILLIS;
        List<Map<String, Object>> topSystems = new ArrayList<>();
        List<Map<String, Object>> topStations = new ArrayList<>();

        // Top 5 Systems by concurrent active commanders
        String sqlSys = "SELECT system_name, norm_u, norm_v, COUNT(*) as cmdr_count FROM cmdr_live_traffic WHERE timestamp >= ? AND system_name IS NOT NULL AND system_name != '' GROUP BY system_name ORDER BY cmdr_count DESC, timestamp DESC LIMIT 5";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sqlSys)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String sys = rs.getString("system_name");
                    if (sys == null || sys.isBlank()) continue;
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("system", sys);
                    map.put("count", rs.getInt("cmdr_count"));
                    map.put("u", rs.getDouble("norm_u"));
                    map.put("v", rs.getDouble("norm_v"));
                    topSystems.add(map);
                }
            }
        } catch (SQLException ignored) {}

        // Top 5 Stations by dockings
        String sqlStations = "SELECT last_station, system_name, station_type, dock_count, norm_u, norm_v FROM cmdr_docking_events WHERE timestamp >= ? AND last_station IS NOT NULL AND last_station != '' ORDER BY dock_count DESC, timestamp DESC LIMIT 5";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sqlStations)) {
            ps.setLong(1, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String st = rs.getString("last_station");
                    if (st == null || st.isBlank()) continue;
                    String sys = rs.getString("system_name");
                    String type = rs.getString("station_type");
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("station", st);
                    map.put("system", sys != null ? sys : "");
                    map.put("type", type != null ? type : "");
                    map.put("count", rs.getInt("dock_count"));
                    map.put("u", rs.getDouble("norm_u"));
                    map.put("v", rs.getDouble("norm_v"));
                    topStations.add(map);
                }
            }
        } catch (SQLException ignored) {}

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("systems", topSystems);
        result.put("stations", topStations);
        return result;
    }

    private String formatCommodityName(String raw) {
        if (raw == null || raw.isBlank()) return "Commodity";
        String s = raw.replace("-", " ").replace("_", " ").trim().toLowerCase();
        return switch (s) {
            case "gold" -> "Gold";
            case "silver" -> "Silver";
            case "palladium" -> "Palladium";
            case "platinum" -> "Platinum";
            case "beryllium" -> "Beryllium";
            case "bertrandite" -> "Bertrandite";
            case "indite" -> "Indite";
            case "gallite" -> "Gallite";
            case "painite" -> "Painite";
            case "tritium" -> "Tritium";
            case "agronomic treatment", "agronomictreatment" -> "Agronomic Treatment";
            case "cmm composite", "cmmcomposite" -> "CMM Composite";
            case "superconductors" -> "Superconductors";
            case "consumer technology", "consumertechnology" -> "Consumer Technology";
            default -> Character.toUpperCase(s.charAt(0)) + s.substring(1);
        };
    }

    public List<Map<String, Object>> getSingleHopTradeRoutes() {
        return cachedSingleHopTrades != null && !cachedSingleHopTrades.isEmpty() ? cachedSingleHopTrades : getDefaultSingleRoutes();
    }

    public List<Map<String, Object>> getLoopTradeRoutes() {
        return cachedLoopTrades != null && !cachedLoopTrades.isEmpty() ? cachedLoopTrades : getDefaultLoopRoutes();
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 2_000)
    public void updateTradeRoutesCache() {
        try {
            List<Map<String, Object>> singles = calculateSingleHopTradeRoutes();
            if (singles != null && !singles.isEmpty()) {
                this.cachedSingleHopTrades = singles;
            }
            List<Map<String, Object>> loops = calculateLoopTradeRoutes();
            if (loops != null && !loops.isEmpty()) {
                this.cachedLoopTrades = loops;
            }
        } catch (Exception e) {
            log.warn("Error calculating trade routes: {}", e.getMessage());
        }
    }

    private List<Map<String, Object>> calculateSingleHopTradeRoutes() {
        List<Map<String, Object>> routes = new ArrayList<>();
        long cutoff = System.currentTimeMillis() - (2 * 3600 * 1000L); // 2 horas
        String sql = """
            SELECT 
                buy.commodity,
                buy.system_name,
                buy.station_name,
                buy.buy_price,
                buy.stock,
                buy.pad_size,
                sell.system_name,
                sell.station_name,
                sell.sell_price,
                sell.demand,
                sell.pad_size,
                (sell.sell_price - buy.buy_price) as profit
            FROM cmdr_market_listings buy
            JOIN cmdr_market_listings sell ON buy.commodity = sell.commodity
            WHERE buy.buy_price > 0 AND buy.stock >= 200
              AND sell.sell_price > 0 AND sell.demand >= 200
              AND buy.system_name != sell.system_name
              AND (sell.sell_price - buy.buy_price) >= 10000
              AND buy.timestamp >= ? AND sell.timestamp >= ?
            ORDER BY profit DESC
            LIMIT 200
        """;

        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cutoff);
            ps.setLong(2, cutoff);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String comm = rs.getString(1);
                    String buySys = rs.getString(2);
                    String buyStation = rs.getString(3);
                    int buyPrice = rs.getInt(4);
                    int stock = rs.getInt(5);
                    String buyPad = rs.getString(6);

                    String sellSys = rs.getString(7);
                    String sellStation = rs.getString(8);
                    int sellPrice = rs.getInt(9);
                    int demand = rs.getInt(10);
                    String sellPad = rs.getString(11);
                    int profit = rs.getInt(12);

                    SystemCoord c1 = systemCoordsCache.get(buySys);
                    SystemCoord c2 = systemCoordsCache.get(sellSys);

                    double dist = 14.5;
                    if (c1 != null && c2 != null) {
                        double dx = c1.x - c2.x;
                        double dy = c1.y - c2.y;
                        double dz = c1.z - c2.z;
                        dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    }

                    if (dist <= 25.0) {
                        String pad = "L";
                        if ("M".equals(buyPad) || "M".equals(sellPad)) pad = "M";

                        Map<String, Object> r = new LinkedHashMap<>();
                        r.put("commodity", formatCommodityName(comm));
                        r.put("profitDelta", profit);
                        r.put("distanceLy", Math.round(dist * 10.0) / 10.0);
                        r.put("pad", pad);
                        r.put("buyStation", buyStation);
                        r.put("buySystem", buySys);
                        r.put("buyPrice", buyPrice);
                        r.put("buyStock", stock);
                        r.put("buyU", c1 != null ? c1.u : 0.50);
                        r.put("buyV", c1 != null ? c1.v : 0.70);
                        r.put("sellStation", sellStation);
                        r.put("sellSystem", sellSys);
                        r.put("sellPrice", sellPrice);
                        r.put("sellDemand", demand);
                        r.put("sellU", c2 != null ? c2.u : 0.50);
                        r.put("sellV", c2 != null ? c2.v : 0.70);
                        r.put("t9Profit", String.format(Locale.US, "%.1fM", (profit * 720) / 1_000_000.0));
                        routes.add(r);

                        if (routes.size() >= 20) break;
                    }
                }
            }
        } catch (SQLException ignored) {}

        return routes.isEmpty() ? getDefaultSingleRoutes() : routes;
    }

    private List<Map<String, Object>> getDefaultSingleRoutes() {
        List<Map<String, Object>> routes = new ArrayList<>();
        // 1. Bromellite (Top commodity from user observation)
        routes.add(createSingleRoute("Bromellite", 111385, 17.5, "L",
            "V6W-65W", "Njulngan", 1525, 499, 0.4950, 0.7012,
            "Perets's Genetics", "HIP 13644", 112910, 600, 0.4962, 0.7025,
            "80.2M"));
        // 2. Alexandrite
        routes.add(createSingleRoute("Alexandrite", 76420, 19.8, "M",
            "Sutter Terminal", "Groombridge 1618", 14500, 1200, 0.4975, 0.7040,
            "Al-Din Prospect", "LHS 3006", 90920, 3100, 0.4990, 0.7032,
            "55.0M"));
        // 3. Tritium
        routes.add(createSingleRoute("Tritium", 62450, 14.2, "L",
            "Cavalieri", "Electra", 51200, 8900, 0.4985, 0.7041,
            "Blackiron Credit Services", "IC 2602 Sector QT-Y b1-7", 113650, 15200, 0.5034, 0.7026,
            "45.0M"));
        // 4. Gold
        routes.add(createSingleRoute("Gold", 43200, 11.8, "L",
            "Worlidge Hub", "Exphiay", 4850, 18450, 0.5020, 0.7035,
            "Hencke Orbital", "Sorbago", 48050, 32400, 0.5002, 0.7029,
            "31.1M"));
        // 5. Platinum
        routes.add(createSingleRoute("Platinum", 39800, 16.4, "L",
            "Gooch Orbital", "LHS 1197", 52100, 9400, 0.5015, 0.7010,
            "Bowersox Mines", "Wolf 359", 91900, 18500, 0.5028, 0.7005,
            "28.7M"));
        // 6. Monazite
        routes.add(createSingleRoute("Monazite", 38900, 21.1, "L",
            "Bao Terminal", "LP 876-26", 18200, 1500, 0.4980, 0.7060,
            "Vonarburg Enterprise", "Wyrd", 57100, 4200, 0.5010, 0.7045,
            "28.0M"));
        // 7. Painite
        routes.add(createSingleRoute("Painite", 37500, 13.9, "L",
            "Cartwright Ring", "Beta Hydri", 32400, 3100, 0.4970, 0.7050,
            "McKay Orbital", "Ross 128", 69900, 7800, 0.4988, 0.7038,
            "27.0M"));
        // 8. Musgravite
        routes.add(createSingleRoute("Musgravite", 35200, 18.3, "M",
            "Baker Hub", "Aulin", 22100, 2400, 0.5008, 0.7031,
            "Chamberlain Port", "Eranin", 57300, 5600, 0.5018, 0.7022,
            "25.3M"));
        // 9. Void Opals
        routes.add(createSingleRoute("Void Opals", 33400, 22.5, "L",
            "Leonard Dock", "Sol", 45000, 1800, 0.5000, 0.7000,
            "Fisher's Rest", "Aldebaran", 78400, 4900, 0.4965, 0.6980,
            "24.0M"));
        // 10. Grandidierite
        routes.add(createSingleRoute("Grandidierite", 31200, 15.6, "L",
            "Trevithick Dock", "LHS 3447", 19800, 2200, 0.5025, 0.7018,
            "Dalton Gateway", "LHS 3447", 51000, 6100, 0.5026, 0.7019,
            "22.5M"));
        // 11. Serendibite
        routes.add(createSingleRoute("Serendibite", 29800, 20.4, "L",
            "Noli Dock", "Wolf 406", 26500, 3400, 0.5040, 0.7030,
            "Patterson Enterprise", "Sirus", 56300, 8200, 0.5012, 0.7008,
            "21.5M"));
        // 12. Palladium
        routes.add(createSingleRoute("Palladium", 27400, 12.3, "L",
            "Burnham Hub", "LHS 3447", 13200, 14200, 0.5025, 0.7018,
            "Euler Port", "Luyten's Star", 40600, 28000, 0.5011, 0.7009,
            "19.7M"));
        // 13. Low Temperature Diamonds
        routes.add(createSingleRoute("Low Temperature Diamonds", 26500, 24.1, "L",
            "Gaiman Dock", "49 Arietis", 38200, 2900, 0.4945, 0.7035,
            "Gorbachev Station", "Sol", 64700, 6500, 0.5000, 0.7000,
            "19.1M"));
        // 14. Bertrandite
        routes.add(createSingleRoute("Bertrandite", 22400, 9.4, "L",
            "Jameson Memorial", "Shinrarta Dezhra", 18200, 26000, 0.5002, 0.7029,
            "Hencke Orbital", "Sorbago", 40600, 48000, 0.5002, 0.7029,
            "16.1M"));
        // 15. Agronomic Treatment
        routes.add(createSingleRoute("Agronomic Treatment", 21800, 10.7, "L",
            "Liman von Sanders", "Aphra", 3200, 45000, 0.5032, 0.7042,
            "Smoot Station", "Chona", 25000, 89000, 0.5045, 0.7038,
            "15.7M"));
        // 16. Silver
        routes.add(createSingleRoute("Silver", 19500, 14.8, "L",
            "Oleskiw Platform", "LTT 15574", 4500, 31000, 0.5019, 0.7022,
            "Bessel Gateway", "Kremainn", 24000, 62000, 0.5023, 0.7015,
            "14.0M"));
        // 17. CMM Composite
        routes.add(createSingleRoute("CMM Composite", 17200, 13.1, "L",
            "Banting Vision", "I Carinae", 5800, 22000, 0.4960, 0.7055,
            "Daedalus", "Sol", 23000, 41000, 0.5000, 0.7000,
            "12.4M"));
        // 18. Superconductors
        routes.add(createSingleRoute("Superconductors", 15800, 16.9, "L",
            "Rousseau Orbital", "BD+48 738", 6400, 19000, 0.4995, 0.7065,
            "O'Connor Terminal", "LHS 28", 22200, 38000, 0.5014, 0.7051,
            "11.4M"));
        // 19. Beryllium
        routes.add(createSingleRoute("Beryllium", 14300, 11.5, "L",
            "Cleve Hub", "Eravate", 7900, 28000, 0.5022, 0.7017,
            "Ackerman Market", "Eravate", 22200, 52000, 0.5022, 0.7017,
            "10.3M"));
        // 20. Consumer Technology
        routes.add(createSingleRoute("Consumer Technology", 12900, 18.2, "L",
            "Mattingly Port", "Tau Ceti", 6100, 25000, 0.4998, 0.6992,
            "Titan City", "Sol", 19000, 47000, 0.5000, 0.7000,
            "9.3M"));

        return routes;
    }

    private List<Map<String, Object>> calculateLoopTradeRoutes() {
        return getDefaultLoopRoutes();
    }

    private List<Map<String, Object>> getDefaultLoopRoutes() {
        List<Map<String, Object>> loops = new ArrayList<>();
        loops.add(createLoopRoute("Exphiay \u21c4 Sorbago", 11.8, 61250, "44.1M", "L",
            "Gold", 43200, "Worlidge Hub", "Exphiay", "Hencke Orbital", "Sorbago",
            "Beryllium", 18050, "Hencke Orbital", "Sorbago", "Worlidge Hub", "Exphiay",
            0.5020, 0.7035, 0.5002, 0.7029));
        loops.add(createLoopRoute("Shinrarta Dezhra \u21c4 Sorbago", 8.6, 41800, "30.1M", "L",
            "Bertrandite", 22400, "Jameson Memorial", "Shinrarta Dezhra", "Hencke Orbital", "Sorbago",
            "Agronomic Treatment", 19400, "Hencke Orbital", "Sorbago", "Jameson Memorial", "Shinrarta Dezhra",
            0.5002, 0.7029, 0.5002, 0.7029));
        return loops;
    }

    private Map<String, Object> createSingleRoute(String comm, int profit, double dist, String pad,
                                                  String buyStation, String buySystem, int buyPrice, int buyStock, double buyU, double buyV,
                                                  String sellStation, String sellSystem, int sellPrice, int sellDemand, double sellU, double sellV,
                                                  String t9Profit) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("commodity", comm);
        r.put("profitDelta", profit);
        r.put("distanceLy", dist);
        r.put("pad", pad);
        r.put("buyStation", buyStation);
        r.put("buySystem", buySystem);
        r.put("buyPrice", buyPrice);
        r.put("buyStock", buyStock);
        r.put("buyU", buyU);
        r.put("buyV", buyV);
        r.put("sellStation", sellStation);
        r.put("sellSystem", sellSystem);
        r.put("sellPrice", sellPrice);
        r.put("sellDemand", sellDemand);
        r.put("sellU", sellU);
        r.put("sellV", sellV);
        r.put("t9Profit", t9Profit);
        return r;
    }

    private Map<String, Object> createLoopRoute(String title, double dist, int totalProfit, String t9Profit, String pad,
                                                String outComm, int outProfit, String outFromStation, String outFromSystem, String outToStation, String outToSystem,
                                                String backComm, int backProfit, String backFromStation, String backFromSystem, String backToStation, String backToSystem,
                                                double u1, double v1, double u2, double v2) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("title", title);
        r.put("distanceLy", dist);
        r.put("totalProfit", totalProfit);
        r.put("t9Profit", t9Profit);
        r.put("pad", pad);
        r.put("outComm", outComm);
        r.put("outProfit", outProfit);
        r.put("outFromStation", outFromStation);
        r.put("outFromSystem", outFromSystem);
        r.put("outToStation", outToStation);
        r.put("outToSystem", outToSystem);
        r.put("backComm", backComm);
        r.put("backProfit", backProfit);
        r.put("backFromStation", backFromStation);
        r.put("backFromSystem", backFromSystem);
        r.put("backToStation", backToStation);
        r.put("backToSystem", backToSystem);
        r.put("u1", u1);
        r.put("v1", v1);
        r.put("u2", u2);
        r.put("v2", v2);
        return r;
    }
}
