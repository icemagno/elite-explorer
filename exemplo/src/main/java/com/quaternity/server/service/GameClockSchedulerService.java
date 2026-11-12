package com.quaternity.server.service;

import com.quaternity.server.engine.QuaternityEngine;
import com.quaternity.server.model.GameState;
import com.quaternity.server.model.GameTable;
import com.quaternity.server.repository.TableRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Serviço agendador autoritativo do relógio.
 * 
 * Executa em alta frequência (100ms) para controlar os tempos oficiais das partidas ativas,
 * descontar o tempo do exército da vez e detectar time forfeits imediatamente.
 */
@Service
public class GameClockSchedulerService {

    private final TableRepository tableRepository;
    private final QuaternityEngine engine;
    private final TableManagerService tableManagerService;
    private int broadcastCounter = 0;

    public GameClockSchedulerService(TableRepository tableRepository,
                                     QuaternityEngine engine,
                                     TableManagerService tableManagerService) {
        this.tableRepository = tableRepository;
        this.engine = engine;
        this.tableManagerService = tableManagerService;
    }

    @Scheduled(fixedRate = 100)
    public void tickActiveGameClocks() {
        List<GameTable> tables = tableRepository.findAll();
        boolean hasRunningGames = false;

        for (GameTable table : tables) {
            if (table.getState() == GameState.RUNNING) {
                hasRunningGames = true;
                QuaternityEngine.EngineEvent event = engine.updateElapsedTime(table);

                // Salva o estado atualizado
                tableRepository.save(table);

                // Se ocorreu time forfeit ou término por tempo
                if (event != null) {
                    tableManagerService.broadcastTableSync(table);
                    tableManagerService.broadcastTablesList();
                } else if (broadcastCounter % 2 == 0) {
                    // Sincroniza WebSocket a cada 200ms para manter fluidez perfeita com baixo consumo de rede
                    tableManagerService.broadcastTableSync(table);
                }
            }
        }

        if (hasRunningGames) {
            broadcastCounter++;
            if (broadcastCounter >= 10) {
                broadcastCounter = 0;
                // Sincroniza o dashboard geral a cada 1 segundo quando há partidas ativas
                tableManagerService.broadcastTablesList();
            }
        }
    }
}
