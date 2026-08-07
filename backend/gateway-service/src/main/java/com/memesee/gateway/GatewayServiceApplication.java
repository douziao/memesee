package com.memesee.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GatewayServiceApplication {

    public static void main(String[] args) {
        forceDebugOff();
        SpringApplication.run(GatewayServiceApplication.class, args);
    }

    private static void forceDebugOff() {
        System.setProperty("debug", "false");
    }
}
