package com.memesee.content.feed.infrastructure;

import com.memesee.content.feed.dto.FeedPageResponse;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.Optional;

public interface MainPostFeedPageCache {

    Optional<FeedPageResponse<MainPostSummaryResponse>> getFeedPage(MainPostFeedPageCacheKey key);

    default PlatformCacheReadResult<FeedPageResponse<MainPostSummaryResponse>> getFeedPageSnapshot(
            MainPostFeedPageCacheKey key
    ) {
        return getFeedPage(key)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putFeedPage(MainPostFeedPageCacheKey key, FeedPageResponse<MainPostSummaryResponse> response);

    void evictAllFeedPages();

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
