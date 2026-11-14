package com.eliteexplorer.service;

import com.eliteexplorer.dto.CelestialBodyDTO;
import com.eliteexplorer.dto.CelestialBodyDTO.BodyRingDTO;
import com.eliteexplorer.dto.SystemOrreryDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SystemBodiesService {

    private static final Logger log = LoggerFactory.getLogger(SystemBodiesService.class);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    private final SseNotificationService sseNotificationService;

    // Cache em memória: sistema (lowercase) -> SystemOrreryDTO
    private final Map<String, SystemOrreryDTO> orreryCache = new ConcurrentHashMap<>();
    private final File cacheDir = new File("cache/systems");
    private final CopilotDatabaseService databaseService;

    @Autowired
    public SystemBodiesService(SseNotificationService sseNotificationService, CopilotDatabaseService databaseService) {
        this.sseNotificationService = sseNotificationService;
        this.databaseService = databaseService;
        if (!cacheDir.exists()) {
            cacheDir.mkdirs();
        }
    }

    public boolean hasSystemData(String systemName) {
        if (systemName == null || systemName.isBlank()) return false;
        String key = systemName.toLowerCase().trim();
        if (orreryCache.containsKey(key)) {
            SystemOrreryDTO dto = orreryCache.get(key);
            return dto != null && dto.getBodies() != null && !dto.getBodies().isEmpty();
        }
        if (databaseService != null) {
            String json = databaseService.getSystemBodiesJson(key);
            if (json != null && !json.isBlank()) return true;
        }
        File f = new File(cacheDir, sanitizeFilename(key) + ".json");
        return f.exists() && f.length() > 0;
    }

    public synchronized void recordPrimaryStar(String systemName, long systemAddress, String starClass, Double posX, Double posY, Double posZ) {
        if (systemName == null || systemName.isBlank()) return;
        String key = systemName.toLowerCase().trim();
        SystemOrreryDTO dto = orreryCache.computeIfAbsent(key, k -> {
            SystemOrreryDTO fromDisk = loadFromDisk(k);
            return fromDisk != null ? fromDisk : new SystemOrreryDTO(systemName, systemAddress, posX, posY, posZ, starClass != null && !starClass.isBlank() ? starClass : "K");
        });

        dto.setSystemName(systemName);
        if (systemAddress > 0) dto.setSystemAddress(systemAddress);
        if (posX != null) dto.setPosX(posX);
        if (posY != null) dto.setPosY(posY);
        if (posZ != null) dto.setPosZ(posZ);
        if (starClass != null && !starClass.isBlank()) dto.setPrimaryStarClass(starClass);

        boolean hasStar = dto.getBodies().stream().anyMatch(b -> (b.getBodyId() != null && b.getBodyId() == 0) || "Star".equalsIgnoreCase(b.getType()));
        if (!hasStar) {
            CelestialBodyDTO star = new CelestialBodyDTO();
            star.setBodyId(0);
            star.setName(systemName);
            star.setType("Star");
            star.setSubType(starClass != null && !starClass.isBlank() ? starClass : "K (Orange) Star");
            star.setSpectralClass(starClass != null && !starClass.isBlank() ? starClass : "K");
            star.setIsMainStar(true);
            star.setSolarRadius(1.0);
            star.setSolarMasses(1.0);
            star.setDistanceToArrival(0.0);
            dto.getBodies().add(0, star);
            dto.setTotalBodies(dto.getBodies().size());
            saveToDisk(key, dto);
            log.info("⭐ [ORRERY] Estrela principal registrada para {}: {}", systemName, star.getSubType());
        }
    }

    public SystemOrreryDTO getSystemOrrery(String systemName, Double posX, Double posY, Double posZ) {
        if (systemName == null || systemName.isBlank()) {
            return new SystemOrreryDTO("Desconhecido", null, 0.0, 0.0, 0.0, "K");
        }

        String key = systemName.toLowerCase().trim();
        SystemOrreryDTO cached = orreryCache.get(key);
        if (cached != null && cached.getBodies() != null && !cached.getBodies().isEmpty()) {
            ensureMainStar(cached, systemName);
            return cached;
        }

        // Tenta carregar do cache em disco
        SystemOrreryDTO fromDisk = loadFromDisk(key);
        if (fromDisk != null && fromDisk.getBodies() != null && !fromDisk.getBodies().isEmpty()) {
            ensureMainStar(fromDisk, systemName);
            orreryCache.put(key, fromDisk);
            return fromDisk;
        }

        // Consulta EDSM API
        SystemOrreryDTO fetched = fetchFromEdsm(systemName, posX, posY, posZ);
        if (fetched != null) {
            ensureMainStar(fetched, systemName);
            orreryCache.put(key, fetched);
            saveToDisk(key, fetched);
            return fetched;
        }

        // Fallback: objeto com estrela principal caso não encontre no EDSM
        SystemOrreryDTO empty = new SystemOrreryDTO(systemName, null, posX, posY, posZ, "K");
        ensureMainStar(empty, systemName);
        orreryCache.put(key, empty);
        return empty;
    }

    /**
     * Busca metadados físicos de um corpo celeste apenas no cache local (memória ou disco).
     */
    public CelestialBodyDTO findBody(String systemName, String bodyName) {
        if (systemName == null || systemName.isBlank() || bodyName == null || bodyName.isBlank()) {
            return null;
        }
        String key = systemName.toLowerCase().trim();
        SystemOrreryDTO dto = orreryCache.get(key);
        if (dto == null) {
            dto = loadFromDisk(key);
            if (dto != null) {
                orreryCache.put(key, dto);
            }
        }
        if (dto == null || dto.getBodies() == null) {
            return null;
        }
        return dto.getBodies().stream()
                .filter(b -> bodyName.equalsIgnoreCase(b.getName()))
                .findFirst()
                .orElse(null);
    }

    private void ensureMainStar(SystemOrreryDTO dto, String systemName) {
        if (dto == null) return;
        boolean hasStar = dto.getBodies().stream().anyMatch(b -> (b.getBodyId() != null && b.getBodyId() == 0) || "Star".equalsIgnoreCase(b.getType()));
        if (!hasStar) {
            CelestialBodyDTO star = new CelestialBodyDTO();
            star.setBodyId(0);
            star.setName(systemName);
            star.setType("Star");
            star.setSubType(dto.getPrimaryStarClass() != null ? dto.getPrimaryStarClass() : "K (Orange) Star");
            star.setSpectralClass(dto.getPrimaryStarClass() != null ? dto.getPrimaryStarClass() : "K");
            star.setIsMainStar(true);
            star.setSolarRadius(1.0);
            star.setSolarMasses(1.0);
            star.setDistanceToArrival(0.0);
            dto.getBodies().add(0, star);
            dto.setTotalBodies(dto.getBodies().size());
        }
    }

    private SystemOrreryDTO fetchFromEdsm(String systemName, Double posX, Double posY, Double posZ) {
        try {
            String url = "https://www.edsm.net/api-system-v1/bodies?systemName=" + URLEncoder.encode(systemName, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("User-Agent", "EliteDangerous-SystemOrrery/1.0")
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(resp.body());
                if (root.has("name") && root.has("bodies")) {
                    String sysName = root.path("name").asText(systemName);
                    Long sysId64 = root.path("id64").asLong(0L);
                    JsonNode bodiesArray = root.path("bodies");

                    SystemOrreryDTO dto = new SystemOrreryDTO(sysName, sysId64 > 0 ? sysId64 : null, posX, posY, posZ, null);
                    List<CelestialBodyDTO> bodiesList = new ArrayList<>();

                    if (bodiesArray.isArray()) {
                        for (JsonNode b : bodiesArray) {
                            CelestialBodyDTO body = parseEdsmBody(b);
                            if (body != null) {
                                if (body.getIsMainStar() != null && body.getIsMainStar() && dto.getPrimaryStarClass() == null) {
                                    dto.setPrimaryStarClass(body.getSpectralClass() != null ? body.getSpectralClass() : body.getSubType());
                                }
                                bodiesList.add(body);
                            }
                        }
                    }

                    // Se não tiver estrela principal definida, pega a primeira estrela
                    if (dto.getPrimaryStarClass() == null) {
                        for (CelestialBodyDTO b : bodiesList) {
                            if ("Star".equalsIgnoreCase(b.getType())) {
                                dto.setPrimaryStarClass(b.getSpectralClass() != null ? b.getSpectralClass() : b.getSubType());
                                break;
                            }
                        }
                    }

                    dto.setBodies(bodiesList);
                    log.info("🪐 [ORRERY EDSM] Sistema {} carregado com sucesso: {} corpos celestes encontrados.", sysName, bodiesList.size());
                    return dto;
                }
            } else {
                log.warn("EDSM retornou HTTP {} ao buscar corpos de {}", resp.statusCode(), systemName);
            }
        } catch (Exception e) {
            log.error("Erro ao consultar corpos celestes do sistema {} no EDSM: {}", systemName, e.getMessage());
        }
        return null;
    }

    private CelestialBodyDTO parseEdsmBody(JsonNode b) {
        try {
            CelestialBodyDTO dto = new CelestialBodyDTO();
            dto.setId64(b.path("id64").asLong(0L));
            dto.setBodyId(b.path("bodyId").asInt(0));
            dto.setName(b.path("name").asText(""));
            dto.setType(b.path("type").asText("Planet"));
            dto.setSubType(b.path("subType").asText(""));
            dto.setDistanceToArrival(b.path("distanceToArrival").asDouble(0.0));
            dto.setIsLandable(b.path("isLandable").asBoolean(false));
            dto.setGravity(b.path("gravity").asDouble(0.0));
            dto.setRadius(b.path("radius").asDouble(0.0));
            dto.setEarthMasses(b.path("earthMasses").asDouble(0.0));
            dto.setSurfaceTemperature(b.path("surfaceTemperature").asDouble(0.0));
            if (b.has("surfacePressure") && !b.path("surfacePressure").isNull()) {
                dto.setSurfacePressure(b.path("surfacePressure").asDouble(0.0));
            }
            dto.setAtmosphereType(b.path("atmosphereType").asText(""));
            dto.setVolcanismType(b.path("volcanismType").asText(""));
            dto.setTerraformingState(b.path("terraformingState").asText(""));

            // Parâmetros Orbitais
            double sma = b.path("semiMajorAxis").asDouble(0.0);
            dto.setSemiMajorAxis(sma);
            dto.setSemiMajorAxisAu(sma); // EDSM fornece em AU para planetas
            dto.setOrbitalEccentricity(b.path("orbitalEccentricity").asDouble(0.0));
            dto.setOrbitalInclination(b.path("orbitalInclination").asDouble(0.0));
            dto.setArgOfPeriapsis(b.path("argOfPeriapsis").asDouble(0.0));
            dto.setOrbitalPeriod(b.path("orbitalPeriod").asDouble(0.0));
            if (b.has("ascendingNode")) dto.setAscendingNode(b.path("ascendingNode").asDouble(0.0));
            if (b.has("meanAnomaly")) dto.setMeanAnomaly(b.path("meanAnomaly").asDouble(0.0));
            if (b.has("updateTime") && !b.path("updateTime").asText("").isBlank()) {
                try {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(java.time.ZoneOffset.UTC);
                    dto.setScanTimeMs(java.time.Instant.from(dtf.parse(b.path("updateTime").asText())).toEpochMilli());
                } catch (Exception e) {
                    log.debug("Ignorando updateTime inválido no EDSM para {}: {}", dto.getName(), e.getMessage());
                }
            }
            dto.setRotationalPeriod(b.path("rotationalPeriod").asDouble(0.0));
            dto.setRotationalPeriodTidallyLocked(b.path("rotationalPeriodTidallyLocked").asBoolean(false));
            dto.setAxialTilt(b.path("axialTilt").asDouble(0.0));

            // Hierarquia de Pais (Parents)
            JsonNode parents = b.path("parents");
            if (parents.isArray() && !parents.isEmpty()) {
                JsonNode firstParent = parents.get(0);
                Iterator<String> fieldNames = firstParent.fieldNames();
                if (fieldNames.hasNext()) {
                    String pType = fieldNames.next();
                    dto.setParentType(pType);
                    dto.setParentId(firstParent.path(pType).asInt(0));
                }
            }

            // Propriedades Estelares
            if ("Star".equalsIgnoreCase(dto.getType())) {
                dto.setIsMainStar(b.path("isMainStar").asBoolean(false));
                dto.setSpectralClass(b.path("spectralClass").asText(""));
                dto.setLuminosity(b.path("luminosity").asText(""));
                dto.setAbsoluteMagnitude(b.path("absoluteMagnitude").asDouble(0.0));
                dto.setSolarMasses(b.path("solarMasses").asDouble(1.0));
                dto.setSolarRadius(b.path("solarRadius").asDouble(1.0));
                dto.setIsScoopable(b.path("isScoopable").asBoolean(false));
            }

            // Anéis e Cinturões de Asteroides
            JsonNode ringsNode = b.path("rings");
            if (ringsNode.isArray()) {
                List<BodyRingDTO> rings = new ArrayList<>();
                for (JsonNode r : ringsNode) {
                    rings.add(new BodyRingDTO(
                            r.path("name").asText(""),
                            r.path("type").asText("Rocky"),
                            r.path("mass").asDouble(0.0),
                            r.path("innerRadius").asDouble(0.0),
                            r.path("outerRadius").asDouble(0.0)
                    ));
                }
                dto.setRings(rings);
            }

            JsonNode beltsNode = b.path("belts");
            if (beltsNode.isArray()) {
                List<BodyRingDTO> belts = new ArrayList<>();
                for (JsonNode belt : beltsNode) {
                    belts.add(new BodyRingDTO(
                            belt.path("name").asText(""),
                            belt.path("type").asText("Rocky"),
                            belt.path("mass").asDouble(0.0),
                            belt.path("innerRadius").asDouble(0.0),
                            belt.path("outerRadius").asDouble(0.0)
                    ));
                }
                dto.setBelts(belts);
            }

            // Materiais de Superfície
            JsonNode mats = b.path("materials");
            if (mats.isObject()) {
                Map<String, Double> matMap = new HashMap<>();
                Iterator<Map.Entry<String, JsonNode>> fields = mats.fields();
                while (fields.hasNext()) {
                    Map.Entry<String, JsonNode> entry = fields.next();
                    matMap.put(entry.getKey(), entry.getValue().asDouble(0.0));
                }
                dto.setMaterials(matMap);
            }

            // Descoberta
            JsonNode disc = b.path("discovery");
            if (disc.isObject() && disc.has("commander") && !disc.path("commander").asText("").isBlank()) {
                dto.setWasDiscovered(true);
            } else {
                dto.setWasDiscovered(false);
            }

            return dto;
        } catch (Exception e) {
            log.warn("Erro ao fazer parse de corpo celeste: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Intercepta evento 'Scan' direto do Journal do jogador em tempo real.
     */
    public synchronized void recordJournalScan(JsonNode root) {
        try {
            String starSystem = root.path("StarSystem").asText("");
            if (starSystem.isBlank()) return;

            String bodyName = root.path("BodyName").asText("");
            int bodyId = root.path("BodyID").asInt(-1);
            if (bodyName.isBlank() || bodyId < 0) return;

            String key = starSystem.toLowerCase().trim();
            SystemOrreryDTO dto = orreryCache.computeIfAbsent(key, k -> new SystemOrreryDTO(starSystem, root.path("SystemAddress").asLong(0L), 0.0, 0.0, 0.0, "K"));

            // Procura se já existe esse corpo no DTO
            CelestialBodyDTO body = dto.getBodies().stream()
                    .filter(b -> (b.getBodyId() != null && b.getBodyId() == bodyId) || bodyName.equalsIgnoreCase(b.getName()))
                    .findFirst()
                    .orElse(null);

            if (body == null) {
                body = new CelestialBodyDTO();
                body.setBodyId(bodyId);
                body.setName(bodyName);
                dto.getBodies().add(body);
                dto.setTotalBodies(dto.getBodies().size());
            }

            body.setId64(root.path("ID").asLong(body.getId64() != null ? body.getId64() : 0L));
            if (root.has("StarType")) {
                body.setType("Star");
                body.setSubType(root.path("StarType").asText(""));
                body.setSpectralClass(root.path("StarType").asText(""));
                if (bodyId == 0 || root.path("DistanceFromArrivalLS").asDouble(0.0) <= 0.1) {
                    body.setIsMainStar(true);
                    dto.setPrimaryStarClass(body.getSpectralClass());
                }
                if (root.has("StellarMass")) body.setSolarMasses(root.path("StellarMass").asDouble());
                if (root.has("Radius")) body.setSolarRadius(root.path("Radius").asDouble() / 696340000.0);
            } else if (root.has("PlanetClass")) {
                body.setType("Planet");
                body.setSubType(root.path("PlanetClass").asText(""));
                if (root.has("Landable")) body.setIsLandable(root.path("Landable").asBoolean());
                if (root.has("SurfaceGravity")) body.setGravity(root.path("SurfaceGravity").asDouble() / 9.80665); // m/s² -> G
                if (root.has("Radius")) body.setRadius(root.path("Radius").asDouble() / 1000.0); // m -> km
                if (root.has("MassEM")) body.setEarthMasses(root.path("MassEM").asDouble());
                if (root.has("Atmosphere")) body.setAtmosphereType(root.path("Atmosphere").asText());
                if (root.has("SurfacePressure")) body.setSurfacePressure(root.path("SurfacePressure").asDouble() / 101325.0); // Pa -> atm
                if (root.has("Volcanism")) body.setVolcanismType(root.path("Volcanism").asText());
                if (root.has("TerraformState")) body.setTerraformingState(root.path("TerraformState").asText());
            }

            if (root.has("SurfaceTemperature")) body.setSurfaceTemperature(root.path("SurfaceTemperature").asDouble());
            if (root.has("DistanceFromArrivalLS")) body.setDistanceToArrival(root.path("DistanceFromArrivalLS").asDouble());

            // Parâmetros Orbitais (Journal fornece SemiMajorAxis em metros e OrbitalPeriod em segundos)
            if (root.has("SemiMajorAxis")) {
                double smaMeters = root.path("SemiMajorAxis").asDouble();
                body.setSemiMajorAxis(smaMeters);
                body.setSemiMajorAxisAu(smaMeters / 149597870700.0); // metros -> AU
            }
            if (root.has("Eccentricity")) body.setOrbitalEccentricity(root.path("Eccentricity").asDouble());
            if (root.has("OrbitalInclination")) body.setOrbitalInclination(root.path("OrbitalInclination").asDouble());
            if (root.has("Periapsis")) body.setArgOfPeriapsis(root.path("Periapsis").asDouble());
            if (root.has("AscendingNode")) body.setAscendingNode(root.path("AscendingNode").asDouble());
            if (root.has("MeanAnomaly")) body.setMeanAnomaly(root.path("MeanAnomaly").asDouble());
            if (root.has("timestamp") && !root.path("timestamp").asText("").isBlank()) {
                try {
                    java.time.Instant inst = java.time.Instant.parse(root.path("timestamp").asText());
                    body.setScanTimeMs(inst.toEpochMilli());
                } catch (Exception e) {
                    log.debug("Ignorando timestamp inválido no Scan para {}: {}", body.getName(), e.getMessage());
                }
            }
            if (root.has("OrbitalPeriod")) body.setOrbitalPeriod(root.path("OrbitalPeriod").asDouble() / 86400.0); // seg -> dias
            if (root.has("RotationPeriod")) body.setRotationalPeriod(root.path("RotationPeriod").asDouble() / 86400.0);
            if (root.has("AxialTilt")) body.setAxialTilt(Math.toDegrees(root.path("AxialTilt").asDouble()));

            // Pais
            JsonNode parents = root.path("Parents");
            if (parents.isArray() && !parents.isEmpty()) {
                JsonNode firstParent = parents.get(0);
                Iterator<String> it = firstParent.fieldNames();
                if (it.hasNext()) {
                    String pType = it.next();
                    body.setParentType(pType);
                    body.setParentId(firstParent.path(pType).asInt(0));
                }
            }

            // Anéis
            if (root.has("Rings") && root.path("Rings").isArray()) {
                List<BodyRingDTO> rings = new ArrayList<>();
                for (JsonNode r : root.path("Rings")) {
                    rings.add(new BodyRingDTO(
                            r.path("Name").asText(""),
                            r.path("RingClass").asText("Rocky").replace("eRingClass_", ""),
                            r.path("MassMT").asDouble(0.0),
                            r.path("InnerRad").asDouble(0.0) / 1000.0,
                            r.path("OuterRad").asDouble(0.0) / 1000.0
                    ));
                }
                body.setRings(rings);
            }

            if (root.has("WasDiscovered")) body.setWasDiscovered(root.path("WasDiscovered").asBoolean());
            if (root.has("WasMapped")) body.setWasMapped(root.path("WasMapped").asBoolean());

            ensureMainStar(dto, starSystem);
            dto.setLastUpdated(System.currentTimeMillis());
            saveToDisk(key, dto);
            log.info("🪐 [JOURNAL SCAN] Escaneado {} [{}] em {} (Total corpos: {})", bodyName, body.getType(), starSystem, dto.getBodies().size());

            // Notificação em tempo real via SSE para navegadores com o Orrery aberto
            Map<String, Object> scanData = new LinkedHashMap<>();
            scanData.put("system", starSystem);
            scanData.put("body", bodyName);
            scanData.put("bodyId", bodyId);
            scanData.put("type", body.getType());
            scanData.put("total", dto.getBodies().size());
            sseNotificationService.broadcastEvent("system_body_scanned", scanData);
        } catch (Exception e) {
            log.error("Erro ao processar Scan do Journal: {}", e.getMessage());
        }
    }

    /**
     * Atualiza contagem de sinais DSS / FSS
     */
    public synchronized void recordSignals(String systemName, String bodyName, Integer bio, Integer geo, Integer human) {
        if (systemName == null || bodyName == null) return;
        String key = systemName.toLowerCase().trim();
        SystemOrreryDTO dto = orreryCache.get(key);
        if (dto != null) {
            for (CelestialBodyDTO b : dto.getBodies()) {
                if (bodyName.equalsIgnoreCase(b.getName())) {
                    if (bio != null) b.setBioSignalsCount(bio);
                    if (geo != null) b.setGeoSignalsCount(geo);
                    if (human != null) b.setHumanSignalsCount(human);
                    saveToDisk(key, dto);
                    break;
                }
            }
        }
    }

    private SystemOrreryDTO loadFromDisk(String key) {
        if (databaseService != null) {
            String json = databaseService.getSystemBodiesJson(key);
            if (json != null && !json.isBlank()) {
                try {
                    return objectMapper.readValue(json, SystemOrreryDTO.class);
                } catch (Exception ignored) {}
            }
        }
        try {
            File f = new File(cacheDir, sanitizeFilename(key) + ".json");
            if (f.exists() && f.length() > 0) {
                return objectMapper.readValue(f, SystemOrreryDTO.class);
            }
        } catch (Exception e) {
            log.debug("Cache miss em disco para {}: {}", key, e.getMessage());
        }
        return null;
    }

    private void saveToDisk(String key, SystemOrreryDTO dto) {
        if (databaseService != null && dto != null) {
            try {
                databaseService.saveSystemBodiesJson(key, objectMapper.writeValueAsString(dto));
            } catch (Exception e) {
                log.debug("Erro ao gravar corpos de {} no SQLite: {}", key, e.getMessage());
            }
        }
    }

    private String sanitizeFilename(String name) {
        return name.replaceAll("[^a-zA-Z0-9.-]", "_");
    }
}
