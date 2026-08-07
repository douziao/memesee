package com.memesee.user.dto;

public record ActivityReportResponse(
        int level,
        String refreshedToken,
        LevelProgressResponse progress
) {
}

