package com.memesee.content.notification.infrastructure;

import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.Optional;

public interface NotificationUnreadCountCache {

    Optional<Long> getUnreadCount(String username);

    default PlatformCacheReadResult<Long> getUnreadCountSnapshot(String username) {
        return getUnreadCount(username)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putUnreadCount(String username, long unreadCount);

    void evictUnreadCount(String username);

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
