package com.memesee.user.dto;

import java.time.Instant;

public record UserProfileResponse(
        Long uid,
        String username,
        Instant joinedAt,
        int level,
        String refreshedToken,
        LevelProgressResponse progress
) {
}

