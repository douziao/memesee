package com.memesee.content.feed.application;

import com.memesee.content.media.dto.MediaAssetResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record MainPostReadModel(
        Long id,
        String communitySlug,
        String communityName,
        String title,
        String content,
        String contentPreview,
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
        List<MediaAssetResponse> mediaAssets,
        List<String> previewImageUrls,
        List<String> tags
) {
}
