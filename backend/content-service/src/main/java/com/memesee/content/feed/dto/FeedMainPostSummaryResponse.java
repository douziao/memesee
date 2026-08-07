package com.memesee.content.feed.dto;

import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

public record FeedMainPostSummaryResponse(
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
        List<FeedMediaAssetResponse> mediaAssets,
        List<String> previewImageUrls,
        List<String> tags
) {
    private static final int PREVIEW_MEDIA_LIMIT = 3;

    public static FeedMainPostSummaryResponse from(MainPostSummaryResponse post) {
        if (post == null) {
            return null;
        }
        List<FeedMediaAssetResponse> mediaAssets = post.mediaAssets() == null
                ? List.of()
                : post.mediaAssets().stream()
                .map(FeedMediaAssetResponse::from)
                .filter(Objects::nonNull)
                .limit(PREVIEW_MEDIA_LIMIT)
                .toList();
        return new FeedMainPostSummaryResponse(
                post.id(),
                post.communitySlug(),
                post.communityName(),
                post.title(),
                post.contentPreview(),
                post.postMode(),
                post.authorUsername(),
                post.createdAt(),
                post.updatedAt(),
                post.latestActivityAt(),
                post.heatScore(),
                post.viewCount(),
                post.subPostCount(),
                post.likeCount(),
                post.favoriteCount(),
                post.likedByMe(),
                post.favoritedByMe(),
                mediaAssets,
                limitPreviewImageUrls(post.previewImageUrls()),
                post.tags() == null ? List.of() : post.tags()
        );
    }

    private static List<String> limitPreviewImageUrls(List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return List.of();
        }
        return urls.stream()
                .filter(url -> url != null && !url.isBlank())
                .limit(PREVIEW_MEDIA_LIMIT)
                .toList();
    }
}
