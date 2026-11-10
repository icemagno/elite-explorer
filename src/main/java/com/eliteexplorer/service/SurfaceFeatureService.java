package com.eliteexplorer.service;

import com.eliteexplorer.dto.PlanetaryStatusDTO;
import com.eliteexplorer.dto.SurfaceFeatureDTO;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SurfaceFeatureService {

    private static final Logger log = LoggerFactory.getLogger(SurfaceFeatureService.class);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    private final File cacheFile = new File("cache/surface_features_history.json");

    // Cache de elementos de solo por nome limpo do corpo celeste
    private final Map<String, List<SurfaceFeatureDTO>> featuresByBody = new ConcurrentHashMap<>();
    private final Map<String, int[]> dssSignalCountsByBody = new ConcurrentHashMap<>(); // [bio, geo, human, mining]
    private final Map<String, List<SurfaceFeatureDTO>> systemStationsCache = new ConcurrentHashMap<>();

    // Catálogo de POIs Lendários da Galáxia com coordenadas GPS oficiais
    private final Map<String, List<SurfaceFeatureDTO>> legendarySites = new HashMap<>();

    public SurfaceFeatureService() {
        initLegendarySites();
    }

    @PostConstruct
    public void init() {
        loadFeaturesFromCache();
    }

    private synchronized void loadFeaturesFromCache() {
        if (!cacheFile.exists()) return;
        try {
            Map<String, List<SurfaceFeatureDTO>> loaded = objectMapper.readValue(
                    cacheFile, new TypeReference<Map<String, List<SurfaceFeatureDTO>>>() {}
            );
            if (loaded != null) {
                loaded.forEach((k, v) -> {
                    if (v != null) {
                        featuresByBody.put(k, new ArrayList<>(v));
                    }
                });
                log.info("🗺️ [SURFACE FEATURES] {} corpos com pontos de interesse carregados do cache.", featuresByBody.size());
            }
        } catch (Exception e) {
            log.warn("Falha ao carregar cache de elementos em solo: {}", e.getMessage());
        }
    }

    private synchronized void saveFeaturesToCache() {
        try {
            if (cacheFile.getParentFile() != null) {
                cacheFile.getParentFile().mkdirs();
            }
            Map<String, List<SurfaceFeatureDTO>> confirmedOnly = new HashMap<>();
            featuresByBody.forEach((k, list) -> {
                List<SurfaceFeatureDTO> confirmed = list.stream()
                        .filter(f -> f.isGpsConfirmed() && f.getLatitude() != null && f.getLongitude() != null)
                        .toList();
                if (!confirmed.isEmpty()) {
                    confirmedOnly.put(k, new ArrayList<>(confirmed));
                }
            });
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(cacheFile, confirmedOnly);
        } catch (Exception e) {
            log.warn("Falha ao salvar cache de elementos em solo: {}", e.getMessage());
        }
    }

    private void initLegendarySites() {
        // Jameson Crash Site
        addLegendary("hip 12099 1 b", new SurfaceFeatureDTO(
                "poi-jameson", "Jameson Crash Site (Cobra Mk III)", "CRASH_SITE", "Lore / Engenharia",
                -54.3803, -50.3575, "HIP 12099 1 b", "Nave abatida do Cmdr John Jameson • Farm de Dados INRA Grau 5"
        ));

        // Dav's Hope
        addLegendary("hyades sector dr-v c2-23 a 5", new SurfaceFeatureDTO(
                "poi-davs-hope", "Dav's Hope Mining Facility", "SETTLEMENT", "Assentamento Abandonado",
                44.8367, -31.3874, "Hyades Sector DR-V c2-23 A 5", "Mina abandonada da Lore • Materiais Manufaturados de Engenharia"
        ));

        // Bug Killer
        addLegendary("hip 16613 1 a", new SurfaceFeatureDTO(
                "poi-bug-killer", "Bug Killer Crash Site", "CRASH_SITE", "Thargoid Attack",
                -11.0068, -95.6145, "HIP 16613 1 a", "Anaconda abatida por Thargoids • Dados e Carga Recuperável"
        ));

        // Guardian Structures & Ruins
        addLegendary("synuefe nl-n c23-4 b 3", new SurfaceFeatureDTO(
                "poi-guardian-fsd", "Guardian Structure Alpha", "GUARDIAN", "Tecnologia Antiga",
                48.1807, -48.3718, "Synuefe NL-N c23-4 B 3", "Estrutura Guardiã Ativa • Blueprint de Módulo FSD Guardião"
        ));

        addLegendary("synuefe gt-h b43-1 c 4", new SurfaceFeatureDTO(
                "poi-guardian-ruins-1", "Guardian Ruins Complex Gamma", "GUARDIAN", "Ruínas Antigas",
                -34.8210, -16.8920, "Synuefe GT-H b43-1 C 4", "Ruínas com Obeliscos Alpha e Dados Culturais Guardiões"
        ));
    }

    private void addLegendary(String bodyKey, SurfaceFeatureDTO dto) {
        legendarySites.computeIfAbsent(bodyKey.toLowerCase().trim(), k -> new ArrayList<>()).add(dto);
    }

    public synchronized void recordSettlementApproach(String name, long marketId, String bodyName, double lat, double lon) {
        recordKnownPointOfInterest(name, name, bodyName, lat, lon, "");
    }

    public synchronized void recordKnownPointOfInterest(String rawDest, String locName, String bodyName, double lat, double lon, String starSystem) {
        if (bodyName == null || bodyName.isBlank()) return;
        String key = cleanKey(bodyName);
        List<SurfaceFeatureDTO> list = featuresByBody.computeIfAbsent(key, k -> new ArrayList<>());

        String name = (locName != null && !locName.isBlank()) ? locName : rawDest;
        if (name == null || name.isBlank()) return;
        if (name.startsWith("Sinal: ")) {
            name = name.substring(7).trim();
        }

        String lower = ((rawDest != null ? rawDest : "") + " " + name).toLowerCase();
        String featureType = "SETTLEMENT";
        String subType = "Ponto de Interesse";
        String displayName = name;

        if (lower.contains("mining") || lower.contains("minera")) {
            featureType = "EXTRACTION";
            subType = "Mineração Planetária";
            Matcher m = Pattern.compile("(\\d+)").matcher(name);
            if (m.find()) {
                displayName = "Local de Mineração #" + m.group(1);
            } else if (name.toLowerCase().contains("local de minera")) {
                displayName = "Local de Mineração";
            }
        } else if (lower.contains("crash") || lower.contains("wreck") || lower.contains("destro")) {
            featureType = "CRASH_SITE";
            subType = "Destroços / Queda";
        } else if (lower.contains("distress") || lower.contains("emergency") || lower.contains("socorro")) {
            featureType = "DISTRESS_BEACON";
            subType = "Sinal de Socorro";
        } else if (lower.contains("geo") || lower.contains("fumarol") || lower.contains("geyser") || lower.contains("vulc") || lower.contains("vent")) {
            featureType = "GEO_SITE";
            subType = "Sítio Geológico";
        } else if (lower.contains("guardian") || lower.contains("ruin")) {
            featureType = "GUARDIAN";
            subType = "Ruína Guardiã";
        } else if (lower.contains("bio") || lower.contains("organic") || lower.contains("research") || lower.contains("lab")) {
            featureType = "RESEARCH";
            subType = "Pesquisa / Bio";
        } else if (lower.contains("port") || lower.contains("outpost") || lower.contains("exchange")) {
            featureType = "PORT";
            subType = "Porto Planetário";
        }

        final String finalDisplayName = displayName;
        final String finalType = featureType;
        Optional<SurfaceFeatureDTO> existing = list.stream()
                .filter(f -> f.getName().equalsIgnoreCase(finalDisplayName) ||
                        (f.isGpsConfirmed() && f.getLatitude() != null && f.getLongitude() != null &&
                         f.getType().equals(finalType) && Math.abs(f.getLatitude() - lat) < 0.005 && Math.abs(f.getLongitude() - lon) < 0.005))
                .findFirst();

        if (existing.isPresent()) {
            SurfaceFeatureDTO dto = existing.get();
            dto.setName(finalDisplayName);
            dto.setType(featureType);
            dto.setSubType(subType);
            dto.setLatitude(lat);
            dto.setLongitude(lon);
            dto.setGpsConfirmed(true);
            dto.setDiscoveredByPlayer(true);
            dto.setDescription("Confirmado em solo pelo Comandante (GPS real)");
            log.info("📍 [SURFACE FEATURE] POI atualizado: {} em {} [Lat: {}, Lon: {}]", finalDisplayName, bodyName, lat, lon);
        } else {
            String id = "poi-" + Math.abs((bodyName + finalDisplayName + Math.round(lat * 100)).hashCode());
            SurfaceFeatureDTO dto = new SurfaceFeatureDTO(
                    id,
                    finalDisplayName,
                    featureType,
                    subType,
                    lat,
                    lon,
                    bodyName,
                    "Confirmado em solo pelo Comandante (GPS real)"
            );
            dto.setGpsConfirmed(true);
            dto.setDiscoveredByPlayer(true);
            list.add(dto);
            log.info("📍 [SURFACE FEATURE] Novo POI registrado: {} em {} [Lat: {}, Lon: {}]", finalDisplayName, bodyName, lat, lon);
        }

        saveFeaturesToCache();
    }

    public synchronized void recordDssSignalCounts(String bodyName, Integer bio, Integer geo, Integer human, Integer mining) {
        if (bodyName == null || bodyName.isBlank()) return;
        String key = cleanKey(bodyName);
        int[] counts = dssSignalCountsByBody.computeIfAbsent(key, k -> new int[]{-1, -1, -1, -1});
        if (bio != null) counts[0] = bio;
        if (geo != null) counts[1] = geo;
        if (human != null) counts[2] = human;
        if (mining != null) counts[3] = mining;
    }

    public void syncPlanetaryStatusSignals(PlanetaryStatusDTO ps, String systemName, String bodyName) {
        if (ps == null || bodyName == null || bodyName.isBlank()) return;
        String key = cleanKey(bodyName);
        int[] counts = dssSignalCountsByBody.get(key);
        if (counts != null) {
            if (counts[0] >= 0) ps.setBioSignalsCount(counts[0]);
            if (counts[1] >= 0) ps.setGeoSignalsCount(counts[1]);
            if (counts[2] >= 0) ps.setHumanSignalsCount(counts[2]);
            if (counts[3] >= 0) ps.setMiningSignalsCount(counts[3]);
        }
        ps.setSurfaceFeatures(getFeaturesForBody(systemName, bodyName));
    }

    public synchronized void recordDssSignals(String systemName, String bodyName, JsonNode signalsNode, JsonNode genusesNode) {
        if (bodyName == null || bodyName.isBlank()) return;
        Integer bio = null;
        Integer geo = null;
        Integer human = null;
        Integer mining = null;

        if (signalsNode != null && signalsNode.isArray()) {
            for (JsonNode sig : signalsNode) {
                String type = sig.path("Type").asText("");
                String typeLoc = sig.path("Type_Localised").asText("");
                int count = sig.path("Count").asInt(0);

                if (type.toLowerCase().contains("bio")) {
                    bio = count;
                } else if (type.toLowerCase().contains("geo")) {
                    geo = count;
                } else if (type.toLowerCase().contains("human")) {
                    human = count;
                } else if (type.toLowerCase().contains("mining") || typeLoc.toLowerCase().contains("minera")) {
                    mining = count;
                }
            }
        }
        recordDssSignalCounts(bodyName, bio, geo, human, mining);
        log.info("🗺️ [DSS SIGNALS] {} -> Bio={}, Mineração={}, Geo={}, Human={}", bodyName, bio, mining, geo, human);
    }

    public List<SurfaceFeatureDTO> getFeaturesForBody(String systemName, String bodyName) {
        List<SurfaceFeatureDTO> result = new ArrayList<>();
        if (bodyName == null || bodyName.isBlank()) return result;

        String bodyKey = cleanKey(bodyName);

        // 1. POIs Lendários conhecidos
        if (legendarySites.containsKey(bodyKey)) {
            result.addAll(legendarySites.get(bodyKey));
        }

        // 2. Elementos registrados em tempo real pelo Journal
        if (featuresByBody.containsKey(bodyKey)) {
            for (SurfaceFeatureDTO f : featuresByBody.get(bodyKey)) {
                if (result.stream().noneMatch(existing -> existing.getName().equalsIgnoreCase(f.getName()))) {
                    result.add(f);
                }
            }
        }

        // 3. Consulta EDSM para colônias de superfície do sistema se ainda não estiver no cache
        if (systemName != null && !systemName.isBlank()) {
            fetchSystemSurfaceSettlements(systemName, bodyName, result);
        }

        return result;
    }

    private void fetchSystemSurfaceSettlements(String systemName, String bodyName, List<SurfaceFeatureDTO> targetList) {
        String sysKey = systemName.toLowerCase().trim();
        List<SurfaceFeatureDTO> sysFeatures = systemStationsCache.get(sysKey);

        if (sysFeatures == null) {
            sysFeatures = new ArrayList<>();
            try {
                String url = "https://www.edsm.net/api-system-v1/stations?systemName=" + java.net.URLEncoder.encode(systemName, java.nio.charset.StandardCharsets.UTF_8);
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(5))
                        .header("User-Agent", "EliteDangerous-ExplorerHUD/1.0")
                        .GET()
                        .build();

                HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() == 200) {
                    JsonNode root = objectMapper.readTree(resp.body());
                    JsonNode stArray = root.path("stations");
                    if (stArray.isArray()) {
                        for (JsonNode s : stArray) {
                            String type = s.path("type").asText("");
                            if (type == null || type.isBlank()) continue;
                            String typeLower = type.toLowerCase();

                            // Filtra apenas estações planetárias e assentamentos de superfície
                            if (typeLower.contains("planetary") || typeLower.contains("settlement") || typeLower.contains("surface") || typeLower.contains("outpost")) {
                                String name = s.path("name").asText();
                                String bName = s.path("body").path("name").asText("");
                                String bodyRef = (!bName.isBlank()) ? bName : bodyName;

                                if (!s.has("latitude") || !s.has("longitude")) {
                                    continue;
                                }
                                double lat = s.path("latitude").asDouble();
                                double lon = s.path("longitude").asDouble();

                                String featureType = "SETTLEMENT";
                                String subType = type;
                                String combined = (name + " " + type).toLowerCase();
                                if (combined.contains("extract") || combined.contains("mining") || combined.contains("mine") || combined.contains("claim")) {
                                    featureType = "EXTRACTION";
                                    subType = "Extração Mineral";
                                } else if (combined.contains("crash") || combined.contains("wreck") || combined.contains("debris")) {
                                    featureType = "CRASH_SITE";
                                    subType = "Destroços";
                                } else if (combined.contains("distress") || combined.contains("emergency")) {
                                    featureType = "DISTRESS_BEACON";
                                    subType = "Sinal de Socorro";
                                } else if (combined.contains("research") || combined.contains("bio") || combined.contains("lab") || combined.contains("science")) {
                                    featureType = "RESEARCH";
                                    subType = "Laboratório Pesquisa";
                                } else if (combined.contains("agri") || combined.contains("farm") || combined.contains("hydro")) {
                                    featureType = "AGRICULTURE";
                                    subType = "Agrícola";
                                } else if (combined.contains("milit") || combined.contains("garrison") || combined.contains("defense")) {
                                    featureType = "MILITARY";
                                    subType = "Militar";
                                } else if (typeLower.contains("port") || typeLower.contains("outpost")) {
                                    featureType = "PORT";
                                    subType = "Porto Planetário";
                                }
                                String desc = "Instalação de Superfície (" + subType + ")";

                                SurfaceFeatureDTO sf = new SurfaceFeatureDTO(
                                        "edsm-" + s.path("id").asText(UUID.randomUUID().toString()),
                                        name,
                                        featureType,
                                        subType,
                                        lat,
                                        lon,
                                        bodyRef,
                                        desc
                                );
                                sysFeatures.add(sf);
                            }
                        }
                    }
                    systemStationsCache.put(sysKey, sysFeatures);
                }
            } catch (Exception e) {
                log.warn("EDSM settlement lookup silencioso para {}: {}", systemName, e.getMessage());
            }
        }

        // Filtra para o bodyName atual
        for (SurfaceFeatureDTO sf : sysFeatures) {
            if (sf.getBodyName().equalsIgnoreCase(bodyName) || sf.getBodyName().isBlank()) {
                if (targetList.stream().noneMatch(existing -> existing.getName().equalsIgnoreCase(sf.getName()))) {
                    targetList.add(sf);
                }
            }
        }
    }

    private String cleanKey(String str) {
        if (str == null) return "";
        return str.toLowerCase().replaceAll("\\s+", " ").trim();
    }
}
