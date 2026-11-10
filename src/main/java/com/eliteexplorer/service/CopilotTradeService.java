package com.eliteexplorer.service;

import com.eliteexplorer.dto.CopilotSearchResult;
import com.eliteexplorer.dto.OutboundTradeDTO;
import com.eliteexplorer.dto.TradeLegDTO;
import com.eliteexplorer.dto.TradeRouteDTO;
import com.eliteexplorer.model.PlayerStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.util.*;

@Service
public class CopilotTradeService {

    private static final Logger log = LoggerFactory.getLogger(CopilotTradeService.class);
    private static final NumberFormat NUMBER_FORMAT = NumberFormat.getInstance(Locale.US);

    private final InaraClientService inaraClientService;
    private final InaraParserService parserService;
    private final JournalWatcherService journalWatcherService;

    public CopilotTradeService(InaraClientService inaraClientService,
                               InaraParserService parserService,
                               JournalWatcherService journalWatcherService) {
        this.inaraClientService = inaraClientService;
        this.parserService = parserService;
        this.journalWatcherService = journalWatcherService;
    }

    public CopilotSearchResult getOutboundTrades(String system, Integer cargoCapacity, Integer maxDistance,
                                                 Integer maxAgeHours, Integer padSize, String sortBy) {
        PlayerStatus playerStatus = journalWatcherService.getPlayerStatus();

        String targetSystem = (system != null && !system.isBlank()) ? system.trim() : playerStatus.getCurrentSystem();
        int targetCargo = (cargoCapacity != null && cargoCapacity > 0) ? cargoCapacity : playerStatus.getCargoCapacity();
        int maxDist = (maxDistance != null && maxDistance > 0) ? maxDistance : 80;
        int maxAge = (maxAgeHours != null && maxAgeHours > 0) ? maxAgeHours : 72;
        int pad = (padSize != null && padSize > 0) ? padSize : 1;

        log.info("Buscando cotações de IDA para sistema '{}', carga: {}T, distMáx: {}Ly", targetSystem, targetCargo, maxDist);

        // Montar URL Inara com pi1=3 (ordenar por proximidade ao sistema de origem)
        String encodedSystem = URLEncoder.encode(targetSystem, StandardCharsets.UTF_8);
        String inaraUrl = String.format(
                "https://inara.cz/elite/market-traderoutes/?ps1=%s&pi10=%d&pi2=%d&pi5=%d&pi3=%d&pi9=0&pi4=0&pi7=0&pi12=0&pi8=1&pi14=0&pi15=0&pi1=3",
                encodedSystem, targetCargo, maxDist, maxAge, pad
        );

        try {
            // Fazer busca no Inara
            // Usar o método de fetch do InaraClientService chamando com URL dinâmica
            String html = fetchInaraHtml(inaraUrl);
            if (html == null || html.isBlank()) {
                return CopilotSearchResult.failure("Resposta vazia ao consultar o Inara.", playerStatus, targetSystem);
            }

            List<TradeRouteDTO> allRoutes = parserService.parseTradeRoutes(html);
            log.info("Total de rotas brutas retornadas pelo Inara: {}", allRoutes.size());

            // Se poucas ou nenhuma rota foi encontrada com pi1=3, tentar também pi1=0 (melhor lucro galáctico)
            if (allRoutes.isEmpty()) {
                String fallbackUrl = inaraUrl.replace("pi1=3", "pi1=0");
                html = fetchInaraHtml(fallbackUrl);
                if (html != null && !html.isBlank()) {
                    allRoutes = parserService.parseTradeRoutes(html);
                }
            }

            // Filtrar apenas pernas onde o sistema atual é a ORIGEM
            List<OutboundTradeDTO> outboundTrades = extractOutboundTrades(allRoutes, targetSystem, targetCargo);

            // Ordenação: padrão por maior lucro e depois por menor distância
            sortTrades(outboundTrades, sortBy);

            return CopilotSearchResult.success(playerStatus, targetSystem, targetCargo, inaraUrl, outboundTrades);
        } catch (Exception e) {
            log.error("Erro ao buscar cotações de ida: {}", e.getMessage(), e);
            return CopilotSearchResult.failure("Erro ao consultar Inara: " + e.getMessage(), playerStatus, targetSystem);
        }
    }

    private List<OutboundTradeDTO> extractOutboundTrades(List<TradeRouteDTO> routes, String currentSystem, int cargo) {
        Map<String, OutboundTradeDTO> uniqueMap = new LinkedHashMap<>();
        String normalizedCurrent = currentSystem.trim().toLowerCase();

        for (TradeRouteDTO r : routes) {
            String srcSys = r.getSourceSystem() != null ? r.getSourceSystem().trim().toLowerCase() : "";
            String tgtSys = r.getTargetSystem() != null ? r.getTargetSystem().trim().toLowerCase() : "";

            // Caso 1: Origem da rota corresponde ao sistema atual
            if (srcSys.equalsIgnoreCase(normalizedCurrent) || srcSys.contains(normalizedCurrent) || normalizedCurrent.contains(srcSys)) {
                OutboundTradeDTO dto = buildFromOutbound(r, cargo);
                if (dto != null && dto.getProfitPerUnit() > 0) {
                    String key = dto.getCommodity() + "_" + dto.getDestStation() + "_" + dto.getDestSystem();
                    uniqueMap.putIfAbsent(key, dto);
                }
            }

            // Caso 2: Se a volta da rota partir do sistema atual (destino da rota = sistema atual)
            if (tgtSys.equalsIgnoreCase(normalizedCurrent) || tgtSys.contains(normalizedCurrent) || normalizedCurrent.contains(tgtSys)) {
                OutboundTradeDTO dto = buildFromInbound(r, cargo);
                if (dto != null && dto.getProfitPerUnit() > 0) {
                    String key = dto.getCommodity() + "_" + dto.getDestStation() + "_" + dto.getDestSystem();
                    uniqueMap.putIfAbsent(key, dto);
                }
            }
        }

        return new ArrayList<>(uniqueMap.values());
    }

