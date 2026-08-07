package com.memesee.user.security;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.platform.security.PlatformJwtException;
import com.memesee.platform.security.PlatformJwtService;
import com.memesee.user.entity.User;
import com.memesee.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AuthContextResolver {

    private static final String UNAUTHORIZED_MESSAGE = "未登录或登录已失效。";

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public AuthContextResolver(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    public User resolveUser(String authorizationHeader) {
        String token = extractBearerToken(authorizationHeader);
        String username;
        try {
            username = jwtService.extractUsername(token);
        } catch (PlatformJwtException ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ApiErrorCode.UNAUTHORIZED, UNAUTHORIZED_MESSAGE);
        }
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        ApiErrorCode.RESOURCE_NOT_FOUND,
                        "用户不存在。"
                ));
    }

    private String extractBearerToken(String authorizationHeader) {
        String token = PlatformJwtService.extractBearerToken(authorizationHeader);
        if (token.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ApiErrorCode.UNAUTHORIZED, UNAUTHORIZED_MESSAGE);
        }
        return token;
    }
}

