package com.memesee.content.common.auth;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.platform.security.PlatformJwtException;
import com.memesee.platform.security.PlatformJwtService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AuthContextResolver {

    private static final String UNAUTHORIZED_MESSAGE = "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u5931\u6548\u3002";

    private final JwtService jwtService;

    public AuthContextResolver(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    public AuthContext resolveOptional(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            return AuthContext.anonymous();
        }
        return resolveRequired(authorizationHeader);
    }

    public AuthContext resolveRequired(String authorizationHeader) {
        String token = extractBearerToken(authorizationHeader);
        try {
            String username = jwtService.extractUsername(token);
            int userLevel = jwtService.extractUserLevel(token);
            return new AuthContext(username, userLevel);
        } catch (PlatformJwtException ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ApiErrorCode.UNAUTHORIZED, UNAUTHORIZED_MESSAGE);
        }
    }

    private String extractBearerToken(String authorizationHeader) {
        String token = PlatformJwtService.extractBearerToken(authorizationHeader);
        if (token.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ApiErrorCode.UNAUTHORIZED, UNAUTHORIZED_MESSAGE);
        }
        return token;
    }
}
