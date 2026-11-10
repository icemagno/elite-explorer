package com.eliteexplorer.service;

import com.eliteexplorer.dto.TradeLegDTO;
import com.eliteexplorer.dto.TradeRouteDTO;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class InaraParserService {

    private static final Logger log = LoggerFactory.getLogger(InaraParserService.class);

    public List<TradeRouteDTO> parseTradeRoutes(String html) {
        List<TradeRouteDTO> list = new ArrayList<>();
        if (html == null || html.isBlank()) {
            return list;
        }

        Document doc = Jsoup.parse(html);
        Elements boxes = doc.select("div.mainblock.traderoutebox");
        if (boxes.isEmpty()) {
            boxes = doc.select("div.traderoutebox");
        }

        log.info("Found {} traderoutebox elements in HTML", boxes.size());

        for (Element box : boxes) {
            try {
                TradeRouteDTO route = parseSingleBox(box);
                if (route != null) {
                    list.add(route);
                }
            } catch (Exception e) {
                log.warn("Error parsing single trade route box: {}", e.getMessage(), e);
            }
        }

        return list;
    }

    private TradeRouteDTO parseSingleBox(Element box) {
        TradeRouteDTO route = new TradeRouteDTO();

        // 1. Station & Systems: From and To
        Elements stationLinks = box.select("a[href*='/station-market/']");
        if (stationLinks.size() >= 2) {
            // From Station & System
            Element fromLink = stationLinks.get(0);
            route.setSourceStation(extractStationName(fromLink));
            route.setSourceSystem(extractSystemName(fromLink));

            // To Station & System
            Element toLink = stationLinks.get(1);
            route.setTargetStation(extractStationName(toLink));
            route.setTargetSystem(extractSystemName(toLink));
        }

        // Station distances
        Elements stationDistances = box.select(".itempaircontainer:has(.itempairlabel:matchesOwn(^Station distance$)) .itempairvalue");
        if (stationDistances.size() >= 1) {
            route.setSourceDistance(cleanText(stationDistances.get(0).text()));
        }
        if (stationDistances.size() >= 2) {
            route.setTargetDistance(cleanText(stationDistances.get(1).text()));
        }

        // 2. Outbound Leg (Source -> Target)
        // Buy is at Source (traderouteboxtoright), Sell is at Target (traderouteboxfromleft)
        Element boxToRight = box.selectFirst("div.traderouteboxtoright");
        Element boxFromLeft = box.selectFirst("div.traderouteboxfromleft");

        TradeLegDTO outbound = new TradeLegDTO();
        outbound.setFromStation(route.getSourceStation());
        outbound.setFromSystem(route.getSourceSystem());
        outbound.setToStation(route.getTargetStation());
        outbound.setToSystem(route.getTargetSystem());

        if (boxToRight != null) {
            Element commLink = boxToRight.selectFirst("a[href*='/commodity/']");
            if (commLink != null) {
                outbound.setCommodity(cleanText(commLink.text()));
            }
            outbound.setBuyPrice(extractPairValue(boxToRight, "Buy price"));
            outbound.setSupply(extractPairValue(boxToRight, "Supply"));
        }

        if (boxFromLeft != null) {
            if (outbound.getCommodity() == null || outbound.getCommodity().isBlank()) {
                Element commLink = boxFromLeft.selectFirst("a[href*='/commodity/']");
                if (commLink != null) {
                    outbound.setCommodity(cleanText(commLink.text()));
                }
            }
            String fullSell = extractPairValue(boxFromLeft, "Sell price");
            parseSellPriceAndProfit(fullSell, outbound);
            outbound.setDemand(extractPairValue(boxFromLeft, "Demand"));
        }
        route.setOutbound(outbound);

        // 3. Return Leg (Target -> Source)
        // Buy is at Target (traderouteboxtoleft), Sell is at Source (traderouteboxfromright)
        Element boxToLeft = box.selectFirst("div.traderouteboxtoleft");
        Element boxFromRight = box.selectFirst("div.traderouteboxfromright");

        TradeLegDTO inbound = new TradeLegDTO();
        inbound.setFromStation(route.getTargetStation());
        inbound.setFromSystem(route.getTargetSystem());
        inbound.setToStation(route.getSourceStation());
        inbound.setToSystem(route.getSourceSystem());

        if (boxToLeft != null) {
            Element commLink = boxToLeft.selectFirst("a[href*='/commodity/']");
            if (commLink != null) {
                inbound.setCommodity(cleanText(commLink.text()));
            }
            inbound.setBuyPrice(extractPairValue(boxToLeft, "Buy price"));
            inbound.setSupply(extractPairValue(boxToLeft, "Supply"));
        }

        if (boxFromRight != null) {
            if (inbound.getCommodity() == null || inbound.getCommodity().isBlank()) {
                Element commLink = boxFromRight.selectFirst("a[href*='/commodity/']");
                if (commLink != null) {
                    inbound.setCommodity(cleanText(commLink.text()));
                }
            }
            String fullSell = extractPairValue(boxFromRight, "Sell price");
            parseSellPriceAndProfit(fullSell, inbound);
            inbound.setDemand(extractPairValue(boxFromRight, "Demand"));
        }
        route.setInbound(inbound);

        // 4. Route Stats
        route.setRouteDistance(extractPairValue(box, "Route distance"));
        route.setDistanceFromCenter(extractPairValue(box, "Distance"));
        route.setUpdated(extractPairValue(box, "Updated"));

        // 5. Profit values
        route.setProfitPerUnit(extractPairValue(box, "Profit per unit"));
        route.setProfitPerTrip(extractPairValue(box, "Profit per trip"));
        route.setProfitPerHour(extractPairValue(box, "Profit per hour"));
        route.setMargin(extractPairValue(box, "Margin"));

        // Numeric calculations for frontend sorting
        route.setProfitPerTripNumeric(parseNumericLong(route.getProfitPerTrip()));
        route.setProfitPerUnitNumeric(parseNumericLong(route.getProfitPerUnit()));
        route.setProfitPerHourNumeric(parseNumericLong(route.getProfitPerHour()));
        route.setRouteDistanceNumeric(parseNumericDouble(route.getRouteDistance()));

        return route;
    }

    private String extractStationName(Element link) {
        Element span = link.selectFirst("span.standardcase");
        if (span != null) {
            String text = span.text();
            // Inara has "StationName |"
            if (text.contains("|")) {
                text = text.substring(0, text.indexOf("|"));
            }
            return cleanText(text);
        }
        return cleanText(link.text());
    }

    private String extractSystemName(Element link) {
        Element span = link.selectFirst("span.uppercase");
        if (span != null) {
            return cleanText(span.text());
        }
        return "";
    }

    private String extractPairValue(Element parent, String labelText) {
        Elements pairs = parent.select(".itempaircontainer");
        for (Element pair : pairs) {
            Element lbl = pair.selectFirst(".itempairlabel");
            if (lbl != null && lbl.text().trim().equalsIgnoreCase(labelText.trim())) {
                Element val = pair.selectFirst(".itempairvalue");
                if (val != null) {
                    Element clone = val.clone();
                    clone.select(".pictofont, .supplydemandicon1, .supplydemandicon2, .supplydemandicon3, .stationicon, .blackmarketicon, .clipboardbuttonsmall").remove();
                    return cleanText(clone.text());
                }
            }
        }
        return "";
    }

    private void parseSellPriceAndProfit(String fullText, TradeLegDTO leg) {
        if (fullText == null || fullText.isBlank()) {
            return;
        }
        // Example: "55,908 Cr | +51,406 Cr (1,141%)"
        if (fullText.contains("|")) {
            String[] parts = fullText.split("\\|", 2);
            leg.setSellPrice(cleanText(parts[0]));
            leg.setProfitDelta(cleanText(parts[1]));
        } else {
            leg.setSellPrice(cleanText(fullText));
            leg.setProfitDelta("");
        }
    }

    private long parseNumericLong(String text) {
        if (text == null) return 0L;
        try {
            // Keep digits only
            String digits = text.replaceAll("[^0-9]", "");
            return digits.isEmpty() ? 0L : Long.parseLong(digits);
        } catch (Exception e) {
            return 0L;
        }
    }

    private double parseNumericDouble(String text) {
        if (text == null) return 0.0;
        try {
            String num = text.replaceAll("[^0-9.]", "");
            return num.isEmpty() ? 0.0 : Double.parseDouble(num);
        } catch (Exception e) {
            return 0.0;
        }
    }

    private String cleanText(String s) {
        if (s == null) return "";
        return s.replace('\u00A0', ' ')
                .replaceAll("[\\uE000-\\uF8FF]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
