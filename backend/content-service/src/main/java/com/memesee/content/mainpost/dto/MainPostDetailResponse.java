package com.memesee.content.mainpost.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record MainPostDetailResponse(
        Long id,
        String communitySlug,
        String communityName,
        String title,
        String content,
        String postMode,
        String authorUsername,
        Instant createdAt,
        Instant updatedAt,
        Instant latestActivityAt,
        BigDecimal heatScore,
        long viewCount,
        long subPostCount,
        long likeCount,
        long favoriteCount,
        boolean likedByMe,
        boolean favoritedByMe,
        List<MainPostDetailMediaAssetResponse> mediaAssets,
        List<String> tags
) {
}
