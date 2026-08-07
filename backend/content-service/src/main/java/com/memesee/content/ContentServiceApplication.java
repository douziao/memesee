package com.memesee.content;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ContentServiceApplication {

    public static void main(String[] args) {
        forceDebugOff();
        SpringApplication.run(ContentServiceApplication.class, args);
    }

    private static void forceDebugOff() {
        System.setProperty("debug", "false");
    }
}
