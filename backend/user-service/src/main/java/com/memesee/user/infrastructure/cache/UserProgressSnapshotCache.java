package com.memesee.user.infrastructure.cache;

import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.user.service.ProgressSnapshot;
import java.util.Optional;

public interface UserProgressSnapshotCache {

    Optional<ProgressSnapshot> getSnapshot(String username);

    default PlatformCacheReadResult<ProgressSnapshot> getSnapshotSnapshot(String username) {
        return getSnapshot(username)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putSnapshot(String username, ProgressSnapshot snapshot);

    void evictSnapshot(String username);

    void evictAllSnapshots();

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
