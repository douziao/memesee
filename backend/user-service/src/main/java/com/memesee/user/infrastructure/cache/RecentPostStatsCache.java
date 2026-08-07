package com.memesee.user.infrastructure.cache;

import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.Optional;

public interface RecentPostStatsCache {

    Optional<Long> getRecentCreatedPosts(int days);

    default PlatformCacheReadResult<Long> getRecentCreatedPostsSnapshot(int days) {
        return getRecentCreatedPosts(days)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putRecentCreatedPosts(int days, long count);

    void evictRecentCreatedPosts();

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
