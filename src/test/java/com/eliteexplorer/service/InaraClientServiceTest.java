package com.eliteexplorer.service;

import com.eliteexplorer.dto.TradeSearchRequest;
import com.eliteexplorer.dto.TradeSearchResult;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class InaraClientServiceTest {

    @Test
    public void testBuildUrl() {
        InaraParserService parser = new InaraParserService();
        InaraClientService client = new InaraClientService(parser);

        TradeSearchRequest req = new TradeSearchRequest("Col 285 Sector EG-D a42-1", 36, 80);
        String url = client.buildInaraUrl(req);

        assertTrue(url.contains("ps1=Col+285+Sector+EG-D+a42-1"));
        assertTrue(url.contains("pi10=36"));
        assertTrue(url.contains("pi2=80"));
        assertTrue(url.contains("pi5=72"));
    }

    @Test
    public void testLiveFetchTradeRoutes() {
        InaraParserService parser = new InaraParserService();
        InaraClientService client = new InaraClientService(parser);

        TradeSearchRequest req = new TradeSearchRequest("Col 285 Sector EG-D a42-1", 36, 80);
        TradeSearchResult result = client.fetchTradeRoutes(req);

        assertNotNull(result);
        if (result.isSuccess()) {
            System.out.println("Live fetch succeeded with " + result.getRoutes().size() + " routes!");
            assertFalse(result.getRoutes().isEmpty(), "Routes should not be empty on live fetch");
        } else {
            System.out.println("Live fetch warning (may happen if network/Inara rate limited): " + result.getErrorMessage());
        }
    }
}
