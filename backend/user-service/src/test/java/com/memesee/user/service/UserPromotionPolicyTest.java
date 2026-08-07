package com.memesee.user.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.memesee.user.dto.LevelCriterionProgress;
import com.memesee.user.dto.LevelProgressResponse;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class UserPromotionPolicyTest {

    private final UserPromotionPolicy policy = new UserPromotionPolicy();

    @Test
    void keepsLevelWhenAnyLevelOneRequirementIsMissing() {
        ProgressSnapshot snapshot = snapshotBuilder()
                .visitedCommunitiesAll(4)
                .readPostsAll(30)
                .readSecondsAll(599)
                .build();

        assertThat(policy.calculatePromotedLevel(0, snapshot)).isZero();
    }

    @Test
    void promotesToLevelOneWhenAllLevelOneRequirementsAreMet() {
        ProgressSnapshot snapshot = snapshotBuilder()
                .visitedCommunitiesAll(4)
                .readPostsAll(30)
                .readSecondsAll(600)
                .build();

        assertThat(policy.calculatePromotedLevel(0, snapshot)).isEqualTo(1);
    }

    @Test
    void canPromoteDirectlyToLevelTwoWhenAllLevelTwoRequirementsAreMet() {
        ProgressSnapshot snapshot = snapshotBuilder()
                .visitedCommunitiesAll(8)
                .readPostsAll(100)
                .readSecondsAll(3600)
                .activeDaysAll(15)
                .likesGivenAll(1)
                .likesReceivedAll(1)
                .mainPostCommunitiesAll(3)
                .build();

        assertThat(policy.calculatePromotedLevel(0, snapshot)).isEqualTo(2);
    }

    @Test
    void promotesToLevelThreeOnlyWhenRecentRequirementsAreMet() {
        ProgressSnapshot missingRecentViews = snapshotBuilder()
                .activeDaysRecent100(50)
                .mainPostCommunitiesRecent100(6)
                .viewedPostsRecent100(24)
                .level3RequiredViewedPosts(25)
                .likesReceivedRecent100(20)
                .likesGivenRecent100(30)
                .build();
        ProgressSnapshot readyForLevelThree = snapshotBuilder()
                .activeDaysRecent100(50)
                .mainPostCommunitiesRecent100(6)
                .viewedPostsRecent100(25)
                .level3RequiredViewedPosts(25)
                .likesReceivedRecent100(20)
                .likesGivenRecent100(30)
                .build();

        assertThat(policy.calculatePromotedLevel(2, missingRecentViews)).isEqualTo(2);
        assertThat(policy.calculatePromotedLevel(2, readyForLevelThree)).isEqualTo(3);
    }

    @Test
    void buildsLevelOneProgressWithNormalizedCriteriaAndCompletionPercent() {
        ProgressSnapshot snapshot = snapshotBuilder()
                .visitedCommunitiesAll(4)
                .readPostsAll(29)
                .readSecondsAll(-60)
                .build();

        LevelProgressResponse progress = policy.buildProgress(0, snapshot);

        assertThat(progress.currentLevel()).isZero();
        assertThat(progress.nextLevel()).isEqualTo(1);
        assertThat(progress.maxLevel()).isFalse();
        assertThat(progress.achievedCount()).isEqualTo(1);
        assertThat(progress.totalCount()).isEqualTo(3);
        assertThat(progress.completionPercent()).isEqualTo(33);

        Map<String, LevelCriterionProgress> criteriaByKey = progress.criteria().stream()
                .collect(Collectors.toMap(LevelCriterionProgress::key, Function.identity()));
        assertThat(criteriaByKey.get("communities_visited").achieved()).isTrue();
        assertThat(criteriaByKey.get("read_posts").achieved()).isFalse();
        assertThat(criteriaByKey.get("read_minutes").current()).isZero();
        assertThat(criteriaByKey.get("read_minutes").required()).isEqualTo(10);
    }

    @Test
    void buildsMaxLevelProgressWithoutNextLevelCriteria() {
        LevelProgressResponse progress = policy.buildProgress(3, snapshotBuilder().build());

        assertThat(progress.currentLevel()).isEqualTo(3);
        assertThat(progress.nextLevel()).isNull();
        assertThat(progress.maxLevel()).isTrue();
        assertThat(progress.achievedCount()).isZero();
        assertThat(progress.totalCount()).isZero();
        assertThat(progress.completionPercent()).isEqualTo(100);
        assertThat(progress.criteria()).isEmpty();
    }

    private SnapshotBuilder snapshotBuilder() {
        return new SnapshotBuilder();
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

        private SnapshotBuilder activeDaysAll(long value) {
            activeDaysAll = value;
            return this;
        }

        private SnapshotBuilder likesGivenAll(long value) {
            likesGivenAll = value;
            return this;
        }

        private SnapshotBuilder likesReceivedAll(long value) {
            likesReceivedAll = value;
            return this;
        }

        private SnapshotBuilder mainPostCommunitiesAll(long value) {
            mainPostCommunitiesAll = value;
            return this;
        }

        private SnapshotBuilder activeDaysRecent100(long value) {
            activeDaysRecent100 = value;
            return this;
        }

        private SnapshotBuilder likesGivenRecent100(long value) {
            likesGivenRecent100 = value;
            return this;
        }

        private SnapshotBuilder likesReceivedRecent100(long value) {
            likesReceivedRecent100 = value;
            return this;
        }

        private SnapshotBuilder viewedPostsRecent100(long value) {
            viewedPostsRecent100 = value;
            return this;
        }

        private SnapshotBuilder mainPostCommunitiesRecent100(long value) {
            mainPostCommunitiesRecent100 = value;
            return this;
        }

        private SnapshotBuilder level3RequiredViewedPosts(long value) {
            level3RequiredViewedPosts = value;
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
