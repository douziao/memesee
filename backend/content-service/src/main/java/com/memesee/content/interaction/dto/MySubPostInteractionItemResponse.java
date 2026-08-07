package com.memesee.content.interaction.dto;

import java.time.Instant;

public record MySubPostInteractionItemResponse(
        Long subPostId,
        Long mainPostId,
        String postTitle,
        String mainPostCommunitySlug,
        String mainPostCommunityName,
        String mainPostContentPreview,
        String mainPostAuthorUsername,
        Instant mainPostCreatedAt,
        Instant mainPostLatestActivityAt,
        long mainPostViewCount,
        long mainPostSubPostCount,
        long mainPostLikeCount,
        long mainPostFavoriteCount,
        String subPostAuthorUsername,
        String subPostPreview,
        long subPostMediaAssetCount,
        String action,
        Instant interactedAt
) {
}
