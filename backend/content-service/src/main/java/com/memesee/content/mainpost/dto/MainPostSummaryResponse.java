package com.memesee.content.mainpost.dto;

import com.memesee.content.media.dto.MediaAssetResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record MainPostSummaryResponse(
        Long id,
        String communitySlug,
        String communityName,
        String title,
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
