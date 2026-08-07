package com.memesee.content.subpost.dto;

import java.time.Instant;

public record MySubPostItemResponse(
        Long id,
        Long mainPostId,
        String mainPostTitle,
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
        Long parentSubPostId,
        String authorUsername,
        String content,
        long subPostMediaAssetCount,
        Instant createdAt,
        Instant updatedAt,
        long likeCount,
        long childSubPostCount,
        long favoriteCount
) {
}
