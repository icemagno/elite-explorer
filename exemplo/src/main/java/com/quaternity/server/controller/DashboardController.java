package com.quaternity.server.controller;

import com.quaternity.server.model.GameState;
import com.quaternity.server.model.GameTable;
import com.quaternity.server.model.dto.TableSummaryDto;
import com.quaternity.server.service.TableManagerService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

@Controller
public class DashboardController {

    private final TableManagerService tableManagerService;

    public DashboardController(TableManagerService tableManagerService) {
        this.tableManagerService = tableManagerService;
    }

    @GetMapping("/")
    public String index() {
        return "index";
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model) {
        List<GameTable> tables = tableManagerService.getAllTables();
        List<TableSummaryDto> summaries = tables.stream().map(TableSummaryDto::fromTable).toList();

        long runningCount = tables.stream().filter(t -> t.getState() == GameState.RUNNING).count();
        long pausedCount = tables.stream().filter(t -> t.getState() == GameState.PAUSED).count();
        long lobbyCount = tables.stream().filter(t -> t.getState() == GameState.LOBBY).count();
        long totalPlayers = tables.stream().mapToInt(GameTable::getConnectedCount).sum();

        model.addAttribute("tables", summaries);
        model.addAttribute("totalTables", tables.size());
        model.addAttribute("runningCount", runningCount);
        model.addAttribute("pausedCount", pausedCount);
        model.addAttribute("lobbyCount", lobbyCount);
        model.addAttribute("totalPlayers", totalPlayers);

        return "dashboard";
    }

    @GetMapping("/play")
    public String play() {
        return "play";
    }
}