    private OutboundTradeDTO buildFromOutbound(TradeRouteDTO route, int cargo) {
        TradeLegDTO leg = route.getOutbound();
        if (leg == null || leg.getCommodity() == null || leg.getCommodity().isBlank()) {
            return null;
        }

        OutboundTradeDTO dto = new OutboundTradeDTO();
        dto.setCommodity(leg.getCommodity());
        dto.setOriginStation(route.getSourceStation());
        dto.setOriginSystem(route.getSourceSystem());
        dto.setOriginDistance(route.getSourceDistance());

        dto.setDestStation(route.getTargetStation());
        dto.setDestSystem(route.getTargetSystem());
        dto.setDestDistance(route.getTargetDistance());

        dto.setBuyPrice(leg.getBuyPrice());
        dto.setSupply(leg.getSupply());
        dto.setSellPrice(leg.getSellPrice());
        dto.setDemand(leg.getDemand());

        long profitUnit = extractProfitUnit(leg.getProfitDelta(), leg.getSellPrice(), leg.getBuyPrice());
        dto.setProfitPerUnit(profitUnit);
        dto.setProfitTotalTrip(profitUnit * cargo);

        dto.setProfitPerUnitFormatted(formatCredits(profitUnit));
        dto.setProfitTotalTripFormatted(formatCredits(dto.getProfitTotalTrip()));

        dto.setRouteDistance(route.getRouteDistance());
        dto.setRouteDistanceNumeric(route.getRouteDistanceNumeric());
        dto.setUpdated(route.getUpdated());

        return dto;
    }

    private OutboundTradeDTO buildFromInbound(TradeRouteDTO route, int cargo) {
        TradeLegDTO leg = route.getInbound();
        if (leg == null || leg.getCommodity() == null || leg.getCommodity().isBlank()) {
            return null;
        }

        OutboundTradeDTO dto = new OutboundTradeDTO();
        dto.setCommodity(leg.getCommodity());
        // Volta parte de Target para Source
        dto.setOriginStation(route.getTargetStation());
        dto.setOriginSystem(route.getTargetSystem());
        dto.setOriginDistance(route.getTargetDistance());

        dto.setDestStation(route.getSourceStation());
        dto.setDestSystem(route.getSourceSystem());
        dto.setDestDistance(route.getSourceDistance());

        dto.setBuyPrice(leg.getBuyPrice());
        dto.setSupply(leg.getSupply());
        dto.setSellPrice(leg.getSellPrice());
        dto.setDemand(leg.getDemand());

        long profitUnit = extractProfitUnit(leg.getProfitDelta(), leg.getSellPrice(), leg.getBuyPrice());
        dto.setProfitPerUnit(profitUnit);
        dto.setProfitTotalTrip(profitUnit * cargo);

        dto.setProfitPerUnitFormatted(formatCredits(profitUnit));
        dto.setProfitTotalTripFormatted(formatCredits(dto.getProfitTotalTrip()));

        dto.setRouteDistance(route.getRouteDistance());
        dto.setRouteDistanceNumeric(route.getRouteDistanceNumeric());
        dto.setUpdated(route.getUpdated());

        return dto;
    }

    private long extractProfitUnit(String profitDelta, String sellPrice, String buyPrice) {
        if (profitDelta != null && !profitDelta.isBlank()) {
            // Formato comum: "+51,406 Cr (1,141%)"
            String digits = profitDelta.split("\\(")[0].replaceAll("[^0-9]", "");
            if (!digits.isEmpty()) {
                return Long.parseLong(digits);
            }
        }

        // Fallback: calcular sell - buy
        long sell = parseNumeric(sellPrice);
        long buy = parseNumeric(buyPrice);
        return (sell > buy) ? (sell - buy) : 0L;
    }

    private long parseNumeric(String text) {
        if (text == null) return 0L;
        String digits = text.replaceAll("[^0-9]", "");
        return digits.isEmpty() ? 0L : Long.parseLong(digits);
    }

    private String formatCredits(long cr) {
        synchronized (NUMBER_FORMAT) {
            return NUMBER_FORMAT.format(cr) + " Cr";
        }
    }

    private void sortTrades(List<OutboundTradeDTO> list, String sortBy) {
        if ("distance".equalsIgnoreCase(sortBy)) {
            // Menor distância primeiro, depois maior lucro
            list.sort(Comparator.comparingDouble(OutboundTradeDTO::getRouteDistanceNumeric)
                    .thenComparing(Comparator.comparingLong(OutboundTradeDTO::getProfitPerUnit).reversed()));
        } else {
            // Padrão: Maior lucro primeiro, depois menor distância
            list.sort(Comparator.comparingLong(OutboundTradeDTO::getProfitPerUnit).reversed()
                    .thenComparingDouble(OutboundTradeDTO::getRouteDistanceNumeric));
        }
    }

    private String fetchInaraHtml(String url) {
        try {
            return inaraClientService.fetchHtml(url);
        } catch (Exception e) {
            log.error("Erro ao buscar HTML do Inara para {}: {}", url, e.getMessage());
            return null;
        }
    }
}
