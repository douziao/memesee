package com.memesee.user.service;

import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformSingleFlight;
import com.memesee.user.infrastructure.cache.UserProgressSnapshotCache;
import com.memesee.user.repository.UserCommunityMainPostActivityRepository;
import com.memesee.user.repository.UserCommunityVisitRepository;
import com.memesee.user.repository.UserDailyMetricRepository;
import com.memesee.user.repository.UserReadMainPostRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UserProgressSnapshotService {

    private static final Logger log = LoggerFactory.getLogger(UserProgressSnapshotService.class);

    private static final int RECENT_WINDOW_DAYS = 100;
    private static final long LV3_RECENT_CREATED_CAP = 2000L;
    private static final double LV3_RECENT_VIEW_RATIO = 0.25d;

    private final UserDailyMetricRepository userDailyMetricRepository;
    private final UserCommunityVisitRepository userCommunityVisitRepository;
    private final UserCommunityMainPostActivityRepository userCommunityMainPostActivityRepository;
    private final UserReadMainPostRepository userReadMainPostRepository;
    private final RecentPostStatsService recentPostStatsService;
    private final UserProgressSnapshotCache userProgressSnapshotCache;
    private final PlatformAsyncRefreshCoordinator asyncRefreshCoordinator;
    private final PlatformSingleFlight cacheLoadSingleFlight = new PlatformSingleFlight();

    @Autowired
    public UserProgressSnapshotService(
            UserDailyMetricRepository userDailyMetricRepository,
            UserCommunityVisitRepository userCommunityVisitRepository,
            UserCommunityMainPostActivityRepository userCommunityMainPostActivityRepository,
            UserReadMainPostRepository userReadMainPostRepository,
            RecentPostStatsService recentPostStatsService,
            UserProgressSnapshotCache userProgressSnapshotCache
    ) {
        this(
                userDailyMetricRepository,
                userCommunityVisitRepository,
                userCommunityMainPostActivityRepository,
                userReadMainPostRepository,
                recentPostStatsService,
                userProgressSnapshotCache,
                new PlatformAsyncRefreshCoordinator()
        );
    }

    UserProgressSnapshotService(
            UserDailyMetricRepository userDailyMetricRepository,
            UserCommunityVisitRepository userCommunityVisitRepository,
            UserCommunityMainPostActivityRepository userCommunityMainPostActivityRepository,
            UserReadMainPostRepository userReadMainPostRepository,
            RecentPostStatsService recentPostStatsService,
            UserProgressSnapshotCache userProgressSnapshotCache,
            PlatformAsyncRefreshCoordinator asyncRefreshCoordinator
    ) {
        this.userDailyMetricRepository = userDailyMetricRepository;
        this.userCommunityVisitRepository = userCommunityVisitRepository;
        this.userCommunityMainPostActivityRepository = userCommunityMainPostActivityRepository;
        this.userReadMainPostRepository = userReadMainPostRepository;
        this.recentPostStatsService = recentPostStatsService;
        this.userProgressSnapshotCache = userProgressSnapshotCache;
        this.asyncRefreshCoordinator = asyncRefreshCoordinator;
    }

    public ProgressSnapshot loadSnapshot(String username) {
        PlatformCacheReadResult<ProgressSnapshot> cachedSnapshot = userProgressSnapshotCache.getSnapshotSnapshot(username);
        if (cachedSnapshot.value().isPresent()) {
            ProgressSnapshot snapshot = cachedSnapshot.value().orElseThrow();
            triggerAsyncRefreshIfStale(username, cachedSnapshot);
            return snapshot;
        }
        return cacheLoadSingleFlight.execute(
                "user-progress-snapshot:" + normalizeKey(username),
                () -> loadAndCacheSnapshot(username),
                userProgressSnapshotCache::recordRequestMerge
        );
    }

    private ProgressSnapshot loadAndCacheSnapshot(String username) {
        userProgressSnapshotCache.recordLoaderHit();
        LocalDate recentStartDate = LocalDate.now(ZoneOffset.UTC).minusDays(RECENT_WINDOW_DAYS - 1L);
        Instant recentStartInstant = Instant.now().minus(RECENT_WINDOW_DAYS, ChronoUnit.DAYS);

        long visitedCommunitiesAll = userCommunityVisitRepository.countByUsername(username);
        long readPostsAll = userReadMainPostRepository.countByUsername(username);
        long readSecondsAll = userDailyMetricRepository.sumReadSecondsByUsername(username);
        long activeDaysAll = userDailyMetricRepository.countVisitedDaysByUsername(username);
        long likesGivenAll = userDailyMetricRepository.sumLikesGivenByUsername(username);
        long likesReceivedAll = userDailyMetricRepository.sumLikesReceivedByUsername(username);
        long mainPostCommunitiesAll = userCommunityMainPostActivityRepository.countByUsername(username);

        long activeDaysRecent100 = userDailyMetricRepository.countVisitedDaysByUsernameFromDate(username, recentStartDate);
        long likesGivenRecent100 = userDailyMetricRepository.sumLikesGivenByUsernameFromDate(username, recentStartDate);
        long likesReceivedRecent100 = userDailyMetricRepository.sumLikesReceivedByUsernameFromDate(username, recentStartDate);
        long viewedPostsRecent100 = userReadMainPostRepository.countByUsernameAndLastReadAtGreaterThanEqual(username, recentStartInstant);
        long mainPostCommunitiesRecent100 = userCommunityMainPostActivityRepository
                .countByUsernameAndLastMainPostAtGreaterThanEqual(username, recentStartInstant);

        long recentCreatedPosts = recentPostStatsService.countRecentCreatedPosts(RECENT_WINDOW_DAYS);
        long cappedRecentCreatedPosts = Math.min(LV3_RECENT_CREATED_CAP, Math.max(0L, recentCreatedPosts));
        long level3RequiredViewedPosts = (long) Math.ceil(cappedRecentCreatedPosts * LV3_RECENT_VIEW_RATIO);

        ProgressSnapshot snapshot = new ProgressSnapshot(
                visitedCommunitiesAll,
                readPostsAll,
                readSecondsAll,
                activeDaysAll,
                likesGivenAll,
                likesReceivedAll,
                mainPostCommunitiesAll,
                activeDaysRecent100,
                likesGivenRecent100,
                likesReceivedRecent100,
                viewedPostsRecent100,
                mainPostCommunitiesRecent100,
                level3RequiredViewedPosts
        );
        userProgressSnapshotCache.putSnapshot(username, snapshot);
        return snapshot;
    }

    private void triggerAsyncRefreshIfStale(
            String username,
            PlatformCacheReadResult<ProgressSnapshot> cachedSnapshot
    ) {
        if (!cachedSnapshot.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "user-progress-snapshot-refresh:" + normalizeKey(username),
                () -> {
                    try {
                        loadAndCacheSnapshot(username);
                    } catch (RuntimeException error) {
                        log.warn("user_progress_snapshot_async_refresh_failed username={}", username, error);
                    }
                },
                userProgressSnapshotCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            userProgressSnapshotCache.recordRefresh();
            return;
        }
        userProgressSnapshotCache.recordRefreshMerge();
    }

    private String normalizeKey(String username) {
        return username == null ? "" : username.trim();
    }
}
