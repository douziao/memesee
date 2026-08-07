package com.memesee.content.notification.infrastructure;

import com.memesee.content.notification.dto.NotificationListResponse;
import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.Optional;

public interface NotificationListCache {

    Optional<NotificationListResponse> getNotificationList(NotificationListCacheKey key);

    default PlatformCacheReadResult<NotificationListResponse> getNotificationListSnapshot(NotificationListCacheKey key) {
        return getNotificationList(key)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putNotificationList(NotificationListCacheKey key, NotificationListResponse response);

    void evictNotificationLists(String username);

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
