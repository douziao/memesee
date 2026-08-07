package com.memesee.user.service;

import com.memesee.user.entity.PostCreationRecord;
import com.memesee.user.infrastructure.cache.RecentPostStatsCache;
import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformSingleFlight;
import com.memesee.user.entity.PostDailyStat;
import com.memesee.user.repository.PostCreationRecordRepository;
import com.memesee.user.repository.PostDailyStatRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecentPostStatsService {

    private static final Logger log = LoggerFactory.getLogger(RecentPostStatsService.class);

    private final PostCreationRecordRepository postCreationRecordRepository;
    private final PostDailyStatRepository postDailyStatRepository;
    private final RecentPostStatsCache recentPostStatsCache;
    private final UserCacheInvalidationCoordinator cacheInvalidationCoordinator;
    private final long fallbackRecentCreatedPosts;
    private final int fallbackWindowDays;
    private final PlatformSingleFlight cacheLoadSingleFlight = new PlatformSingleFlight();
    private final PlatformAsyncRefreshCoordinator asyncRefreshCoordinator;

    @Autowired
    public RecentPostStatsService(
            PostCreationRecordRepository postCreationRecordRepository,
            PostDailyStatRepository postDailyStatRepository,
            RecentPostStatsCache recentPostStatsCache,
            UserCacheInvalidationCoordinator cacheInvalidationCoordinator,
            @Value("${app.progress.recent-created-posts:0}") long fallbackRecentCreatedPosts,
            @Value("${app.progress.recent-created-posts-window-days:100}") int fallbackWindowDays
    ) {
        this(
                postCreationRecordRepository,
                postDailyStatRepository,
                recentPostStatsCache,
                cacheInvalidationCoordinator,
                fallbackRecentCreatedPosts,
                fallbackWindowDays,
                new PlatformAsyncRefreshCoordinator()
        );
    }

    RecentPostStatsService(
            PostCreationRecordRepository postCreationRecordRepository,
            PostDailyStatRepository postDailyStatRepository,
            RecentPostStatsCache recentPostStatsCache,
            UserCacheInvalidationCoordinator cacheInvalidationCoordinator,
            long fallbackRecentCreatedPosts,
            int fallbackWindowDays,
            PlatformAsyncRefreshCoordinator asyncRefreshCoordinator
    ) {
        this.postCreationRecordRepository = postCreationRecordRepository;
        this.postDailyStatRepository = postDailyStatRepository;
        this.recentPostStatsCache = recentPostStatsCache;
        this.cacheInvalidationCoordinator = cacheInvalidationCoordinator;
        this.fallbackRecentCreatedPosts = Math.max(0L, fallbackRecentCreatedPosts);
        this.fallbackWindowDays = Math.max(1, fallbackWindowDays);
        this.asyncRefreshCoordinator = asyncRefreshCoordinator;
    }

    @Transactional
    public void recordPostCreated(Long mainPostId, Instant occurredAt) {
        if (mainPostId == null || mainPostId <= 0L) {
            return;
        }
        Instant safeOccurredAt = occurredAt == null ? Instant.now() : occurredAt;
        if (!markPostCreated(mainPostId, safeOccurredAt)) {
            return;
        }
        LocalDate date = toDate(safeOccurredAt);
        int updated = postDailyStatRepository.incrementCreatedCount(date);
        if (updated > 0) {
            cacheInvalidationCoordinator.onRecentPostStatsChanged();
            return;
        }
        PostDailyStat created = new PostDailyStat(date, 1L);
        try {
            postDailyStatRepository.save(created);
        } catch (Exception ex) {
            postDailyStatRepository.incrementCreatedCount(date);
        }
        cacheInvalidationCoordinator.onRecentPostStatsChanged();
    }

    @Transactional(readOnly = true)
    public long countRecentCreatedPosts(int days) {
        int safeDays = Math.max(1, days);
        PlatformCacheReadResult<Long> cachedCount = recentPostStatsCache.getRecentCreatedPostsSnapshot(safeDays);
        if (cachedCount.value().isPresent()) {
            triggerAsyncRefreshIfStale(safeDays, cachedCount);
            return cachedCount.value().orElseThrow();
        }
        return cacheLoadSingleFlight.execute(
                "recent-post-stats:" + safeDays,
                () -> loadAndCacheRecentCreatedPosts(safeDays),
                recentPostStatsCache::recordRequestMerge
        );
    }

    private void triggerAsyncRefreshIfStale(int safeDays, PlatformCacheReadResult<Long> cachedCount) {
        if (!cachedCount.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "recent-post-stats-refresh:" + safeDays,
                () -> {
                    try {
                        loadAndCacheRecentCreatedPosts(safeDays);
                    } catch (RuntimeException error) {
                        log.warn("recent_post_stats_async_refresh_failed days={}", safeDays, error);
                    }
                },
                recentPostStatsCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            recentPostStatsCache.recordRefresh();
            return;
        }
        recentPostStatsCache.recordRefreshMerge();
    }

    private long loadAndCacheRecentCreatedPosts(int safeDays) {
        recentPostStatsCache.recordLoaderHit();
        LocalDate startDate = LocalDate.now(ZoneOffset.UTC).minusDays(safeDays - 1L);
        long trackedDays = postDailyStatRepository.countByActivityDateGreaterThanEqual(startDate);
        long count = postDailyStatRepository.sumCreatedCountFromDate(startDate);
        long result;
        if (trackedDays > 0) {
            result = Math.max(0L, count);
            recentPostStatsCache.putRecentCreatedPosts(safeDays, result);
            return result;
        }
        if (fallbackRecentCreatedPosts <= 0L) {
            recentPostStatsCache.putRecentCreatedPosts(safeDays, 0L);
            return 0L;
        }
        if (safeDays == fallbackWindowDays) {
            recentPostStatsCache.putRecentCreatedPosts(safeDays, fallbackRecentCreatedPosts);
            return fallbackRecentCreatedPosts;
        }
        double ratio = safeDays / (double) fallbackWindowDays;
        result = Math.max(0L, Math.round(fallbackRecentCreatedPosts * ratio));
        recentPostStatsCache.putRecentCreatedPosts(safeDays, result);
        return result;
    }

    private LocalDate toDate(Instant instant) {
        Instant safeInstant = instant == null ? Instant.now() : instant;
        return safeInstant.atZone(ZoneOffset.UTC).toLocalDate();
    }

    private boolean markPostCreated(Long mainPostId, Instant occurredAt) {
        try {
            postCreationRecordRepository.saveAndFlush(new PostCreationRecord(mainPostId, occurredAt));
            return true;
        } catch (DataIntegrityViolationException ex) {
            return false;
        }
    }
}
