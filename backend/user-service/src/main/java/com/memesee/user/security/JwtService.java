package com.memesee.user.security;

import com.memesee.platform.security.PlatformJwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final PlatformJwtService platformJwtService;

    public JwtService(
            @Value("${app.security.jwt.secret}") String secret,
            @Value("${app.security.jwt.expiration-seconds:86400}") long expirationSeconds
    ) {
        this.platformJwtService = new PlatformJwtService(secret, expirationSeconds);
    }

    public String generateToken(String username, int userLevel) {
        return platformJwtService.generateToken(username, userLevel);
    }

    public String extractUsername(String token) {
        return platformJwtService.extractUsername(token);
    }

    public int extractUserLevel(String token) {
        return platformJwtService.extractUserLevel(token);
    }
}

