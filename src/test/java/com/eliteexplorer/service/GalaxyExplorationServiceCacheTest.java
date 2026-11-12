package com.eliteexplorer.service;

import com.eliteexplorer.dto.StarSystemDTO;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GalaxyExplorationServiceCacheTest {

    @TempDir
    Path tempDir;

    @Test
    void persistsAndReloadsCubeCacheFromDiskAcrossRestarts() {
        File cacheDir = tempDir.resolve("cubes").toFile();
        PlanetExplorationHistoryService historyService = new PlanetExplorationHistoryService();

        GalaxyExplorationService writer = new GalaxyExplorationService(historyService);
        writer.setCubeCacheDirForTest(cacheDir);

        StarSystemDTO s1 = new StarSystemDTO("Synuefe OF-L d9-72", 305.15625, -42.65625, -231.25, 0.0, 12);
        s1.setStarType("F (White) Star");
        s1.setIsScoopable(true);
        StarSystemDTO s2 = new StarSystemDTO("Synuefe BQ-W c18-5", 301.78125, -38.46875, -232.6875, 5.56, 8);

        GalaxyExplorationService.CacheEntry entry = new GalaxyExplorationService.CacheEntry(
                305.16, -42.66, -231.25, 100.0, List.of(s1, s2));

        writer.saveCubeCacheEntryToDisk("305_-43_-231_100", entry);

        File persisted = new File(cacheDir, "305_-43_-231_100.json");
        assertTrue(persisted.exists() && persisted.length() > 0, "Cube JSON file should exist on disk");

        // Simula reinicialização do servidor com nova instância de serviço
        GalaxyExplorationService reader = new GalaxyExplorationService(historyService);
        reader.setCubeCacheDirForTest(cacheDir);
        reader.loadCubeCacheFromDisk();

        GalaxyExplorationService.CacheEntry hit = reader.findClosestCoveringEntry(306.0, -42.0, -231.0, 35.0, false);
        assertNotNull(hit, "Reloaded disk cache should cover nearby coordinates");
        assertEquals(2, hit.getSystems().size());
        assertEquals("Synuefe OF-L d9-72", hit.getSystems().get(0).getName());
    }

    @Test
    void deserializesStarSystemDtoWithComputedStratumFlags() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        String json = "{\"synuefe of-l d9-72\":{\"name\":\"Synuefe OF-L d9-72\",\"x\":305.15625,\"y\":-42.65625,\"z\":-231.25,\"distance\":0.0,\"bodyCount\":null,\"coordsLocked\":false,\"starType\":\"\",\"isScoopable\":null,\"population\":0,\"inhabited\":false,\"stratumCandidates\":[],\"hasStratumCandidate\":false,\"hasStratumConfirmed\":false}}";

        Map<String, StarSystemDTO> parsed = mapper.readValue(json, new TypeReference<Map<String, StarSystemDTO>>() {});
        assertTrue(parsed.containsKey("synuefe of-l d9-72"));
        assertEquals("Synuefe OF-L d9-72", parsed.get("synuefe of-l d9-72").getName());
    }
}
