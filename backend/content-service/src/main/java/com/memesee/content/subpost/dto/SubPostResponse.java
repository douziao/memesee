package com.memesee.content.subpost.dto;

import com.memesee.content.media.dto.MediaAssetResponse;
import java.time.Instant;
import java.util.List;

public record SubPostResponse(
        Long id,
        Long mainPostId,
        Long parentSubPostId,
        String parentSubPostAuthorUsername,
        String authorUsername,
        String content,
        Instant createdAt,
        Instant updatedAt,
        long likeCount,
        long childSubPostCount,
        long favoriteCount,
        boolean likedByMe,
        boolean favoritedByMe,
        List<MediaAssetResponse> mediaAssets
) {
}
