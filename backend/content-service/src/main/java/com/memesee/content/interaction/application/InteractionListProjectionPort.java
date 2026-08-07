package com.memesee.content.interaction.application;

import java.time.Instant;
import java.util.List;

public interface InteractionListProjectionPort {

    InteractionListProjection loadInteractionList(String username, int limit);

    record InteractionListProjection(
            List<PostInteractionProjection> postInteractions,
            List<SubPostInteractionProjection> subPostInteractions
    ) {
    }

    record PostInteractionProjection(
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

    record SubPostInteractionProjection(
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
            String action,
            Instant interactedAt
    ) {
    }
}
