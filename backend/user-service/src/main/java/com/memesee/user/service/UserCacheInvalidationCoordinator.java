package com.memesee.user.service;

import com.memesee.user.infrastructure.cache.RecentPostStatsCache;
import com.memesee.user.infrastructure.cache.UserProgressSnapshotCache;
import org.springframework.stereotype.Component;

@Component
public class UserCacheInvalidationCoordinator {

    private final RecentPostStatsCache recentPostStatsCache;
    private final UserProgressSnapshotCache userProgressSnapshotCache;

    public UserCacheInvalidationCoordinator(
            RecentPostStatsCache recentPostStatsCache,
            UserProgressSnapshotCache userProgressSnapshotCache
    ) {
        this.recentPostStatsCache = recentPostStatsCache;
        this.userProgressSnapshotCache = userProgressSnapshotCache;
    }

    public void onRecentPostStatsChanged() {
        recentPostStatsCache.evictRecentCreatedPosts();
        userProgressSnapshotCache.evictAllSnapshots();
    }

    public void onUserProgressChanged(String username) {
        String requiredUsername = requireUsername(username);
        userProgressSnapshotCache.evictSnapshot(requiredUsername);
    }

    private String requireUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("username must not be blank.");
        }
        return username.trim();
    }
}
