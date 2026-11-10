package com.eliteexplorer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EliteExplorerApplication {

    public static void main(String[] args) {
        SpringApplication.run(EliteExplorerApplication.class, args);
    }
}
