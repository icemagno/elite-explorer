package com.eliteexplorer.service;

import com.eliteexplorer.dto.TradeRouteDTO;
import com.eliteexplorer.dto.TradeSearchRequest;
import com.eliteexplorer.dto.TradeSearchResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class InaraClientService {

    private static final Logger log = LoggerFactory.getLogger(InaraClientService.class);

    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    private static final Pattern CHALLENGE_PATTERN = Pattern.compile("['\"]challenge=['\"]\\s*\\+\\s*encodeURIComponent\\(['\"]([a-f0-9]+)['\"]\\)");
    private static final Pattern CHALLENGE_FALLBACK = Pattern.compile("encodeURIComponent\\(['\"]([a-f0-9]{32})['\"]\\)");

    private final InaraParserService parserService;
    private final HttpClient httpClient;

    public InaraClientService(InaraParserService parserService) {
        this.parserService = parserService;

        CookieManager cookieManager = new CookieManager();
        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        this.httpClient = HttpClient.newBuilder()
                .cookieHandler(cookieManager)
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    public String buildInaraUrl(TradeSearchRequest request) {
        String system = request.getSystem() != null ? request.getSystem().trim() : "Col 285 Sector EG-D a42-1";
        int cargo = request.getCargoCapacity() != null && request.getCargoCapacity() > 0 ? request.getCargoCapacity() : 36;
        int maxDist = request.getMaxDistance() != null && request.getMaxDistance() > 0 ? request.getMaxDistance() : 80;
        int maxAge = request.getMaxAgeHours() != null ? request.getMaxAgeHours() : 72;
        int padSize = request.getPadSize() != null ? request.getPadSize() : 1;

        String encodedSystem = URLEncoder.encode(system, StandardCharsets.UTF_8);

        return String.format(
                "https://inara.cz/elite/market-traderoutes/?ps1=%s&pi10=%d&pi2=%d&pi5=%d&pi3=%d&pi9=0&pi4=0&pi7=0&pi12=0&pi8=1&pi14=0&pi15=0&pi1=0",
                encodedSystem, cargo, maxDist, maxAge, padSize
        );
    }

    public TradeSearchResult fetchTradeRoutes(TradeSearchRequest request) {
        String url = buildInaraUrl(request);
        log.info("Fetching trade routes from URL: {}", url);

        try {
            String html = fetchHtmlWithChallengeHandling(url, 0);

            if (html == null || html.isBlank()) {
                return TradeSearchResult.failure("A resposta da página Inara veio vazia.", url);
            }

            List<TradeRouteDTO> routes = parserService.parseTradeRoutes(html);
            log.info("Successfully parsed {} routes from Inara", routes.size());

            return TradeSearchResult.success(
                    request.getSystem(),
                    request.getCargoCapacity() != null ? request.getCargoCapacity() : 36,
                    request.getMaxDistance() != null ? request.getMaxDistance() : 80,
                    url,
                    routes
            );
        } catch (Exception e) {
            log.error("Failed to fetch or parse trade routes from Inara: {}", e.getMessage(), e);
            return TradeSearchResult.failure("Erro ao consultar o Inara: " + e.getMessage(), url);
        }
    }

    public String fetchHtml(String targetUrl) throws IOException, InterruptedException {
        return fetchHtmlWithChallengeHandling(targetUrl, 0);
    }

    private String fetchHtmlWithChallengeHandling(String targetUrl, int retryCount) throws IOException, InterruptedException {
        if (retryCount > 2) {
            throw new IOException("Excedido limite de tentativas para resolução de desafio Inara.");
        }

        HttpRequest getRequest = HttpRequest.newBuilder()
                .uri(URI.create(targetUrl))
                .header("User-Agent", USER_AGENT)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9,pt-BR;q=0.8")
                .header("Referer", "https://inara.cz/")
                .timeout(Duration.ofSeconds(20))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(getRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        String body = response.body();

        // Check if Inara challenge was triggered
        if (body.contains("challenge-container") || body.contains("validatechallenge.php") || body.contains("Access check required")) {
            log.warn("Inara challenge detected on attempt {}. Resolving challenge automatically...", retryCount + 1);
            boolean solved = solveChallenge(body);
            if (solved) {
                Thread.sleep(300);
                return fetchHtmlWithChallengeHandling(targetUrl, retryCount + 1);
            } else {
                log.error("Could not extract challenge token from HTML.");
            }
        }

        return body;
    }

    private boolean solveChallenge(String html) {
        String token = null;
        Matcher m1 = CHALLENGE_PATTERN.matcher(html);
        if (m1.find()) {
            token = m1.group(1);
        } else {
            Matcher m2 = CHALLENGE_FALLBACK.matcher(html);
            if (m2.find()) {
                token = m2.group(1);
            }
        }

        if (token == null || token.isBlank()) {
            return false;
        }

        log.info("Extracted challenge token: {}", token);

        try {
            long ts = System.currentTimeMillis();
            int cf = ThreadLocalRandom.current().nextInt(100, 9999);
            String payload = "challenge=" + URLEncoder.encode(token, StandardCharsets.UTF_8)
                    + "&ts=" + ts
                    + "&cf=" + cf;

            HttpRequest postRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://inara.cz/validatechallenge.php"))
                    .header("User-Agent", USER_AGENT)
                    .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                    .header("X-Requested-With", "XMLHttpRequest")
                    .header("Referer", "https://inara.cz/elite/market-traderoutes/")
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> postResponse = httpClient.send(postRequest, HttpResponse.BodyHandlers.ofString());
            log.info("Challenge solution POST responded with status code: {}", postResponse.statusCode());
            return postResponse.statusCode() >= 200 && postResponse.statusCode() < 300;
        } catch (Exception e) {
            log.error("Error solving Inara challenge: {}", e.getMessage(), e);
            return false;
        }
    }
}
