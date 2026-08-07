package com.memesee.content.search.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record MainPostSearchDocument(
        Long mainPostId,
        Long communityId,
        String communitySlug,
        String communityName,
        String authorUsername,
        String title,
        String content,
        List<String> tags,
        BigDecimal heatScore,
        long viewCount,
        long subPostCount,
        long likeCount,
        long favoriteCount,
        Instant createdAt,
        Instant updatedAt,
        Instant latestActivityAt
) {
}
