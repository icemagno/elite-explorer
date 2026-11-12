package com.eliteexplorer.service;

import com.eliteexplorer.dto.GalaxyCubeResponse;
import com.eliteexplorer.dto.RoutePointDTO;
import com.eliteexplorer.dto.StarSystemDTO;
import com.eliteexplorer.dto.StationDTO;
import com.eliteexplorer.dto.StratumCandidateDTO;
import com.eliteexplorer.dto.VoidSectorDTO;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.PriorityBlockingQueue;
import java.util.concurrent.TimeUnit;

@Service
public class GalaxyExplorationService {

    private static final Logger log = LoggerFactory.getLogger(GalaxyExplorationService.class);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final PlanetExplorationHistoryService planetHistoryService;

    public GalaxyExplorationService(PlanetExplorationHistoryService planetHistoryService) {
        this.planetHistoryService = planetHistoryService;
    }

    // Cache em memória e disco para evitar qualquer flood ao EDSM:
    // Chave: coordenadas arredondadas + tamanho do cubo
    // Valor: Lista em cache com timestamp de expiração (TTL de 7 dias; coordenadas estelares são estáticas)
    private static final long CACHE_TTL_MS = 7L * 24 * 60 * 60 * 1000L; // 7 dias
    private final Map<String, CacheEntry> systemsCache = new ConcurrentHashMap<>();
    private final Object cubeFetchLock = new Object();
    private File cubeCacheDir = new File("cache/cubes");
    private final Map<String, List<StratumCandidateDTO>> systemBodiesCache = new ConcurrentHashMap<>();
    private final Map<String, List<SpanshConfirmedSystem>> spanshCache = new ConcurrentHashMap<>();
    private final Map<String, List<StationDTO>> stationsCache = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Long>> inhabitedCache = new ConcurrentHashMap<>();
    private final Map<Long, SpanshBioCheck> spanshBodyBioCache = new ConcurrentHashMap<>();
    private final Map<String, StarSystemDTO> locallyDiscoveredSystems = new ConcurrentHashMap<>();
    private final File discoveredSystemsFile = new File("cache/discovered_systems.json");

    @Autowired
    @Lazy
    private SystemBodiesService systemBodiesService;

    public void registerDiscoveredSystem(String systemName, double x, double y, double z, String starType) {
        if (systemName == null || systemName.isBlank() || systemName.equalsIgnoreCase("Posição Atual") || systemName.equalsIgnoreCase("Desconhecido")) return;
        StarSystemDTO dto = new StarSystemDTO(systemName, x, y, z, starType != null ? starType : "K (Orange) Star", 0.0);
        locallyDiscoveredSystems.put(systemName.toLowerCase().trim(), dto);
        saveDiscoveredSystemsToDisk();

        // Atualiza as listas em cache na memória sem limpar o cache e sem fazer requisições externas ao EDSM
        for (CacheEntry entry : systemsCache.values()) {
            boolean exists = entry.systems.stream().anyMatch(s -> s.getName().equalsIgnoreCase(systemName));
            if (!exists) {
                entry.systems.add(dto);
            }
        }
        log.info("🌟 [DISCOVERY MEMORY] Sistema registrado em memória local (cache EDSM preservado, zero requisições): {} [{}, {}, {}]", systemName, x, y, z);
    }

    private void loadDiscoveredSystemsFromDisk() {
        if (!discoveredSystemsFile.exists() || discoveredSystemsFile.length() == 0) return;
        try {
            Map<String, StarSystemDTO> loaded = objectMapper.readValue(
                    discoveredSystemsFile,
                    new TypeReference<Map<String, StarSystemDTO>>() {}
            );
            if (loaded != null) {
                locallyDiscoveredSystems.putAll(loaded);
                log.info("🌟 [DISCOVERY DISK] Carregados {} sistemas descobertos localmente pelo jogador.", loaded.size());
            }
        } catch (Exception e) {
            log.warn("Erro ao carregar discovered_systems.json: {}", e.getMessage());
        }
    }

    private synchronized void saveDiscoveredSystemsToDisk() {
        try {
            File parent = discoveredSystemsFile.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();
            objectMapper.writeValue(discoveredSystemsFile, locallyDiscoveredSystems);
        } catch (Exception e) {
            log.warn("Erro ao salvar discovered_systems.json: {}", e.getMessage());
        }
    }

    public boolean isSystemKnown(String name) {
        if (name == null || name.isBlank()) return false;
        String key = name.toLowerCase().trim();
        if (locallyDiscoveredSystems.containsKey(key)) return true;
        if (systemBodiesService != null && systemBodiesService.hasSystemData(name)) return true;
        return false;
    }

    // Persistência em disco e fila em background paralela e priorizada
    private final File cacheFile = new File("cache/stratum_candidates_cache.json");
    private final BlockingQueue<PrioritizedSystem> inspectionQueue = new PriorityBlockingQueue<>();
    private final Set<String> enqueuedSystems = Collections.newSetFromMap(new ConcurrentHashMap<>());

    private static class PrioritizedSystem implements Comparable<PrioritizedSystem> {
        final String name;
        final int priorityGroup; // 0 = rota ativa, 1 = vizinhança (<30 ly), 2 = alcance médio (30-60 ly), 3 = distante (>60 ly)
        final double distance;
        final long enqueuedAt;

        PrioritizedSystem(String name, int priorityGroup, double distance) {
            this.name = name;
            this.priorityGroup = priorityGroup;
            this.distance = distance;
            this.enqueuedAt = System.currentTimeMillis();
        }

        @Override
        public int compareTo(PrioritizedSystem o) {
            int cmp = Integer.compare(this.priorityGroup, o.priorityGroup);
            if (cmp != 0) return cmp;
            int distCmp = Double.compare(this.distance, o.distance);
            if (distCmp != 0) return distCmp;
            return Long.compare(this.enqueuedAt, o.enqueuedAt);
        }
    }

    @PostConstruct
    public void init() {
        loadCacheFromDisk();
        loadDiscoveredSystemsFromDisk();
        loadCubeCacheFromDisk();
        int workerCount = 1;
        for (int i = 1; i <= workerCount; i++) {
            Thread worker = new Thread(this::backgroundScanLoop, "EDSM-Worker-" + i);
            worker.setDaemon(true);
            worker.start();
        }
        log.info("Iniciada fila de escaneamento de corpos celestes ({} worker educado com intervalo de 1.2s).", workerCount);
    }

    private final Object rateLimiter = new Object();
    private long lastRequestTime = 0;

    private void throttleRequest() throws InterruptedException {
        synchronized (rateLimiter) {
            long now = System.currentTimeMillis();
            long waitTime = 1200 - (now - lastRequestTime);
            if (waitTime > 0) {
                Thread.sleep(waitTime);
            }
            lastRequestTime = System.currentTimeMillis();
        }
    }

    private void loadCacheFromDisk() {
        if (!cacheFile.exists()) return;
        try {
            Map<String, List<StratumCandidateDTO>> loaded = objectMapper.readValue(
                    cacheFile,
                    new TypeReference<Map<String, List<StratumCandidateDTO>>>() {}
            );
            if (loaded != null) {
                systemBodiesCache.putAll(loaded);
                log.info("Carregado cache permanente de corpos celestes: {} sistemas conhecidos.", loaded.size());
                sanitizeLoadedCache();
            }
        } catch (Exception e) {
            log.warn("Não foi possível carregar cache de corpos de {}: {}", cacheFile.getAbsolutePath(), e.getMessage());
        }
    }

