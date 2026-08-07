package com.memesee.platform.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;

public class PlatformJwtService {

    public static final String USER_LEVEL_CLAIM = "lvl";
    public static final String BEARER_PREFIX = "Bearer ";

    private final SecretKey signingKey;
    private final long expirationSeconds;

    public PlatformJwtService(String secret, long expirationSeconds) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("JWT secret must not be blank.");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationSeconds = expirationSeconds;
    }

    public String generateToken(String username, int userLevel) {
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(expirationSeconds);

        return Jwts.builder()
                .subject(username)
                .claim(USER_LEVEL_CLAIM, userLevel)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey)
                .compact();
    }

    public String extractUsername(String token) {
        return parseClaims(token).getSubject();
    }

    public int extractUserLevel(String token) {
        Number userLevel = parseClaims(token).get(USER_LEVEL_CLAIM, Number.class);
        return userLevel == null ? 0 : userLevel.intValue();
    }

    public Claims parseClaims(String token) {
        try {
            return Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
        } catch (JwtException ex) {
            throw new PlatformJwtException("JWT token is invalid.", ex);
        }
    }

    public static String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            return "";
        }
        return authorizationHeader.substring(BEARER_PREFIX.length()).trim();
    }
}
