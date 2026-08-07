package com.memesee.user;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class UserServiceApplication {

    public static void main(String[] args) {
        forceDebugOff();
        SpringApplication.run(UserServiceApplication.class, args);
    }

    private static void forceDebugOff() {
        System.setProperty("debug", "false");
    }
}