    private synchronized void saveCacheToDisk() {
        try {
            if (cacheFile.getParentFile() != null) {
                cacheFile.getParentFile().mkdirs();
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(cacheFile, systemBodiesCache);
        } catch (Exception e) {
            log.warn("Erro ao salvar cache de corpos em disco: {}", e.getMessage());
        }
    }

    void setCubeCacheDirForTest(File dir) {
        this.cubeCacheDir = dir;
    }

    void loadCubeCacheFromDisk() {
        if (cubeCacheDir == null || !cubeCacheDir.exists() || !cubeCacheDir.isDirectory()) {
            return;
        }
        File[] files = cubeCacheDir.listFiles((dir, name) -> name.endsWith(".json"));
        if (files == null || files.length == 0) {
            return;
        }
        int loadedCubes = 0;
        int loadedStars = 0;
        for (File file : files) {
            if (file.length() == 0) continue;
            try {
                CacheEntry entry = objectMapper.readValue(file, CacheEntry.class);
                if (entry != null && entry.getSystems() != null && !entry.getSystems().isEmpty()) {
                    String key = file.getName().substring(0, file.getName().length() - ".json".length());
                    systemsCache.put(key, entry);
                    loadedCubes++;
                    loadedStars += entry.getSystems().size();
                }
            } catch (Exception e) {
                log.warn("Não foi possível carregar cache de cubo em {}: {}", file.getName(), e.getMessage());
            }
        }
        if (loadedCubes > 0) {
            log.info("🧊 [CUBE DISK CACHE] Carregados {} cubos galácticos do disco ({} sistemas estelares prontos sem consultar EDSM).",
                    loadedCubes, loadedStars);
        }
    }

    synchronized void saveCubeCacheEntryToDisk(String cacheKey, CacheEntry entry) {
        if (cubeCacheDir == null || cacheKey == null || cacheKey.isBlank() || entry == null
                || entry.getSystems() == null || entry.getSystems().isEmpty()) {
            return;
        }
        try {
            if (!cubeCacheDir.exists()) {
                cubeCacheDir.mkdirs();
            }
            String safeKey = cacheKey.replaceAll("[^a-zA-Z0-9._-]", "_");
            File target = new File(cubeCacheDir, safeKey + ".json");
            File temp = new File(cubeCacheDir, safeKey + ".json.tmp");
            objectMapper.writeValue(temp, entry);
            Files.move(temp.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception e) {
            log.warn("Erro ao salvar cache do cubo galáctico '{}' em disco: {}", cacheKey, e.getMessage());
        }
    }

    private void sanitizeLoadedCache() {
        int before = systemBodiesCache.size();
        // Remove quaisquer sistemas que possuam candidatos potenciais antigos para que sejam re-validados
        // rigorosamente com os novos critérios anti-falso-positivo (>= 2 sinais bio ou nunca mapeado).
        systemBodiesCache.entrySet().removeIf(e -> {
            if (e.getValue() == null || e.getValue().isEmpty()) return false;
            return e.getValue().stream().anyMatch(c -> !c.isConfirmed());
        });
        int cleared = before - systemBodiesCache.size();
        if (cleared > 0) {
            log.info("Higienizado cache de candidatos a Stratum: {} sistemas limpos para re-avaliação cruzada com os novos filtros de 2+ sinais / nunca mapeado.", cleared);
            saveCacheToDisk();
        }
    }

    private void backgroundScanLoop() {
        long lastSaveTime = System.currentTimeMillis();
        int newItemsSinceSave = 0;

        while (!Thread.currentThread().isInterrupted()) {
            try {
                PrioritizedSystem item = inspectionQueue.poll(2, TimeUnit.SECONDS);
                if (item == null) {
                    if (newItemsSinceSave > 0) {
                        saveCacheToDisk();
                        newItemsSinceSave = 0;
                        lastSaveTime = System.currentTimeMillis();
                    }
                    continue;
                }

                String key = item.name.toLowerCase().trim();
                if (systemBodiesCache.containsKey(key)) {
                    continue;
                }

                // Espaçamento preciso e respeitoso de 250ms coordenado entre os workers (4 req/s sem colisões)
                throttleRequest();

                List<StratumCandidateDTO> candidates = fetchBodiesFromEdsm(item.name);
                if (candidates != null) {
                    // Armazena no cache (mesmo se vazia, para nunca mais re-consultar o mesmo sistema)
                    systemBodiesCache.put(key, candidates);
                    newItemsSinceSave++;
                    if (newItemsSinceSave >= 5 || (System.currentTimeMillis() - lastSaveTime > 10000)) {
                        saveCacheToDisk();
                        newItemsSinceSave = 0;
                        lastSaveTime = System.currentTimeMillis();
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warn("Erro no worker de escaneamento em background: {}", e.getMessage());
            }
        }
    }

    private List<StratumCandidateDTO> fetchBodiesFromEdsm(String systemName) {
        if (systemName == null || systemName.isBlank()) return Collections.emptyList();

        try {
            String url = "https://www.edsm.net/api-system-v1/bodies?systemName=" + java.net.URLEncoder.encode(systemName, java.nio.charset.StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("User-Agent", "EliteDangerous-ExplorerHUD/1.0")
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 429) {
                log.warn("EDSM retornou HTTP 429 (Rate Limit) para {}. Entrando em cooldown de 15s e recolocando na fila...", systemName);
                Thread.sleep(15000);
                inspectionQueue.offer(new PrioritizedSystem(systemName, 1, 0.0)); // re-enfileira para tentar novamente
                return null; // null sinaliza que não deve registrar no cache ainda
            }
            if (resp.statusCode() == 200) {
                List<StratumCandidateDTO> candidates = new ArrayList<>();
                JsonNode root = objectMapper.readTree(resp.body());
                JsonNode bodies = root.path("bodies");
                if (bodies.isArray()) {
                    for (JsonNode b : bodies) {
                        String type = b.path("type").asText("");
                        if (!"Planet".equalsIgnoreCase(type)) continue;

                        String subType = b.path("subType").asText("");
                        boolean isHMC = "High metal content world".equalsIgnoreCase(subType) || "High metal content body".equalsIgnoreCase(subType);
                        if (!isHMC) continue;

                        boolean isLandable = b.path("isLandable").asBoolean(false);
                        double gravity = b.path("gravity").asDouble(99.0);
                        String atm = b.path("atmosphereType").asText("");
                        double surfaceTemp = b.path("surfaceTemperature").asDouble(0.0);

                        // Critérios biológicos rigorosos para Stratum Tectonicas (Odyssey):
                        // 1. High Metal Content World & Pousável (Landable)
                        // 2. Gravidade < 0.70G (ideal entre 0.15G e 0.65G)
                        // 3. Atmosfera fina compatível: Thin Sulphur dioxide, Thin Carbon dioxide (ou raramente Thin Ammonia)
                        // 4. Temperatura média de superfície: MÍNIMO 165 K (faixa ideal: 165 K a 280 K / -108°C a +7°C).
                        //    Corpos abaixo de 165 K (ex: 158 K em Wregoe LT-Q c18-13 1) congelam Stratum Tectonicas
                        //    e geram exclusivamente Bacterium (principal causa de falsos positivos).
                        if (isLandable && gravity < 0.70 && isThinAtmosphere(atm)) {
                            // Descarta imediatamente se temperatura conhecida estiver fora do limiar de Stratum:
                            if (surfaceTemp > 0.0 && (surfaceTemp < 165.0 || surfaceTemp > 285.0)) {
                                log.debug("Descartado planeta {} em {}: temperatura {}K fora da faixa de Stratum Tectonicas (165K-285K) -> Falso positivo de Bacterium prevenido.",
                                        b.path("name").asText(), systemName, surfaceTemp);
                                continue;
                            }

                            String planetName = b.path("name").asText();
                            int distLs = b.path("distanceToArrival").asInt(0);
                            long bodyId64 = b.path("id64").asLong(0);

                            JsonNode disc = b.path("discovery");
                            boolean isFirst = (disc.isMissingNode() || disc.isNull() || !disc.has("commander") || disc.path("commander").asText("").isBlank());

                            // Validação cruzada com Spansh:
                            // Se alguém já fez DSS/pousou na Odyssey e os gêneros/landmarks NÃO possuem Stratum, descarta!
                            SpanshBioCheck bioCheck = checkSpanshBodyExobiology(bodyId64);
                            if (bioCheck.isDiscard()) {
                                log.info("Descartado planeta {} em {}: verificado no Spansh sem presença de Stratum (motivo: {})",
                                        planetName, systemName, bioCheck.getReason());
                                continue;
                            }

                            boolean isConfirmed = bioCheck.isConfirmed();
                            long val = isConfirmed ? 19010800L : 0L;
                            String species = isConfirmed ? bioCheck.getSpecies() : "Stratum Tectonicas";

                            StratumCandidateDTO cand = new StratumCandidateDTO(planetName, atm, gravity, distLs, isFirst, isConfirmed, val, species, bodyId64);
                            cand.setBioSignalsCount(bioCheck.getBioSignalCount());
                            cand.setSurfaceTemperature(surfaceTemp);
                            cand.setWasMapped(bioCheck.isWasMapped());
                            candidates.add(cand);
                        }
                    }
                }
                if (!candidates.isEmpty()) {
                    log.info("Identificado potencial de Stratum Tectonicas no sistema {} ({} corpos)", systemName, candidates.size());
                }
                return candidates;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.debug("Erro na consulta de corpos de {}: {}", systemName, e.getMessage());
        }
        return Collections.emptyList();
    }

    private enum SpanshBioResultType {
        CONFIRMED,
        DISCARD,
        POTENTIAL
    }

    private static class SpanshBioCheck {
        private final SpanshBioResultType type;
        private final String species;
        private final String reason;
        private final Integer bioSignalCount;
        private final boolean wasMapped;

        public static SpanshBioCheck confirmed(String species, Integer bioSignalCount, boolean wasMapped) {
            return new SpanshBioCheck(SpanshBioResultType.CONFIRMED, species != null ? species : "Stratum Tectonicas", "Confirmado no Spansh", bioSignalCount, wasMapped);
        }

        public static SpanshBioCheck discard(String reason) {
            return new SpanshBioCheck(SpanshBioResultType.DISCARD, null, reason, null, true);
        }

        public static SpanshBioCheck potential(Integer bioSignalCount, boolean wasMapped) {
            return new SpanshBioCheck(SpanshBioResultType.POTENTIAL, null, "Potencial validado", bioSignalCount, wasMapped);
        }

        private SpanshBioCheck(SpanshBioResultType type, String species, String reason, Integer bioSignalCount, boolean wasMapped) {
            this.type = type;
            this.species = species;
            this.reason = reason;
            this.bioSignalCount = bioSignalCount;
            this.wasMapped = wasMapped;
        }

        public boolean isConfirmed() { return type == SpanshBioResultType.CONFIRMED; }
        public boolean isDiscard() { return type == SpanshBioResultType.DISCARD; }
        public String getSpecies() { return species; }
        public String getReason() { return reason; }
        public Integer getBioSignalCount() { return bioSignalCount; }
        public boolean isWasMapped() { return wasMapped; }
    }

    /**
     * Consulta cruzada com a API do Spansh para o corpo celeste específico via seu id64.
     * Regra estrita:
     * 1. Se tem Stratum confirmado no Spansh -> Aceita como Confirmado (verde).
     * 2. Se já foi mapeado com DSS ou já houve pouso -> Descarta imediatamente (alguém já verificou).
     * 3. Se NUNCA ninguém mapeou nem pousou -> Aceita como Potencial Inédito (1st Discovery).
     */
    private SpanshBioCheck checkSpanshBodyExobiology(long bodyId64) {
        if (bodyId64 <= 0) return SpanshBioCheck.potential(null, false);

        SpanshBioCheck cached = spanshBodyBioCache.get(bodyId64);
        if (cached != null) return cached;

        try {
            throttleRequest();

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://spansh.co.uk/api/body/" + bodyId64))
                    .timeout(Duration.ofSeconds(6))
                    .header("User-Agent", "EliteDangerous-ExplorerHUD/1.0")
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(resp.body());
                JsonNode record = root.path("record");

                // 1. Identifica se o corpo já foi mapeado com DSS ou teve sinais de superfície registrados
                boolean wasMapped = false;
                JsonNode signalsUpdated = record.path("signals_updated_at");
                if (!signalsUpdated.isMissingNode() && !signalsUpdated.isNull() && !signalsUpdated.asText("").isBlank()) {
                    wasMapped = true;
                }

                boolean hasSignalsField = false;
                JsonNode signals = record.path("signals");
                if (!signals.isMissingNode() && !signals.isNull()) {
                    hasSignalsField = true;
                    wasMapped = true;
                }

                // 2. Checa genuses (gêneros biológicos detectados pelo DSS na Odyssey)
                JsonNode genuses = record.path("genuses");
                boolean hasGenuses = false;
                boolean hasStratumGenus = false;
                if (genuses.isArray() && genuses.size() > 0) {
                    hasGenuses = true;
                    wasMapped = true;
                    for (JsonNode g : genuses) {
                        String gName = g.path("name").asText("");
                        if (gName.toLowerCase().contains("stratum")) {
                            hasStratumGenus = true;
                            break;
                        }
                    }
                } else if (genuses.isObject() && genuses.has("name")) {
                    hasGenuses = true;
                    wasMapped = true;
                    if (genuses.path("name").asText("").toLowerCase().contains("stratum")) {
                        hasStratumGenus = true;
                    }
                }

                // 3. Checa landmarks (espécies biológicas amostradas/confirmadas na superfície)
                JsonNode landmarks = record.path("landmarks");
                boolean hasLandmarks = false;
                boolean hasStratumLandmark = false;
                String confirmedSpeciesName = null;

                if (landmarks.isArray() && landmarks.size() > 0) {
                    hasLandmarks = true;
                    for (JsonNode lm : landmarks) {
                        String st = lm.path("subtype").asText("");
                        String t = lm.path("type").asText("");
                        if (st.toLowerCase().contains("stratum") || t.toLowerCase().contains("stratum")) {
                            hasStratumLandmark = true;
                            confirmedSpeciesName = st.isBlank() ? "Stratum Tectonicas" : st;
                            break;
                        }
                    }
                } else if (landmarks.isObject() && (landmarks.has("subtype") || landmarks.has("type"))) {
                    hasLandmarks = true;
                    String st = landmarks.path("subtype").asText("");
                    String t = landmarks.path("type").asText("");
                    if (st.toLowerCase().contains("stratum") || t.toLowerCase().contains("stratum")) {
                        hasStratumLandmark = true;
                        confirmedSpeciesName = st.isBlank() ? "Stratum Tectonicas" : st;
                    }
                }

                // CASO 1: Presença confirmada de Stratum no Spansh (Símbolo Verde Neon)
                if (hasStratumGenus || hasStratumLandmark) {
                    SpanshBioCheck res = SpanshBioCheck.confirmed(confirmedSpeciesName != null ? confirmedSpeciesName : "Stratum Tectonicas", null, wasMapped);
                    spanshBodyBioCache.put(bodyId64, res);
                    return res;
                }

                // CASO 2: Se alguém já mapeou com DSS ou pousou, e NÃO é Stratum: DESCARTA!
                // Alguém já esteve lá, escaneou e não tem Stratum (não é fonte de lucro virgem).
                if (wasMapped || hasSignalsField || hasGenuses || hasLandmarks) {
                    SpanshBioCheck res = SpanshBioCheck.discard("Planeta já mapeado ou com pouso prévio sem Stratum");
                    spanshBodyBioCache.put(bodyId64, res);
                    return res;
                }

                // CASO 3: NUNCA ninguém pousou nem mapeou!
                // Planeta propício + atmosfera propícia + 100% virgem de mapeamento/pouso (Símbolo Âmbar 1st Discovery)
                SpanshBioCheck pot = SpanshBioCheck.potential(null, false);
                spanshBodyBioCache.put(bodyId64, pot);
                return pot;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.debug("Erro ao consultar exobiologia no Spansh para bodyId64 {}: {}", bodyId64, e.getMessage());
        }

        SpanshBioCheck pot = SpanshBioCheck.potential(null, false);
        spanshBodyBioCache.put(bodyId64, pot);
        return pot;
    }

    private static class SpanshConfirmedSystem {
        String name;
        double x, y, z;
        List<StratumCandidateDTO> confirmedBodies = new ArrayList<>();
    }

    private static class CubeFetchResult {
        final List<StarSystemDTO> systems;
        final String source;
        final String warningMessage;

        CubeFetchResult(List<StarSystemDTO> systems, String source, String warningMessage) {
            this.systems = systems;
            this.source = source;
            this.warningMessage = warningMessage;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CacheEntry {
        private double cx, cy, cz, size;
        private List<StarSystemDTO> systems = new java.util.concurrent.CopyOnWriteArrayList<>();
        private long timestamp;

        public CacheEntry() {
        }

        CacheEntry(double cx, double cy, double cz, double size, List<StarSystemDTO> systems) {
            this.cx = cx;
            this.cy = cy;
            this.cz = cz;
            this.size = size;
            this.systems = new java.util.concurrent.CopyOnWriteArrayList<>(systems != null ? systems : Collections.emptyList());
            this.timestamp = System.currentTimeMillis();
        }

        public double getCx() { return cx; }
        public void setCx(double cx) { this.cx = cx; }
        public double getCy() { return cy; }
        public void setCy(double cy) { this.cy = cy; }
        public double getCz() { return cz; }
        public void setCz(double cz) { this.cz = cz; }
        public double getSize() { return size; }
        public void setSize(double size) { this.size = size; }
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public List<StarSystemDTO> getSystems() { return systems; }
        public void setSystems(List<StarSystemDTO> systems) {
            this.systems = new java.util.concurrent.CopyOnWriteArrayList<>(systems != null ? systems : Collections.emptyList());
        }

        boolean hasSystems() {
            return systems != null && !systems.isEmpty();
        }

        boolean isExpired() {
            return timestamp <= 0 || (System.currentTimeMillis() - timestamp) > CACHE_TTL_MS;
        }

        double distanceTo(double x, double y, double z) {
            double dx = x - cx;
            double dy = y - cy;
            double dz = z - cz;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        boolean covers(double x, double y, double z) {
            if (!hasSystems() || isExpired()) return false;
            // O cubo baixado do EDSM tem 100 ly de extensão total (50 ly em cada direção a partir do centro).
            // Se o jogador estiver a até 35 ly do centro do cubo baixado, todo o espaço visual de 90 ly
            // já está coberto com dados do cache, sem necessidade de nova consulta ao servidor.
            return distanceTo(x, y, z) <= 35.0;
        }

        boolean overlapsWithin(double x, double y, double z, double maxRadiusLy) {
            return hasSystems() && distanceTo(x, y, z) <= maxRadiusLy;
        }
    }

    /**
     * Consulta os sistemas no EDSM para um cubo centralizado em (x,y,z) com lado 'cubeSize'.
     * Executa a análise de densidade espacial tridimensional para detectar bolsões de vazios.
     */
    public GalaxyCubeResponse analyzeCube(String systemName, Double x, Double y, Double z, double cubeSize, double voxelSize) {
        return analyzeCube(systemName, x, y, z, cubeSize, voxelSize, null);
    }

    public GalaxyCubeResponse analyzeCube(String systemName, Double x, Double y, Double z, double cubeSize, double voxelSize, List<RoutePointDTO> activeRoute) {
        // EDSM possui limite estrito no endpoint cube-systems de no máximo 100 ly.
        // Consultamos o teto máximo de 100 ly para ter dados completos com buffer perimetral.
        double querySize = 100.0;
        // O mapa visual é dimensionado em 90 ly (exatos 6 voxels de 15 ly cravados),
        // gerando exatamente 5 ly de gutter/buffer em todas as 6 direções (45 + 5 = 50 ly).
        double visualMapSize = (cubeSize > 0 && cubeSize <= 95.0) ? cubeSize : 90.0;
        if (voxelSize <= 0) {
            voxelSize = 10.0;
        }

        GalaxyCubeResponse response = new GalaxyCubeResponse();
        response.setCentralSystem(systemName != null ? systemName : "Posição Atual");
        response.setCenterX(x != null ? x : 0.0);
        response.setCenterY(y != null ? y : 0.0);
        response.setCenterZ(z != null ? z : 0.0);
        response.setCubeSize(visualMapSize);

        // Busca o cubo completo de 100 ly no cache (memória/disco) ou EDSM
        CubeFetchResult fetchResult = fetchSystemsWithSource(response.getCenterX(), response.getCenterY(), response.getCenterZ(), querySize);
        List<StarSystemDTO> rawSystems = new ArrayList<>(fetchResult.systems);
        response.setDataSource(fetchResult.source);
        response.setWarningMessage(fetchResult.warningMessage);

        // 0. Garante que o sistema onde o comandante está atualmente sempre conste (mesmo que seja inédito no EDSM ou recém-descoberto)
        if (systemName != null && !systemName.isBlank() && !systemName.equalsIgnoreCase("Posição Atual") && !systemName.equalsIgnoreCase("Desconhecido")) {
            boolean found = rawSystems.stream().anyMatch(s -> s.getName().equalsIgnoreCase(systemName));
            if (!found && x != null && y != null && z != null) {
                StarSystemDTO playerSys = new StarSystemDTO(systemName, x, y, z, "K (Orange) Star", 0.0);
                rawSystems.add(playerSys);
                locallyDiscoveredSystems.put(systemName.toLowerCase().trim(), playerSys);
                log.info("🌟 Sistema atual do jogador inserido no catálogo local do cubo: {} [{}, {}, {}]", systemName, x, y, z);
            }
        }

        // Insere todos os sistemas descobertos/visitados localmente nesta sessão que caem dentro do cubo
        double halfMax = querySize / 2.0;
        for (StarSystemDTO localSys : locallyDiscoveredSystems.values()) {
            if (Math.abs(localSys.getX() - response.getCenterX()) <= halfMax &&
                Math.abs(localSys.getY() - response.getCenterY()) <= halfMax &&
                Math.abs(localSys.getZ() - response.getCenterZ()) <= halfMax) {
                boolean alreadyIn = rawSystems.stream().anyMatch(s -> s.getName().equalsIgnoreCase(localSys.getName()));
                if (!alreadyIn) {
                    rawSystems.add(localSys);
                }
            }
        }

        // Recalcula a distância de cada estrela em relação ao centro atual do piloto
        // (importante quando o cubo é reaproveitado de um cache deslocado até 35 ly)
        double rcx = response.getCenterX();
        double rcy = response.getCenterY();
        double rcz = response.getCenterZ();
        for (StarSystemDTO s : rawSystems) {
            double dx = s.getX() - rcx;
            double dy = s.getY() - rcy;
            double dz = s.getZ() - rcz;
            s.setDistance(Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 100.0) / 100.0);
        }

        // 1. Consulta presenças 100% confirmadas de Stratum Tectonicas no Spansh (EDDN) em toda a área
        fetchConfirmedStratumFromSpansh(systemName, querySize, response.getCenterX(), response.getCenterY(), response.getCenterZ(), rawSystems);

        // 2. Consulta sistemas habitados / colonizados no Spansh
        fetchInhabitedSystemsFromSpansh(response.getCenterX(), response.getCenterY(), response.getCenterZ(), querySize, rawSystems);

        // 3. Escaneia corpos para detectar potencial de Stratum com validação no Spansh
        scanStratumCandidates(rawSystems, activeRoute);

        // 4. Detecção de Gaps Procedurais (quebra de sequência da Stellar Forge para achar estrelas virgens reais)
        List<VoidSectorDTO> gaps = detectProceduralGaps(response.getCenterX(), response.getCenterY(), response.getCenterZ(), visualMapSize, rawSystems);
        response.setVoidSectors(gaps);
        response.setDetectedVoidCount(gaps.size());

        // 5. Filtra para a resposta visual apenas as estrelas dentro do volume de 90 ly
        double halfVisual = visualMapSize / 2.0;
        List<StarSystemDTO> visualSystems = new ArrayList<>();
        double cx = response.getCenterX();
        double cy = response.getCenterY();
        double cz = response.getCenterZ();
        for (StarSystemDTO s : rawSystems) {
            if (Math.abs(s.getX() - cx) <= halfVisual &&
                Math.abs(s.getY() - cy) <= halfVisual &&
                Math.abs(s.getZ() - cz) <= halfVisual) {
                visualSystems.add(s);
            }
        }
        response.setSystems(visualSystems);
        response.setTotalKnownSystems(visualSystems.size());

        log.info("Cubo galáctico analisado em [{}, {}, {}] (Visível: {} ly): {} sistemas visíveis (de {} baixados), {} gaps procedurais inéditos detectados.",
                response.getCenterX(), response.getCenterY(), response.getCenterZ(), visualMapSize, visualSystems.size(), rawSystems.size(), gaps.size());

        return response;
    }

    /**
     * Consulta o Spansh (EDDN) para obter sistemas com presença 100% confirmada de Stratum Tectonicas
     * dentro do raio do cubo atual.
     */
    private void fetchConfirmedStratumFromSpansh(String centralSystem, double cubeSize, double cx, double cy, double cz, List<StarSystemDTO> systems) {
        if (centralSystem == null || centralSystem.isBlank()) return;
        String cacheKey = centralSystem.toLowerCase().trim() + "_" + (int) cubeSize;
        List<SpanshConfirmedSystem> confirmedList = spanshCache.get(cacheKey);

        if (confirmedList == null) {
            confirmedList = new ArrayList<>();
            try {
                int radius = Math.min(100, Math.max(30, (int) (cubeSize * 0.75)));
                String formBody = String.format(Locale.US,
                        "radius=%d&range=100&from=%s&max_results=30&max_distance=100000&min_value=19000000&avoid_thargoids=1&loop=1",
                        radius, java.net.URLEncoder.encode(centralSystem, java.nio.charset.StandardCharsets.UTF_8));

                HttpRequest postReq = HttpRequest.newBuilder()
                        .uri(URI.create("https://spansh.co.uk/api/exobiology/route"))
                        .timeout(Duration.ofSeconds(6))
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .header("User-Agent", "EliteDangerous-ExplorerHUD/1.0")
                        .POST(HttpRequest.BodyPublishers.ofString(formBody))
                        .build();

                HttpResponse<String> postResp = httpClient.send(postReq, HttpResponse.BodyHandlers.ofString());
                if (postResp.statusCode() == 200 || postResp.statusCode() == 202) {
                    JsonNode postJson = objectMapper.readTree(postResp.body());
                    String jobId = postJson.path("job").asText("");
                    if (!jobId.isBlank()) {
                        // Polling rápido pelo resultado (geralmente resolve em 300-600ms)
                        for (int attempt = 0; attempt < 10; attempt++) {
                            Thread.sleep(300);
                            HttpRequest getReq = HttpRequest.newBuilder()
                                    .uri(URI.create("https://spansh.co.uk/api/results/" + jobId))
                                    .timeout(Duration.ofSeconds(5))
                                    .header("User-Agent", "EliteDangerous-ExplorerHUD/1.0")
                                    .GET()
                                    .build();
                            HttpResponse<String> getResp = httpClient.send(getReq, HttpResponse.BodyHandlers.ofString());
                            if (getResp.statusCode() == 200 || getResp.statusCode() == 202) {
                                JsonNode getJson = objectMapper.readTree(getResp.body());
                                String status = getJson.path("status").asText("");
                                if ("ok".equalsIgnoreCase(status)) {
                                    JsonNode resultArr = getJson.path("result");
                                    if (resultArr.isArray()) {
                                        for (JsonNode sysNode : resultArr) {
                                            String sysName = sysNode.path("name").asText("");
                                            if (sysName.isBlank() || sysName.equalsIgnoreCase(centralSystem)) continue;

                                            double sx = sysNode.path("x").asDouble(0.0);
                                            double sy = sysNode.path("y").asDouble(0.0);
                                            double sz = sysNode.path("z").asDouble(0.0);

                                            SpanshConfirmedSystem cs = new SpanshConfirmedSystem();
                                            cs.name = sysName;
                                            cs.x = sx;
                                            cs.y = sy;
                                            cs.z = sz;

                                            JsonNode bodies = sysNode.path("bodies");
                                            if (bodies.isArray()) {
                                                for (JsonNode b : bodies) {
                                                    String planetName = b.path("name").asText("");
                                                    int distLs = b.path("distance_to_arrival").asInt(0);
                                                    long val = 19010800L;
                                                    String speciesName = "Stratum Tectonicas";

                                                    JsonNode landmarks = b.path("landmarks");
                                                    if (landmarks.isArray() && landmarks.size() > 0) {
                                                        JsonNode lm = landmarks.get(0);
                                                        speciesName = lm.path("subtype").asText("Stratum Tectonicas");
                                                        val = lm.path("value").asLong(19010800L);
                                                    }

                                                    StratumCandidateDTO dto = new StratumCandidateDTO(
                                                            planetName,
                                                            "Confirmada (Atmosfera Fina)",
                                                            0.0,
                                                            distLs,
                                                            false, // já catalogado no Spansh
                                                            true,  // confirmado!
                                                            val,
                                                            speciesName
                                                    );
                                                    cs.confirmedBodies.add(dto);
                                                }
                                            }

                                            if (!cs.confirmedBodies.isEmpty()) {
                                                confirmedList.add(cs);
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
                log.info("Spansh retornou {} sistemas com Stratum Tectonicas confirmada na região de {}.", confirmedList.size(), centralSystem);
                spanshCache.put(cacheKey, confirmedList);
            } catch (Exception e) {
                log.warn("Erro ao consultar rota de exobiologia confirmada no Spansh: {}", e.getMessage());
            }
        }

        // Aplica os corpos confirmados aos sistemas conhecidos
        Map<String, StarSystemDTO> sysMap = new HashMap<>();
        for (StarSystemDTO s : systems) {
            sysMap.put(s.getName().toLowerCase().trim(), s);
        }

        double halfCube = (cubeSize / 2.0) + 1.0;
        for (SpanshConfirmedSystem cs : confirmedList) {
            StarSystemDTO targetSys = sysMap.get(cs.name.toLowerCase().trim());
            if (targetSys != null) {
                for (StratumCandidateDTO b : cs.confirmedBodies) {
                    planetHistoryService.enrichCandidate(b);
                    targetSys.addStratumCandidate(b);
                }
            } else {
                // Se o sistema confirmado estiver dentro dos limites do cubo, adiciona à lista
                double dx = Math.abs(cs.x - cx);
                double dy = Math.abs(cs.y - cy);
                double dz = Math.abs(cs.z - cz);
                if (dx <= halfCube && dy <= halfCube && dz <= halfCube) {
                    double dist = Math.sqrt((cs.x - cx) * (cs.x - cx) + (cs.y - cy) * (cs.y - cy) + (cs.z - cz) * (cs.z - cz));
                    StarSystemDTO extraSys = new StarSystemDTO(cs.name, cs.x, cs.y, cs.z, dist, 1);
                    extraSys.setStarType("K (Orange) Star");
                    for (StratumCandidateDTO b : cs.confirmedBodies) {
                        planetHistoryService.enrichCandidate(b);
                        extraSys.addStratumCandidate(b);
                    }
                    systems.add(extraSys);
                    sysMap.put(cs.name.toLowerCase().trim(), extraSys);
                }
            }
        }
    }

    /**
     * Consulta sistemas colonizados / com população > 0 no Spansh para permitir filtragem rápida no mapa 3D.
     */
    private void fetchInhabitedSystemsFromSpansh(double cx, double cy, double cz, double cubeSize, List<StarSystemDTO> systems) {
        String cacheKey = String.format(Locale.US, "inhabited_%.0f_%.0f_%.0f", cx, cy, cz);
        Map<String, Long> cached = inhabitedCache.get(cacheKey);

        if (cached == null) {
            cached = new ConcurrentHashMap<>();
            try {
                int radius = Math.min(100, Math.max(30, (int) (cubeSize * 0.75)));
                String jsonBody = String.format(Locale.US,
                        "{\"filters\":{\"is_colonised\":{\"value\":true},\"distance\":{\"min\":0,\"max\":%d}},\"size\":500,\"reference_coords\":{\"x\":%.2f,\"y\":%.2f,\"z\":%.2f}}",
                        radius, cx, cy, cz);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://spansh.co.uk/api/systems/search"))
                        .timeout(Duration.ofSeconds(6))
                        .header("Content-Type", "application/json")
                        .header("User-Agent", "EliteDangerous-ExplorerHUD/1.0")
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                        .build();

                HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() == 200) {
                    JsonNode root = objectMapper.readTree(resp.body());
                    JsonNode results = root.path("results");
                    if (results.isArray()) {
                        for (JsonNode item : results) {
                            String name = item.path("name").asText();
                            long pop = item.path("population").asLong(0);
                            cached.put(name.toLowerCase().trim(), pop);
                        }
                    }
                    inhabitedCache.put(cacheKey, cached);
                    log.info("Spansh retornou {} sistemas habitados na região de [{}, {}, {}].", cached.size(), cx, cy, cz);
                }
            } catch (Exception e) {
                log.warn("Erro ao buscar sistemas habitados no Spansh: {}", e.getMessage());
            }
        }

        if (cached != null && !cached.isEmpty()) {
            Map<String, StarSystemDTO> map = new HashMap<>();
            for (StarSystemDTO s : systems) {
                if (s.getName() != null) {
                    map.put(s.getName().toLowerCase().trim(), s);
                }
            }

            for (Map.Entry<String, Long> entry : cached.entrySet()) {
                StarSystemDTO sys = map.get(entry.getKey());
                if (sys != null) {
                    sys.setPopulation(entry.getValue());
                    sys.setInhabited(entry.getValue() > 0);
                }
            }
        }
    }

    /**
     * Anexa imediatamente corpos já conhecidos no cache e enfileira os demais sistemas
     * para escaneamento suave e contínuo em background (taxa segura e educada para a comunidade).
     */
    private void scanStratumCandidates(List<StarSystemDTO> systems, List<RoutePointDTO> activeRoute) {
        Set<String> prioritySystems = new HashSet<>();
        if (activeRoute != null) {
            for (RoutePointDTO pt : activeRoute) {
                if (pt.getStarSystem() != null && !pt.getStarSystem().isBlank()) {
                    prioritySystems.add(pt.getStarSystem().toLowerCase().trim());
                }
            }
        }

        // 1. Aplica imediatamente quaisquer corpos já conhecidos no cache (memória / disco)
        for (StarSystemDTO sys : systems) {
            String key = sys.getName().toLowerCase().trim();
            List<StratumCandidateDTO> cached = systemBodiesCache.get(key);
            if (cached != null && !cached.isEmpty()) {
                for (StratumCandidateDTO c : cached) {
                    planetHistoryService.enrichCandidate(c);
                    sys.addStratumCandidate(c);
                }
            }
            if (sys.getStratumCandidates() != null) {
                for (StratumCandidateDTO c : sys.getStratumCandidates()) {
                    planetHistoryService.enrichCandidate(c);
                }
            }
        }

        // 2. Ordena sistemas para priorizar a rota ativa e sistemas mais próximos da nave
        List<StarSystemDTO> targets = new ArrayList<>(systems);
        targets.sort((a, b) -> {
            boolean aPrio = prioritySystems.contains(a.getName().toLowerCase().trim());
            boolean bPrio = prioritySystems.contains(b.getName().toLowerCase().trim());
            if (aPrio && !bPrio) return -1;
            if (!aPrio && bPrio) return 1;
            return Double.compare(a.getDistance(), b.getDistance());
        });

        // 3. Enfileira todos os sistemas na fila prioritária (ninguém fica de fora)
        for (StarSystemDTO sys : targets) {
            if (sys.isHasStratumConfirmed()) {
                continue; // Já confirmado com precisão no Spansh
            }
            if (sys.getBodyCount() != null && sys.getBodyCount() <= 0) {
                continue; // Sistema sem corpos estelares catalogados
            }
            String key = sys.getName().toLowerCase().trim();
            if (!systemBodiesCache.containsKey(key) && enqueuedSystems.add(key)) {
                int group;
                if (prioritySystems.contains(key)) {
                    group = 0; // Prioridade máxima: Rota ativa
                } else if (sys.getDistance() <= 30.0) {
                    group = 1; // Prioridade alta: Vizinhança imediata (<30 ly, 1 salto)
                } else if (sys.getDistance() <= 60.0) {
                    group = 2; // Prioridade média: Alcance intermediário (30 a 60 ly)
                } else {
                    group = 3; // Demais estrelas do cubo (abrindo progressivamente até a borda)
                }
                inspectionQueue.offer(new PrioritizedSystem(sys.getName(), group, sys.getDistance()));
            }
        }
    }

    /**
     * Retorna um mapa de todos os sistemas que possuem candidatos a Stratum Tectonicas conhecidos.
     */
    public Map<String, List<StratumCandidateDTO>> getAllKnownStratumCandidates() {
        Map<String, List<StratumCandidateDTO>> result = new HashMap<>();
        for (Map.Entry<String, List<StratumCandidateDTO>> entry : systemBodiesCache.entrySet()) {
            if (entry.getValue() != null && !entry.getValue().isEmpty()) {
                for (StratumCandidateDTO c : entry.getValue()) {
                    planetHistoryService.enrichCandidate(c);
                }
                result.put(entry.getKey(), entry.getValue());
            }
        }
        return result;
    }

    /**
     * Consulta as estações espaciais catalogadas no EDSM para um determinado sistema.
     * Permite ao piloto encontrar ancoragens seguras (Starports, Outposts, etc.) para pausar a viagem.
     */
    public List<StationDTO> getSystemStations(String systemName) {
        if (systemName == null || systemName.isBlank()) return Collections.emptyList();
        String key = systemName.toLowerCase().trim();
        if (stationsCache.containsKey(key)) {
            return stationsCache.get(key);
        }

        List<StationDTO> stations = new ArrayList<>();
        try {
            String url = "https://www.edsm.net/api-system-v1/stations?systemName=" + java.net.URLEncoder.encode(systemName, java.nio.charset.StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("User-Agent", "EliteDangerous-ExplorerHUD/1.0")
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(resp.body());
                JsonNode stArray = root.path("stations");
                if (stArray.isArray()) {
                    for (JsonNode s : stArray) {
                        String type = s.path("type").asText("");
                        if (type == null || type.isBlank() || "null".equalsIgnoreCase(type)) {
                            continue;
                        }
                        String typeLower = type.toLowerCase();
                        // Filtra estações terrestres/planetárias (mantém apenas ancoragens espaciais orbitais)
                        if (typeLower.contains("planetary") || typeLower.contains("settlement") || typeLower.contains("surface")) {
                            continue;
                        }
                        String name = s.path("name").asText();
                        double distLs = s.path("distanceToArrival").asDouble(0.0);
                        boolean hasShipyard = s.path("haveShipyard").asBoolean(false);
                        boolean hasOutfitting = s.path("haveOutfitting").asBoolean(false);
                        boolean hasMarket = s.path("haveMarket").asBoolean(false);
                        String body = s.path("body").path("name").asText("");

                        stations.add(new StationDTO(name, type, distLs, hasShipyard, hasOutfitting, hasMarket, body));
                    }
                }
                stations.sort(Comparator.comparingDouble(StationDTO::getDistanceLs));
                stationsCache.put(key, stations);
            }
        } catch (Exception e) {
            log.warn("Erro ao buscar estações para {}: {}", systemName, e.getMessage());
        }
        return stations;
    }

    private boolean isThinAtmosphere(String atm) {
        if (atm == null || atm.isBlank()) return false;
        String lower = atm.toLowerCase();
        // Stratum Tectonicas só se desenvolve em atmosferas de SO2, CO2 e raramente NH3
        return lower.contains("thin") && (
                lower.contains("carbon dioxide") ||
                lower.contains("sulphur dioxide") ||
                lower.contains("ammonia")
        );
    }

    /**
     * Remove um corpo dos candidatos a Stratum quando o scanner DSS em jogo confirma
     * que os sinais biológicos presentes NÃO contêm Stratum (ex: gerou apenas Bacterium).
     */
    public void markBodyNonStratum(String systemName, String bodyName) {
        if (systemName == null || bodyName == null) return;
        String key = systemName.toLowerCase().trim();
        List<StratumCandidateDTO> candidates = systemBodiesCache.get(key);
        if (candidates != null && !candidates.isEmpty()) {
            boolean removed = candidates.removeIf(c -> c.getPlanetName().equalsIgnoreCase(bodyName));
            if (removed) {
                log.info("Corpo {} em {} marcado como NÃO-Stratum (falso positivo descartado pelo DSS). Restantes: {}",
                        bodyName, systemName, candidates.size());
                saveCacheToDisk();
            }
        }
    }

    CacheEntry findClosestCoveringEntry(double cx, double cy, double cz, double maxRadiusLy, boolean allowExpired) {
        CacheEntry best = null;
        double bestDist = Double.MAX_VALUE;
        for (CacheEntry entry : systemsCache.values()) {
            if (!entry.hasSystems()) continue;
            if (!allowExpired && entry.isExpired()) continue;
            double dist = entry.distanceTo(cx, cy, cz);
            if (dist <= maxRadiusLy && dist < bestDist) {
                bestDist = dist;
                best = entry;
            }
        }
        return best;
    }

    private CubeFetchResult fetchSystemsWithSource(double cx, double cy, double cz, double size) {
        double querySize = Math.min(100.0, Math.max(20.0, size));

        synchronized (cubeFetchLock) {
            // 1. Verifica cache válido (memória + carregado do disco) cobrindo a região atual (até 35 ly do centro)
            CacheEntry freshHit = findClosestCoveringEntry(cx, cy, cz, 35.0, false);
            if (freshHit != null) {
                double dist = freshHit.distanceTo(cx, cy, cz);
                log.info("Cubo galáctico reaproveitado do CACHE local (distância do centro: {} ly, {} sistemas). Zero requisições ao EDSM.",
                        String.format(Locale.US, "%.1f", dist), freshHit.systems.size());
                return new CubeFetchResult(freshHit.systems, "CACHE", null);
            }

            // Prepara fallback de cache expirado/próximo caso o EDSM falhe ou limite taxa
            CacheEntry staleFallback = findClosestCoveringEntry(cx, cy, cz, 50.0, true);

            String cacheKey = String.format(Locale.US, "%.0f_%.0f_%.0f_%.0f", cx, cy, cz, querySize);
            String url = String.format(Locale.US,
                    "https://www.edsm.net/api-v1/cube-systems?x=%.2f&y=%.2f&z=%.2f&size=%.2f&showCoordinates=1&showPrimaryStar=1",
                    cx, cy, cz, querySize);
            log.info("Requisitando EDSM (miss no cache): {}", url);

            String lastError = null;
            int maxAttempts = 3;
            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .timeout(Duration.ofSeconds(25))
                            .header("User-Agent", "EliteDangerous-ExplorerHUD/1.0")
                            .GET()
                            .build();

                    HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    int status = resp.statusCode();
                    if (status == 200) {
                        JsonNode root = objectMapper.readTree(resp.body());
                        if (root.isArray() && !root.isEmpty()) {
                            List<StarSystemDTO> list = parseEdsmCubeArray(root);
                            if (!list.isEmpty()) {
                                CacheEntry entry = new CacheEntry(cx, cy, cz, querySize, list);
                                systemsCache.put(cacheKey, entry);
                                saveCubeCacheEntryToDisk(cacheKey, entry);
                                log.info("Cubo galáctico baixado do EDSM ({} sistemas) e persistido em cache local.", list.size());
                                return new CubeFetchResult(entry.systems, "EDSM", null);
                            }
                        }
                        lastError = "EDSM retornou resposta vazia";
                        log.warn("{} (tentativa {}/{}).", lastError, attempt, maxAttempts);
                    } else if (status == 429 || status >= 500) {
                        lastError = "EDSM HTTP " + status;
                        log.warn("EDSM retornou HTTP {} (tentativa {}/{}).", status, attempt, maxAttempts);
                        if (attempt < maxAttempts) {
                            long waitMs = resolveRetryDelayMs(resp, attempt);
                            Thread.sleep(waitMs);
                        }
                    } else {
                        lastError = "EDSM HTTP " + status;
                        log.warn("EDSM retornou HTTP {} sem possibilidade de retry.", status);
                        break;
                    }
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    lastError = "Requisição interrompida";
                    break;
                } catch (Exception e) {
                    lastError = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                    log.warn("Erro ao buscar sistemas do EDSM (tentativa {}/{}): {}", attempt, maxAttempts, lastError);
                    if (attempt < maxAttempts) {
                        try {
                            Thread.sleep(1500L * attempt);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                }
            }

            if (staleFallback != null) {
                double dist = staleFallback.distanceTo(cx, cy, cz);
                log.warn("Falha no EDSM ({}). Utilizando cache local prévio ({} sistemas, centro a {} ly).",
                        lastError, staleFallback.systems.size(), String.format(Locale.US, "%.1f", dist));
                return new CubeFetchResult(staleFallback.systems, "STALE_CACHE",
                        "EDSM indisponível (" + lastError + "). Exibindo cache local prévio.");
            }

            log.error("Falha ao baixar cubo galáctico do EDSM ({}) e nenhum cache local cobre a região [{}, {}, {}].",
                    lastError, cx, cy, cz);
            return new CubeFetchResult(Collections.emptyList(), "LOCAL_ONLY",
                    "EDSM indisponível (" + lastError + "). Exibindo apenas sistemas locais descobertos.");
        }
    }

    private long resolveRetryDelayMs(HttpResponse<String> resp, int attempt) {
        Optional<String> retryAfter = resp.headers().firstValue("Retry-After");
        if (retryAfter.isPresent()) {
            try {
                long seconds = Long.parseLong(retryAfter.get().trim());
                return Math.min(10000L, Math.max(1000L, seconds * 1000L));
            } catch (NumberFormatException ignored) {
            }
        }
        return 1500L * attempt;
    }

    private List<StarSystemDTO> parseEdsmCubeArray(JsonNode root) {
        List<StarSystemDTO> list = new ArrayList<>();
        for (JsonNode item : root) {
            String name = item.path("name").asText();
            if (name == null || name.isBlank()) continue;
            double distance = item.path("distance").asDouble(0.0);
            Integer bodyCount = item.has("bodyCount") && !item.path("bodyCount").isNull()
                    ? item.path("bodyCount").asInt() : null;
            JsonNode coords = item.path("coords");
            double sx = coords.path("x").asDouble();
            double sy = coords.path("y").asDouble();
            double sz = coords.path("z").asDouble();
            boolean locked = item.path("coordsLocked").asBoolean(false);

            StarSystemDTO dto = new StarSystemDTO(name, sx, sy, sz, distance, bodyCount);
            dto.setCoordsLocked(locked);

            JsonNode primary = item.path("primaryStar");
            if (!primary.isMissingNode() && primary.isObject()) {
                dto.setStarType(primary.path("type").asText(null));
                if (primary.has("isScoopable")) {
                    dto.setIsScoopable(primary.path("isScoopable").asBoolean());
                }
            }
            list.add(dto);
        }
        return list;
    }

    /**
     * Regex de nomenclatura procedural do Stellar Forge do Elite Dangerous:
     * Exemplo: "Synuefe HC-L a76-2" -> Grupo 1: "Synuefe HC-L a76-", Grupo 2: "a", Grupo 3: "2"
     * Exemplo: "Col 285 Sector AA-A b1-0" -> Grupo 1: "Col 285 Sector AA-A b1-", Grupo 2: "b", Grupo 3: "0"
     */
    private static final Pattern PG_PATTERN = Pattern.compile("^(.+\\s+[A-Za-z]{2}-[A-Za-z]\\s+([a-hA-H])\\d*-)(\\d+)$");

    /**
     * Detecta "Gaps Procedurais" na numeração gerada pelo Stellar Forge da Frontier.
     * Na regra da Stellar Forge, cada octree/subsector de massa (código a, b, c, d, etc.)
     * numera suas estrelas sequencialmente a partir de 0 (ex: a76-0, a76-1, a76-2...).
     * Se existem no EDSM o -0 e o -2 mas não o -1, a estrela -1 com certeza existe no motor
     * do jogo físico mas NUNCA foi visitada e enviada por nenhum comandante!
     */
    private List<VoidSectorDTO> detectProceduralGaps(double cx, double cy, double cz, double mapSize, List<StarSystemDTO> systems) {
        List<VoidSectorDTO> gaps = new ArrayList<>();
        if (systems == null || systems.isEmpty()) {
            return gaps;
        }

        // Garante que todos os sistemas descobertos localmente estejam incluídos para contagem de sequências
        for (StarSystemDTO local : locallyDiscoveredSystems.values()) {
            if (systems.stream().noneMatch(s -> s.getName().equalsIgnoreCase(local.getName()))) {
                systems.add(local);
            }
        }

        // 1. Agrupa sistemas conhecidos por prefixo de sub-bloco
        Map<String, List<StarSystemDTO>> prefixGroups = new HashMap<>();
        Map<String, String> prefixMassCodes = new HashMap<>();
        Map<String, Set<Integer>> prefixSequences = new HashMap<>();

        for (StarSystemDTO s : systems) {
            if (s.getName() == null) continue;
            Matcher m = PG_PATTERN.matcher(s.getName().trim());
            if (m.matches()) {
                String prefix = m.group(1);
                String massCode = m.group(2).toLowerCase();
                int seq;
                try {
                    seq = Integer.parseInt(m.group(3));
                } catch (NumberFormatException ignored) {
                    continue;
                }

                prefixGroups.computeIfAbsent(prefix, k -> new ArrayList<>()).add(s);
                prefixMassCodes.put(prefix, massCode);
                prefixSequences.computeIfAbsent(prefix, k -> new HashSet<>()).add(seq);
            }
        }

        double halfMap = mapSize / 2.0;

        // 2. Para cada bloco procedural com ao menos 2 irmãos conhecidos, calcula centroide e identifica números faltantes
        for (Map.Entry<String, List<StarSystemDTO>> entry : prefixGroups.entrySet()) {
            String prefix = entry.getKey();
            List<StarSystemDTO> siblings = entry.getValue();
            Set<Integer> seqSet = prefixSequences.get(prefix);
            String massCode = prefixMassCodes.getOrDefault(prefix, "c");

            // Exige ao menos 2 estrelas do mesmo bloco para delimitar com precisão o cluster 3D
            if (siblings.size() < 2 || seqSet == null || seqSet.isEmpty()) {
                continue;
            }

            int maxSeq = -1;
            for (int s : seqSet) {
                if (s > maxSeq) maxSeq = s;
            }

            // Limite de segurança de sequência razoável para evitar anomalias de nomenclatura
            if (maxSeq > 35) continue;

            // Centroide geométrico do cluster de estrelas irmãs
            double sumX = 0, sumY = 0, sumZ = 0;
            for (StarSystemDTO s : siblings) {
                sumX += s.getX();
                sumY += s.getY();
                sumZ += s.getZ();
            }
            double avgX = sumX / siblings.size();
            double avgY = sumY / siblings.size();
            double avgZ = sumZ / siblings.size();

            // Verifica se o cluster está dentro dos limites do volume visível do mapa
            if (Math.abs(avgX - cx) > halfMap || Math.abs(avgY - cy) > halfMap || Math.abs(avgZ - cz) > halfMap) {
                continue;
            }

            double distToPlayer = Math.sqrt(
                    Math.pow(avgX - cx, 2) + Math.pow(avgY - cy, 2) + Math.pow(avgZ - cz, 2)
            );

            // Precisão espacial em anos-luz baseada no tamanho da caixa de massa do Stellar Forge:
            // a = 10 ly, b = 20 ly, c = 40 ly, d = 80 ly
            double accuracyLy;
            double massConfidence;
            switch (massCode) {
                case "a":
                    accuracyLy = 10.0;
                    massConfidence = 0.95;
                    break;
                case "b":
                    accuracyLy = 20.0;
                    massConfidence = 0.85;
                    break;
                case "c":
                    accuracyLy = 40.0;
                    massConfidence = 0.70;
                    break;
                case "d":
                    accuracyLy = 80.0;
                    massConfidence = 0.55;
                    break;
                default:
                    accuracyLy = 80.0;
                    massConfidence = 0.40;
                    break;
            }

            // Identifica as estrelas que faltam na sequência entre 0 e maxSeq
            for (int i = 0; i <= maxSeq; i++) {
                if (!seqSet.contains(i)) {
                    String missingName = prefix + i;
                    if (isSystemKnown(missingName)) {
                        continue; // O comandante já provou que este sistema existe! Não é mais um gap!
                    }
                    VoidSectorDTO gap = new VoidSectorDTO();
                    gap.setId("gap_" + missingName.replaceAll("\\s+", "_"));
                    gap.setSystemName(missingName);
                    gap.setBoxPrefix(prefix);
                    gap.setMassCode(massCode.toUpperCase());
                    gap.setAccuracyLy(accuracyLy);
                    gap.setMissingSequence(i);
                    gap.setKnownSiblingCount(siblings.size());
                    gap.setCenterX(avgX);
                    gap.setCenterY(avgY);
                    gap.setCenterZ(avgZ);
                    gap.setSize(accuracyLy);
                    gap.setDistanceToPlayer(distToPlayer);
                    gap.setExpectedDensity(siblings.size() + 1.0);
                    gap.setNeighborCount(siblings.size());

                    // Score: precisão da classe de massa + proximidade da nave
                    double proxBonus = Math.max(0.0, 1.0 - (distToPlayer / mapSize));
                    gap.setVoidScore(massConfidence * 0.7 + proxBonus * 0.3);

                    // Waypoint de salto: a estrela irmã mais próxima da nave
                    StarSystemDTO closestSibling = null;
                    double minSibDist = Double.MAX_VALUE;
                    for (StarSystemDTO s : siblings) {
                        double d = Math.sqrt(Math.pow(s.getX() - cx, 2) + Math.pow(s.getY() - cy, 2) + Math.pow(s.getZ() - cz, 2));
                        if (d < minSibDist) {
                            minSibDist = d;
                            closestSibling = s;
                        }
                    }

                    if (closestSibling != null) {
                        gap.setWaypointSystemName(closestSibling.getName());
                        gap.setWaypointX(closestSibling.getX());
                        gap.setWaypointY(closestSibling.getY());
                        gap.setWaypointZ(closestSibling.getZ());
                        gap.setWaypointDistanceToPlayer(minSibDist);
                        gap.setWaypointDistanceToVoid(Math.sqrt(
                                Math.pow(closestSibling.getX() - avgX, 2) +
                                Math.pow(closestSibling.getY() - avgY, 2) +
                                Math.pow(closestSibling.getZ() - avgZ, 2)
                        ));
                    }

                    // Amostra de sistemas irmãos para contextualização no HUD
                    List<String> sibNames = siblings.stream().map(StarSystemDTO::getName).toList();
                    String sample = String.join(", ", sibNames.subList(0, Math.min(3, sibNames.size())));
                    if (sibNames.size() > 3) {
                        sample += " (+" + (sibNames.size() - 3) + " mais)";
                    }
                    gap.setSiblingsSample(sample);

                    gaps.add(gap);
                }
            }
        }

        // Ordena priorizando sistemas não catalogados mais próximos da nave do jogador
        gaps.sort(Comparator.comparingDouble(VoidSectorDTO::getDistanceToPlayer));

        // Mantém os 25 mais próximos para garantir exploração ágil e HUD limpo
        if (gaps.size() > 25) {
            gaps = new ArrayList<>(gaps.subList(0, 25));
        }

        return gaps;
    }
}
