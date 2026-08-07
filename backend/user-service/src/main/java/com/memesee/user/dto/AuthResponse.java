package com.memesee.user.dto;

public record AuthResponse(
        String username,
        String token,
        int level
) {
}

