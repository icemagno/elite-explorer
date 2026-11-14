package com.eliteexplorer.service;

import com.eliteexplorer.dto.SurfaceFeatureDTO;
import com.eliteexplorer.dto.VisitedPlanetRecordDTO;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.sql.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Serviço de Armazenamento Unificado em SQLite para o Copilot.
 * Substitui os múltiplos arquivos JSON por tabelas transacionais indexadas
 * no mesmo banco de dados do CmdrScan (cmdrscan.db).
 */
@Service
public class CopilotDatabaseService {

    private static final Logger log = LoggerFactory.getLogger(CopilotDatabaseService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String dbUrl = CmdrScanService.resolveDbUrl();

    @PostConstruct
    public void init() {
        initTables();
        migrateLegacyJsonFiles();
        log.info("💾 [COPILOT DB] Banco de dados unificado inicializado com sucesso (SQLite: {})", dbUrl);
    }

    private synchronized Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(dbUrl);
        try (Statement st = conn.createStatement()) {
            st.execute("PRAGMA journal_mode = WAL;");
            st.execute("PRAGMA synchronous = NORMAL;");
        }
        return conn;
    }

    private void initTables() {
        try (Connection conn = getConnection(); Statement st = conn.createStatement()) {
            // 1. Sistemas Descobertos pelo Comandante
            st.execute("""
                CREATE TABLE IF NOT EXISTS copilot_discovered_systems (
                    system_name TEXT PRIMARY KEY,
                    first_seen INTEGER
                );
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_copilot_disc_sys ON copilot_discovered_systems(first_seen);");

            // 2. Histórico de Exploração Planetária e Pousos
            st.execute("""
                CREATE TABLE IF NOT EXISTS copilot_planet_history (
                    planet_name TEXT PRIMARY KEY,
                    system_name TEXT,
                    landing_count INTEGER,
                    data_json TEXT,
                    updated_at INTEGER
                );
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_copilot_planet_sys ON copilot_planet_history(system_name);");

            // 3. Estruturas de Solo e POIs Conhecidos
            st.execute("""
                CREATE TABLE IF NOT EXISTS copilot_surface_features (
                    body_name TEXT,
                    feature_name TEXT,
                    feature_type TEXT,
                    latitude REAL,
                    longitude REAL,
                    is_gps_confirmed INTEGER,
                    system_name TEXT,
                    data_json TEXT,
                    updated_at INTEGER,
                    PRIMARY KEY (body_name, feature_name)
                );
            """);
            st.execute("CREATE INDEX IF NOT EXISTS idx_copilot_feat_body ON copilot_surface_features(body_name);");

            // 4. Cache de Corpos Celestes do Sistema (Orrery)
            st.execute("""
                CREATE TABLE IF NOT EXISTS copilot_system_bodies (
                    system_name TEXT PRIMARY KEY,
                    data_json TEXT,
                    updated_at INTEGER
                );
            """);

            // 5. Cache de Setores do Cubo Galáctico
            st.execute("""
                CREATE TABLE IF NOT EXISTS copilot_cube_cache (
                    cube_key TEXT PRIMARY KEY,
                    data_json TEXT,
                    expires_at INTEGER
                );
            """);

            // 6. Candidatos a Stratum Tectonicas
            st.execute("""
                CREATE TABLE IF NOT EXISTS copilot_stratum_candidates (
                    system_name TEXT PRIMARY KEY,
                    candidates_json TEXT,
                    updated_at INTEGER
                );
            """);
        } catch (SQLException e) {
            log.error("Erro ao inicializar tabelas do Copilot no SQLite: {}", e.getMessage(), e);
        }
    }

    // =========================================================================
    // MIGRAÇÃO DE ARQUIVOS JSON LEGADOS PARA SQLITE
    // =========================================================================

    private void migrateLegacyJsonFiles() {
        // 1. Migra discovered_systems.json
        migrateDiscoveredSystems();

        // 2. Migra player_planet_history.json
        migratePlanetHistory();

        // 3. Migra surface_features_history.json
        migrateSurfaceFeatures();

        // 4. Migra cache/systems/*.json
        migrateSystemBodies();

        // 5. Migra cache/cubes/*.json
        migrateCubeCache();

        // 6. Migra cache/stratum_candidates_cache.json
        migrateStratumCandidates();
    }

    private void migrateDiscoveredSystems() {
        File file = new File("cache/discovered_systems.json");
        if (!file.exists()) return;

        try (Connection conn = getConnection()) {
            // Verifica se a tabela já possui dados
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM copilot_discovered_systems")) {
                if (rs.next() && rs.getInt(1) > 0) return; // Já migrado
            }

            JsonNode root = objectMapper.readTree(file);
            Set<String> systems = new HashSet<>();
            if (root.isObject()) {
                root.fieldNames().forEachRemaining(systems::add);
            } else if (root.isArray()) {
                for (JsonNode n : root) {
                    if (n.isTextual()) systems.add(n.asText());
                }
            }
            if (systems.isEmpty()) return;

            String sql = "INSERT OR IGNORE INTO copilot_discovered_systems(system_name, first_seen) VALUES (?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                conn.setAutoCommit(false);
                long now = System.currentTimeMillis();
                for (String sys : systems) {
                    ps.setString(1, sys);
                    ps.setLong(2, now);
                    ps.addBatch();
                }
                ps.executeBatch();
                conn.commit();
                conn.setAutoCommit(true);
            }
            log.info("📦 [MIGRAÇÃO] {} sistemas de 'discovered_systems.json' migrados para o SQLite.", systems.size());
        } catch (Exception e) {
            log.warn("Erro ao migrar discovered_systems.json para SQLite: {}", e.getMessage());
        }
    }

    private void migratePlanetHistory() {
        File file = new File("cache/player_planet_history.json");
        if (!file.exists()) return;

        try (Connection conn = getConnection()) {
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM copilot_planet_history")) {
                if (rs.next() && rs.getInt(1) > 0) return; // Já migrado
            }

            Map<String, VisitedPlanetRecordDTO> history = objectMapper.readValue(
                    file, new TypeReference<Map<String, VisitedPlanetRecordDTO>>() {}
            );
            if (history == null || history.isEmpty()) return;

            String sql = "INSERT OR REPLACE INTO copilot_planet_history(planet_name, system_name, landing_count, data_json, updated_at) VALUES (?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                conn.setAutoCommit(false);
                long now = System.currentTimeMillis();
                for (Map.Entry<String, VisitedPlanetRecordDTO> entry : history.entrySet()) {
                    VisitedPlanetRecordDTO dto = entry.getValue();
                    ps.setString(1, entry.getKey());
                    ps.setString(2, dto.getSystemName());
                    ps.setInt(3, dto.getTouchdownCount());
                    ps.setString(4, objectMapper.writeValueAsString(dto));
                    ps.setLong(5, now);
                    ps.addBatch();
                }
                ps.executeBatch();
                conn.commit();
                conn.setAutoCommit(true);
            }
            log.info("📦 [MIGRAÇÃO] {} registros de 'player_planet_history.json' migrados para o SQLite.", history.size());
        } catch (Exception e) {
            log.warn("Erro ao migrar player_planet_history.json para SQLite: {}", e.getMessage());
        }
    }

    private void migrateSurfaceFeatures() {
        File file = new File("cache/surface_features_history.json");
        if (!file.exists()) return;

        try (Connection conn = getConnection()) {
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM copilot_surface_features")) {
                if (rs.next() && rs.getInt(1) > 0) return; // Já migrado
            }

            Map<String, List<SurfaceFeatureDTO>> features = objectMapper.readValue(
                    file, new TypeReference<Map<String, List<SurfaceFeatureDTO>>>() {}
            );
            if (features == null || features.isEmpty()) return;

            String sql = """
                INSERT OR REPLACE INTO copilot_surface_features
                (body_name, feature_name, feature_type, latitude, longitude, is_gps_confirmed, system_name, data_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                conn.setAutoCommit(false);
                long now = System.currentTimeMillis();
                int count = 0;
                for (Map.Entry<String, List<SurfaceFeatureDTO>> entry : features.entrySet()) {
                    String body = entry.getKey();
                    for (SurfaceFeatureDTO feat : entry.getValue()) {
                        ps.setString(1, body);
                        ps.setString(2, feat.getName());
                        ps.setString(3, feat.getType() != null ? feat.getType() : "");
                        ps.setObject(4, feat.getLatitude());
                        ps.setObject(5, feat.getLongitude());
                        ps.setInt(6, feat.isGpsConfirmed() ? 1 : 0);
                        ps.setString(7, feat.getBodyName());
                        ps.setString(8, objectMapper.writeValueAsString(feat));
                        ps.setLong(9, now);
                        ps.addBatch();
                        count++;
                    }
                }
                ps.executeBatch();
                conn.commit();
                conn.setAutoCommit(true);
                log.info("📦 [MIGRAÇÃO] {} POIs de 'surface_features_history.json' migrados para o SQLite.", count);
            }
        } catch (Exception e) {
            log.warn("Erro ao migrar surface_features_history.json para SQLite: {}", e.getMessage());
        }
    }

    private void migrateSystemBodies() {
        File dir = new File("cache/systems");
        if (!dir.exists() || !dir.isDirectory()) return;

        File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
        if (files == null || files.length == 0) return;

        try (Connection conn = getConnection()) {
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM copilot_system_bodies")) {
                if (rs.next() && rs.getInt(1) > 0) return;
            }

            String sql = "INSERT OR REPLACE INTO copilot_system_bodies(system_name, data_json, updated_at) VALUES (?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                conn.setAutoCommit(false);
                long now = System.currentTimeMillis();
                for (File f : files) {
                    String sysKey = f.getName().replace(".json", "").replace("_", " ");
                    String content = Files.readString(f.toPath());
                    ps.setString(1, sysKey);
                    ps.setString(2, content);
                    ps.setLong(3, now);
                    ps.addBatch();
                }
                ps.executeBatch();
                conn.commit();
                conn.setAutoCommit(true);
                log.info("📦 [MIGRAÇÃO] {} sistemas de 'cache/systems/' migrados para o SQLite.", files.length);
            }
        } catch (Exception e) {
            log.warn("Erro ao migrar cache/systems para SQLite: {}", e.getMessage());
        }
    }

    private void migrateCubeCache() {
        File dir = new File("cache/cubes");
        if (!dir.exists() || !dir.isDirectory()) return;

        File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
        if (files == null || files.length == 0) return;

        try (Connection conn = getConnection()) {
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM copilot_cube_cache")) {
                if (rs.next() && rs.getInt(1) > 0) return;
            }

            String sql = "INSERT OR REPLACE INTO copilot_cube_cache(cube_key, data_json, expires_at) VALUES (?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                conn.setAutoCommit(false);
                long expiry = System.currentTimeMillis() + (7L * 24 * 3600 * 1000L);
                for (File f : files) {
                    String cubeKey = f.getName().replace(".json", "");
                    String content = Files.readString(f.toPath());
                    ps.setString(1, cubeKey);
                    ps.setString(2, content);
                    ps.setLong(3, expiry);
                    ps.addBatch();
                }
                ps.executeBatch();
                conn.commit();
                conn.setAutoCommit(true);
                log.info("📦 [MIGRAÇÃO] {} cubos de 'cache/cubes/' migrados para o SQLite.", files.length);
            }
        } catch (Exception e) {
            log.warn("Erro ao migrar cache/cubes para SQLite: {}", e.getMessage());
        }
    }

    private void migrateStratumCandidates() {
        File file = new File("cache/stratum_candidates_cache.json");
        if (!file.exists()) return;

        try (Connection conn = getConnection()) {
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM copilot_stratum_candidates")) {
                if (rs.next() && rs.getInt(1) > 0) return;
            }

            Map<String, Object> loaded = objectMapper.readValue(file, new TypeReference<Map<String, Object>>() {});
            if (loaded == null || loaded.isEmpty()) return;

            String sql = "INSERT OR REPLACE INTO copilot_stratum_candidates(system_name, candidates_json, updated_at) VALUES (?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                conn.setAutoCommit(false);
                long now = System.currentTimeMillis();
                for (Map.Entry<String, Object> entry : loaded.entrySet()) {
                    ps.setString(1, entry.getKey().toLowerCase().trim());
                    ps.setString(2, objectMapper.writeValueAsString(entry.getValue()));
                    ps.setLong(3, now);
                    ps.addBatch();
                }
                ps.executeBatch();
                conn.commit();
                conn.setAutoCommit(true);
                log.info("📦 [MIGRAÇÃO] {} sistemas com candidatos a Stratum migrados para o SQLite.", loaded.size());
            }
        } catch (Exception e) {
            log.warn("Erro ao migrar stratum_candidates para SQLite: {}", e.getMessage());
        }
    }

    // =========================================================================
    // MÉTODOS DE ACESSO: SISTEMAS DESCOBERTOS
    // =========================================================================

    public Set<String> loadAllDiscoveredSystems() {
        Set<String> set = ConcurrentHashMap.newKeySet();
        String sql = "SELECT system_name FROM copilot_discovered_systems";
        try (Connection conn = getConnection(); Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                set.add(rs.getString("system_name"));
            }
        } catch (SQLException e) {
            log.warn("Erro ao carregar sistemas descobertos do SQLite: {}", e.getMessage());
        }
        return set;
    }

    public void saveDiscoveredSystem(String systemName) {
        if (systemName == null || systemName.isBlank()) return;
        String sql = "INSERT OR IGNORE INTO copilot_discovered_systems(system_name, first_seen) VALUES (?, ?)";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, systemName);
            ps.setLong(2, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) {
            log.debug("Erro ao gravar sistema descoberto no SQLite: {}", e.getMessage());
        }
    }

    // =========================================================================
    // MÉTODOS DE ACESSO: HISTÓRICO PLANETÁRIO
    // =========================================================================

    public Map<String, VisitedPlanetRecordDTO> loadAllPlanetHistory() {
        Map<String, VisitedPlanetRecordDTO> map = new ConcurrentHashMap<>();
        String sql = "SELECT planet_name, data_json FROM copilot_planet_history";
        try (Connection conn = getConnection(); Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String planet = rs.getString("planet_name");
                String json = rs.getString("data_json");
                try {
                    VisitedPlanetRecordDTO dto = objectMapper.readValue(json, VisitedPlanetRecordDTO.class);
                    if (dto != null) {
                        map.put(planet, dto);
                    }
                } catch (Exception ignored) {}
            }
        } catch (SQLException e) {
            log.warn("Erro ao carregar histórico de planetas do SQLite: {}", e.getMessage());
        }
        return map;
    }

    public void savePlanetHistoryRecord(String planetName, VisitedPlanetRecordDTO dto) {
        if (planetName == null || dto == null) return;
        String sql = """
            INSERT OR REPLACE INTO copilot_planet_history
            (planet_name, system_name, landing_count, data_json, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, planetName);
            ps.setString(2, dto.getSystemName());
            ps.setInt(3, dto.getTouchdownCount());
            ps.setString(4, objectMapper.writeValueAsString(dto));
            ps.setLong(5, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Erro ao salvar histórico do planeta '{}' no SQLite: {}", planetName, e.getMessage());
        }
    }

    public void saveAllPlanetHistory(Map<String, VisitedPlanetRecordDTO> map) {
        if (map == null || map.isEmpty()) return;
        String sql = """
            INSERT OR REPLACE INTO copilot_planet_history
            (planet_name, system_name, landing_count, data_json, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            conn.setAutoCommit(false);
            long now = System.currentTimeMillis();
            for (Map.Entry<String, VisitedPlanetRecordDTO> entry : map.entrySet()) {
                VisitedPlanetRecordDTO dto = entry.getValue();
                ps.setString(1, entry.getKey());
                ps.setString(2, dto.getSystemName());
                ps.setInt(3, dto.getTouchdownCount());
                ps.setString(4, objectMapper.writeValueAsString(dto));
                ps.setLong(5, now);
                ps.addBatch();
            }
            ps.executeBatch();
            conn.commit();
            conn.setAutoCommit(true);
        } catch (Exception e) {
            log.warn("Erro ao salvar lote de histórico de planetas no SQLite: {}", e.getMessage());
        }
    }

    // =========================================================================
    // MÉTODOS DE ACESSO: ESTRUTURAS DE SOLO E POIS
    // =========================================================================

    public Map<String, List<SurfaceFeatureDTO>> loadAllSurfaceFeatures() {
        Map<String, List<SurfaceFeatureDTO>> map = new ConcurrentHashMap<>();
        String sql = "SELECT body_name, data_json FROM copilot_surface_features";
        try (Connection conn = getConnection(); Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String body = rs.getString("body_name");
                String json = rs.getString("data_json");
                try {
                    SurfaceFeatureDTO feat = objectMapper.readValue(json, SurfaceFeatureDTO.class);
                    if (feat != null) {
                        map.computeIfAbsent(body, k -> new ArrayList<>()).add(feat);
                    }
                } catch (Exception ignored) {}
            }
        } catch (SQLException e) {
            log.warn("Erro ao carregar POIs de solo do SQLite: {}", e.getMessage());
        }
        return map;
    }

    public void saveSurfaceFeature(String bodyName, SurfaceFeatureDTO feat) {
        if (bodyName == null || feat == null || feat.getName() == null) return;
        String sql = """
            INSERT OR REPLACE INTO copilot_surface_features
            (body_name, feature_name, feature_type, latitude, longitude, is_gps_confirmed, system_name, data_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, bodyName);
            ps.setString(2, feat.getName());
            ps.setString(3, feat.getType() != null ? feat.getType() : "");
            ps.setObject(4, feat.getLatitude());
            ps.setObject(5, feat.getLongitude());
            ps.setInt(6, feat.isGpsConfirmed() ? 1 : 0);
            ps.setString(7, feat.getBodyName());
            ps.setString(8, objectMapper.writeValueAsString(feat));
            ps.setLong(9, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Erro ao salvar POI no SQLite: {}", e.getMessage());
        }
    }

    public void saveAllSurfaceFeatures(Map<String, List<SurfaceFeatureDTO>> map) {
        if (map == null || map.isEmpty()) return;
        String sql = """
            INSERT OR REPLACE INTO copilot_surface_features
            (body_name, feature_name, feature_type, latitude, longitude, is_gps_confirmed, system_name, data_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            conn.setAutoCommit(false);
            long now = System.currentTimeMillis();
            for (Map.Entry<String, List<SurfaceFeatureDTO>> entry : map.entrySet()) {
                String body = entry.getKey();
                for (SurfaceFeatureDTO feat : entry.getValue()) {
                    ps.setString(1, body);
                    ps.setString(2, feat.getName());
                    ps.setString(3, feat.getType() != null ? feat.getType() : "");
                    ps.setObject(4, feat.getLatitude());
                    ps.setObject(5, feat.getLongitude());
                    ps.setInt(6, feat.isGpsConfirmed() ? 1 : 0);
                    ps.setString(7, feat.getBodyName());
                    ps.setString(8, objectMapper.writeValueAsString(feat));
                    ps.setLong(9, now);
                    ps.addBatch();
                }
            }
            ps.executeBatch();
            conn.commit();
            conn.setAutoCommit(true);
        } catch (Exception e) {
            log.warn("Erro ao salvar lote de POIs no SQLite: {}", e.getMessage());
        }
    }

    // =========================================================================
    // MÉTODOS DE ACESSO: CORPOS CELESTES DO SISTEMA (ORRERY)
    // =========================================================================

    public String getSystemBodiesJson(String systemName) {
        if (systemName == null) return null;
        String sql = "SELECT data_json FROM copilot_system_bodies WHERE system_name = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, systemName.toLowerCase().trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getString("data_json");
            }
        } catch (SQLException e) {
            log.debug("Erro ao ler corpos do sistema do SQLite: {}", e.getMessage());
        }
        return null;
    }

    public void saveSystemBodiesJson(String systemName, String jsonPayload) {
        if (systemName == null || jsonPayload == null) return;
        String sql = "INSERT OR REPLACE INTO copilot_system_bodies(system_name, data_json, updated_at) VALUES (?, ?, ?)";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, systemName.toLowerCase().trim());
            ps.setString(2, jsonPayload);
            ps.setLong(3, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) {
            log.debug("Erro ao gravar corpos do sistema no SQLite: {}", e.getMessage());
        }
    }

    // =========================================================================
    // MÉTODOS DE ACESSO: CACHE DO CUBO GALÁCTICO
    // =========================================================================

    public String getCubeCacheJson(String cubeKey) {
        if (cubeKey == null) return null;
        String sql = "SELECT data_json, expires_at FROM copilot_cube_cache WHERE cube_key = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cubeKey);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long expiresAt = rs.getLong("expires_at");
                    if (expiresAt > System.currentTimeMillis()) {
                        return rs.getString("data_json");
                    }
                }
            }
        } catch (SQLException e) {
            log.debug("Erro ao ler cache de cubo do SQLite: {}", e.getMessage());
        }
        return null;
    }

    public void saveCubeCacheJson(String cubeKey, String jsonPayload, long ttlMillis) {
        if (cubeKey == null || jsonPayload == null) return;
        String sql = "INSERT OR REPLACE INTO copilot_cube_cache(cube_key, data_json, expires_at) VALUES (?, ?, ?)";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cubeKey);
            ps.setString(2, jsonPayload);
            ps.setLong(3, System.currentTimeMillis() + ttlMillis);
            ps.executeUpdate();
        } catch (SQLException e) {
            log.debug("Erro ao gravar cache de cubo no SQLite: {}", e.getMessage());
        }
    }

    public Map<String, String> loadAllCubeCaches() {
        Map<String, String> map = new HashMap<>();
        String sql = "SELECT cube_key, data_json FROM copilot_cube_cache WHERE expires_at > ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, System.currentTimeMillis());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getString("cube_key"), rs.getString("data_json"));
                }
            }
        } catch (SQLException e) {
            log.debug("Erro ao carregar cubos do SQLite: {}", e.getMessage());
        }
        return map;
    }

    // =========================================================================
    // MÉTODOS DE ACESSO: CANDIDATOS A STRATUM TECTONICAS
    // =========================================================================

    public Map<String, String> loadAllStratumCandidates() {
        Map<String, String> map = new HashMap<>();
        String sql = "SELECT system_name, candidates_json FROM copilot_stratum_candidates";
        try (Connection conn = getConnection(); Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                map.put(rs.getString("system_name"), rs.getString("candidates_json"));
            }
        } catch (SQLException e) {
            log.warn("Erro ao carregar candidatos a stratum do SQLite: {}", e.getMessage());
        }
        return map;
    }

    public void saveStratumCandidatesJson(String systemName, String json) {
        if (systemName == null || json == null) return;
        String sql = "INSERT OR REPLACE INTO copilot_stratum_candidates(system_name, candidates_json, updated_at) VALUES (?, ?, ?)";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, systemName.toLowerCase().trim());
            ps.setString(2, json);
            ps.setLong(3, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) {
            log.debug("Erro ao gravar candidatos a stratum no SQLite: {}", e.getMessage());
        }
    }
}
