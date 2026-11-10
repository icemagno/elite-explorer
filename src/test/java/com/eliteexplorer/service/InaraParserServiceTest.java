package com.eliteexplorer.service;

import com.eliteexplorer.dto.TradeRouteDTO;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class InaraParserServiceTest {

    @Test
    public void testParseSampleHtml() throws IOException {
        File file = new File("traderoutes.html");
        assertTrue(file.exists(), "traderoutes.html should exist for testing");

        String html = Files.readString(file.toPath());
        InaraParserService parser = new InaraParserService();
        List<TradeRouteDTO> routes = parser.parseTradeRoutes(html);

        assertNotNull(routes);
        assertFalse(routes.isEmpty(), "Should have parsed trade routes");
        System.out.println("Parsed " + routes.size() + " routes successfully!");

        TradeRouteDTO first = routes.get(0);
        System.out.println("Source: " + first.getSourceStation() + " | " + first.getSourceSystem() + " (" + first.getSourceDistance() + ")");
        System.out.println("Target: " + first.getTargetStation() + " | " + first.getTargetSystem() + " (" + first.getTargetDistance() + ")");
        System.out.println("Outbound item: " + first.getOutbound().getCommodity() + " Buy: " + first.getOutbound().getBuyPrice() + " Sell: " + first.getOutbound().getSellPrice());
        System.out.println("Inbound item: " + first.getInbound().getCommodity() + " Buy: " + first.getInbound().getBuyPrice() + " Sell: " + first.getInbound().getSellPrice());
        System.out.println("Profit per unit: " + first.getProfitPerUnit());
        System.out.println("Profit per trip: " + first.getProfitPerTrip());
        System.out.println("Profit per hour: " + first.getProfitPerHour());
        System.out.println("Margin: " + first.getMargin());
        System.out.println("Route Distance: " + first.getRouteDistance());

        assertEquals("Hoshikage Lapis", first.getSourceStation());
        assertEquals("Col 285 Sector VT-R d4-95", first.getSourceSystem());
        assertEquals("Oliveira Synthetics Silo", first.getTargetStation());
        assertEquals("Addovik", first.getTargetSystem());
        assertEquals("449 Ls", first.getSourceDistance());
        assertEquals("1,416 Ls", first.getTargetDistance());

        assertEquals("Gold", first.getOutbound().getCommodity());
        assertEquals("4,502 Cr", first.getOutbound().getBuyPrice());
        assertEquals("765", first.getOutbound().getSupply());
        assertEquals("55,908 Cr", first.getOutbound().getSellPrice());
        assertEquals("350", first.getOutbound().getDemand());

        assertEquals("CMM Composite", first.getInbound().getCommodity());
        assertEquals("4,913 Cr", first.getInbound().getBuyPrice());
        assertEquals("4,272", first.getInbound().getSupply());
        assertEquals("20,281 Cr", first.getInbound().getSellPrice());
        assertEquals("201,581", first.getInbound().getDemand());

        assertEquals("66,774 Cr", first.getProfitPerUnit());
        assertEquals("2,403,864 Cr", first.getProfitPerTrip());
        assertEquals("8,536,156 Cr", first.getProfitPerHour());
        assertEquals("1,141 / 312 %", first.getMargin());
        assertEquals("53.38 Ly", first.getRouteDistance());
        assertEquals("~299 Ly", first.getDistanceFromCenter());
        assertEquals("2 days ago", first.getUpdated());
    }
}
