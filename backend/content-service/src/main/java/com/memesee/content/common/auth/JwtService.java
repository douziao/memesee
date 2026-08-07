package com.memesee.content.common.auth;

import com.memesee.platform.security.PlatformJwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final PlatformJwtService platformJwtService;

    public JwtService(@Value("${app.security.jwt.secret}") String secret) {
        this.platformJwtService = new PlatformJwtService(secret, 86400L);
    }

    public String extractUsername(String token) {
        return platformJwtService.extractUsername(token);
    }

    public int extractUserLevel(String token) {
        return platformJwtService.extractUserLevel(token);
    }
}
