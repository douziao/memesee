package com.memesee.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.memesee.user.dto.ActivityReportRequest;
import com.memesee.user.dto.ActivityReportResponse;
import com.memesee.user.entity.User;
import com.memesee.user.entity.UserCommunityVisit;
import com.memesee.user.entity.UserDailyMetric;
import com.memesee.user.entity.UserReadMainPost;
import com.memesee.user.infrastructure.cache.RecentPostStatsCache;
import com.memesee.user.infrastructure.cache.UserProgressSnapshotCache;
import com.memesee.user.repository.UserCommunitySubPostActivityRepository;
import com.memesee.user.repository.UserCommunityVisitRepository;
import com.memesee.user.repository.UserDailyMetricRepository;
import com.memesee.user.repository.UserReadMainPostRepository;
import com.memesee.user.repository.UserRepository;
import com.memesee.user.security.JwtService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class UserProgressServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserDailyMetricRepository userDailyMetricRepository = mock(UserDailyMetricRepository.class);
    private final UserCommunityVisitRepository userCommunityVisitRepository =
            mock(UserCommunityVisitRepository.class);
    private final UserCommunitySubPostActivityRepository userCommunitySubPostActivityRepository =
            mock(UserCommunitySubPostActivityRepository.class);
    private final UserReadMainPostRepository userReadMainPostRepository = mock(UserReadMainPostRepository.class);
    private final RecordingJwtService jwtService = new RecordingJwtService();
    private final RecordingSnapshotService snapshotService = new RecordingSnapshotService();
    private final RecordingProgressSnapshotCache snapshotCache = new RecordingProgressSnapshotCache();
    private final UserCacheInvalidationCoordinator cacheInvalidationCoordinator =
            new UserCacheInvalidationCoordinator(new NoOpRecentPostStatsCache(), snapshotCache);
    private final UserProgressService service = new UserProgressService(
            userRepository,
            userDailyMetricRepository,
            userCommunityVisitRepository,
            userCommunitySubPostActivityRepository,
            userReadMainPostRepository,
            jwtService,
            snapshotService,
            new UserPromotionPolicy(),
            cacheInvalidationCoordinator
    );

    @BeforeEach
    void setUp() {
        when(userDailyMetricRepository.save(any(UserDailyMetric.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(userCommunityVisitRepository.save(any(UserCommunityVisit.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(userReadMainPostRepository.save(any(UserReadMainPost.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void readSecondsAreClampedBeforePromotionAndTokenRefresh() {
        User actor = new User("alice", "hash", Instant.parse("2026-06-08T00:00:00Z"), 0);
        snapshotService.setSnapshot("alice", snapshotBuilder()
                .visitedCommunitiesAll(4)
                .readPostsAll(30)
                .readSecondsAll(600)
                .build());
        when(userDailyMetricRepository.findByUsernameAndActivityDate(anyString(), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        ActivityReportResponse response = service.reportActivity(
                actor,
                new ActivityReportRequest("READ_SECONDS", null, null, 999L, null)
        );

        ArgumentCaptor<UserDailyMetric> metricCaptor = ArgumentCaptor.forClass(UserDailyMetric.class);
        verify(userDailyMetricRepository, org.mockito.Mockito.atLeastOnce()).save(metricCaptor.capture());
        UserDailyMetric latestMetric = metricCaptor.getAllValues().get(metricCaptor.getAllValues().size() - 1);
        assertThat(latestMetric.getUsername()).isEqualTo("alice");
        assertThat(latestMetric.getReadSeconds()).isEqualTo(600L);
        assertThat(latestMetric.isVisited()).isTrue();

        assertThat(actor.getLevel()).isEqualTo(1);
        assertThat(response.level()).isEqualTo(1);
        assertThat(response.refreshedToken()).isEqualTo("jwt-token-for-alice-level-1");
        assertThat(response.progress()).isNotNull();
        assertThat(jwtService.generatedTokens).isEqualTo(1);
        assertThat(snapshotCache.evictedUsers).containsExactly("alice");
    }

    @Test
    void mainPostReadNormalizesCommunitySlugAndRecordsVisit() {
        User actor = new User("alice", "hash", Instant.parse("2026-06-08T00:00:00Z"), 0);
        snapshotService.setSnapshot("alice", snapshotBuilder().build());
        when(userDailyMetricRepository.findByUsernameAndActivityDate(anyString(), any(LocalDate.class)))
                .thenReturn(Optional.empty());
        when(userReadMainPostRepository.findByUsernameAndMainPostId("alice", 42L)).thenReturn(Optional.empty());
        when(userCommunityVisitRepository.findByUsernameAndCommunitySlug("alice", "memes"))
                .thenReturn(Optional.empty());

        service.reportActivity(
                actor,
                new ActivityReportRequest("main_post_read", " MeMes ", 42L, null, null)
        );

        ArgumentCaptor<UserReadMainPost> readCaptor = ArgumentCaptor.forClass(UserReadMainPost.class);
        verify(userReadMainPostRepository).save(readCaptor.capture());
        assertThat(readCaptor.getValue().getUsername()).isEqualTo("alice");
        assertThat(readCaptor.getValue().getMainPostId()).isEqualTo(42L);
        assertThat(readCaptor.getValue().getCommunitySlug()).isEqualTo("memes");

        ArgumentCaptor<UserCommunityVisit> visitCaptor = ArgumentCaptor.forClass(UserCommunityVisit.class);
        verify(userCommunityVisitRepository).save(visitCaptor.capture());
        assertThat(visitCaptor.getValue().getCommunitySlug()).isEqualTo("memes");
        assertThat(snapshotCache.evictedUsers).containsExactly("alice");
    }

    @Test
    void likeGivenUpdatesActorAndTargetButSelfLikeDoesNotIncrementReceivedLikes() {
        User actor = new User("alice", "hash", Instant.parse("2026-06-08T00:00:00Z"), 0);
        User target = new User("bob", "hash", Instant.parse("2026-06-08T00:00:00Z"), 0);
        snapshotService.setSnapshot("alice", snapshotBuilder().build());
        snapshotService.setSnapshot("bob", snapshotBuilder().build());
        when(userDailyMetricRepository.findByUsernameAndActivityDate(anyString(), any(LocalDate.class)))
                .thenReturn(Optional.empty());
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(target));

        service.reportActivity(
                actor,
                new ActivityReportRequest("LIKE_GIVEN", null, null, null, " bob ")
        );

        ArgumentCaptor<UserDailyMetric> metricCaptor = ArgumentCaptor.forClass(UserDailyMetric.class);
        verify(userDailyMetricRepository, org.mockito.Mockito.atLeast(2)).save(metricCaptor.capture());
        List<UserDailyMetric> savedMetrics = metricCaptor.getAllValues();
        UserDailyMetric actorMetric = latestMetricFor(savedMetrics, "alice");
        UserDailyMetric targetMetric = latestMetricFor(savedMetrics, "bob");
        assertThat(actorMetric.getLikesGiven()).isEqualTo(1L);
        assertThat(actorMetric.getLikesReceived()).isZero();
        assertThat(targetMetric.getLikesGiven()).isZero();
        assertThat(targetMetric.getLikesReceived()).isEqualTo(1L);
        assertThat(snapshotCache.evictedUsers).contains("bob", "alice");

        service.reportActivity(
                actor,
                new ActivityReportRequest("LIKE_GIVEN", null, null, null, " ALICE ")
        );

        verify(userRepository, never()).findByUsername("ALICE");
    }

    private UserDailyMetric latestMetricFor(List<UserDailyMetric> metrics, String username) {
        return metrics.stream()
                .filter(metric -> username.equals(metric.getUsername()))
                .reduce((first, second) -> second)
                .orElseThrow();
    }

    private SnapshotBuilder snapshotBuilder() {
        return new SnapshotBuilder();
    }

    private static class RecordingJwtService extends JwtService {
        private int generatedTokens;

        RecordingJwtService() {
            super("test-secret-with-at-least-thirty-two-characters", 86400);
        }

        @Override
        public String generateToken(String username, int userLevel) {
            generatedTokens += 1;
            return "jwt-token-for-" + username + "-level-" + userLevel;
        }
    }

    private static class RecordingSnapshotService extends UserProgressSnapshotService {
        private final Map<String, ProgressSnapshot> snapshots = new LinkedHashMap<>();

        RecordingSnapshotService() {
            super(null, null, null, null, null, null, null);
        }

        private void setSnapshot(String username, ProgressSnapshot snapshot) {
            snapshots.put(username, snapshot);
        }

        @Override
        public ProgressSnapshot loadSnapshot(String username) {
            return snapshots.getOrDefault(username, new SnapshotBuilder().build());
        }
    }

    private static class RecordingProgressSnapshotCache implements UserProgressSnapshotCache {
        private final List<String> evictedUsers = new ArrayList<>();

        @Override
        public Optional<ProgressSnapshot> getSnapshot(String username) {
            return Optional.empty();
        }

        @Override
        public void putSnapshot(String username, ProgressSnapshot snapshot) {
        }

        @Override
        public void evictSnapshot(String username) {
            evictedUsers.add(username);
        }

        @Override
        public void evictAllSnapshots() {
        }
    }

    private static class NoOpRecentPostStatsCache implements RecentPostStatsCache {
        @Override
        public Optional<Long> getRecentCreatedPosts(int days) {
            return Optional.empty();
        }

        @Override
        public void putRecentCreatedPosts(int days, long count) {
        }

        @Override
        public void evictRecentCreatedPosts() {
        }
    }

    private static class SnapshotBuilder {
        private long visitedCommunitiesAll;
        private long readPostsAll;
        private long readSecondsAll;
        private long activeDaysAll;
        private long likesGivenAll;
        private long likesReceivedAll;
        private long mainPostCommunitiesAll;
        private long activeDaysRecent100;
        private long likesGivenRecent100;
        private long likesReceivedRecent100;
        private long viewedPostsRecent100;
        private long mainPostCommunitiesRecent100;
        private long level3RequiredViewedPosts;

        private SnapshotBuilder visitedCommunitiesAll(long value) {
            visitedCommunitiesAll = value;
            return this;
        }

        private SnapshotBuilder readPostsAll(long value) {
            readPostsAll = value;
            return this;
        }

        private SnapshotBuilder readSecondsAll(long value) {
            readSecondsAll = value;
            return this;
        }

        private ProgressSnapshot build() {
            return new ProgressSnapshot(
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
        }
    }
}
