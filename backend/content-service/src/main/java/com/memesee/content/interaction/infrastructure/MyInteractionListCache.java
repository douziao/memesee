package com.memesee.content.interaction.infrastructure;

import com.memesee.content.interaction.dto.MyInteractionListResponse;
import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.Optional;

public interface MyInteractionListCache {

    Optional<MyInteractionListResponse> getInteractionList(String username, int limit);

    default PlatformCacheReadResult<MyInteractionListResponse> getInteractionListSnapshot(String username, int limit) {
        return getInteractionList(username, limit)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putInteractionList(String username, int limit, MyInteractionListResponse response);

    void evictInteractionLists(String username);

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
