package com.memesee.content.interaction.dto;

import java.time.Instant;

public record MyPostInteractionItemResponse(
        Long postId,
        String postTitle,
        String communityName,
        String contentPreview,
        String authorUsername,
        Instant createdAt,
        Instant latestActivityAt,
        long viewCount,
        long subPostCount,
        long likeCount,
        long favoriteCount,
        String action,
        Instant interactedAt
) {
}
