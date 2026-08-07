package com.memesee.content.feed.infrastructure;

public record MainPostFeedPageCacheKey(
        String communitySlug,
        String sortMode,
        String cursor,
        int size
) {
}
