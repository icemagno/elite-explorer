package com.cmdrscan;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CmdrScanApplication {
    public static void main(String[] args) {
        SpringApplication.run(CmdrScanApplication.class, args);
    }
}
