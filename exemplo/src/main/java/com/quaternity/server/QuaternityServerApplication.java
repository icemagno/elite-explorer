package com.quaternity.server;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.core.env.Environment;

import java.net.InetAddress;

@SpringBootApplication
public class QuaternityServerApplication {

    private static final Logger log = LoggerFactory.getLogger(QuaternityServerApplication.class);

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(QuaternityServerApplication.class);
        Environment env = app.run(args).getEnvironment();

        String port = env.getProperty("server.port", "8080");
        String hostAddress = "localhost";
        try {
            hostAddress = InetAddress.getLocalHost().getHostAddress();
        } catch (Exception ignored) {}

        log.info("""
                ========================================================================
                👑 QUATERNITY CHESS SERVER - SERVIDOR DE MESAS INICIADO COM SUCESSO!
                ========================================================================
                -> Página Inicial (Landing Page): http://localhost:{}/
                -> Painel de Gestão (Dashboard):  http://localhost:{}/dashboard
                -> Interface do Jogador (Play):   http://localhost:{}/play
                -> Acesso na Rede Local (LAN):    http://{}:{}/
                -> API REST Oficial:              http://{}:{}/api/tables
                -> WebSocket STOMP Endpoint:      ws://{}:{}/ws
                ========================================================================
                """, port, port, port, hostAddress, port, hostAddress, port, hostAddress, port);
    }
}
