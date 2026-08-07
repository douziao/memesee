package com.memesee.user.service;

import com.memesee.user.dto.LevelCriterionProgress;
import com.memesee.user.dto.LevelProgressResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class UserPromotionPolicy {

    private static final int MAX_LEVEL = 3;

    private static final long LEVEL1_REQUIRED_COMMUNITY_VISITS = 4L;
    private static final long LEVEL1_REQUIRED_READ_POSTS = 30L;
    private static final long LEVEL1_REQUIRED_READ_SECONDS = 10L * 60L;

    private static final long LEVEL2_REQUIRED_ACTIVE_DAYS = 15L;
    private static final long LEVEL2_REQUIRED_LIKES_GIVEN = 1L;
    private static final long LEVEL2_REQUIRED_LIKES_RECEIVED = 1L;
    private static final long LEVEL2_REQUIRED_MAIN_POST_COMMUNITIES = 3L;
    private static final long LEVEL2_REQUIRED_COMMUNITY_VISITS = 8L;
    private static final long LEVEL2_REQUIRED_READ_POSTS = 100L;
    private static final long LEVEL2_REQUIRED_READ_SECONDS = 60L * 60L;

    private static final long LEVEL3_REQUIRED_ACTIVE_DAYS = 50L;
    private static final long LEVEL3_REQUIRED_MAIN_POST_COMMUNITIES = 6L;
    private static final long LEVEL3_REQUIRED_LIKES_RECEIVED = 20L;
    private static final long LEVEL3_REQUIRED_LIKES_GIVEN = 30L;

    public int calculatePromotedLevel(int currentLevel, ProgressSnapshot snapshot) {
        int nextLevel = Math.max(0, currentLevel);
        if (nextLevel < 1 && meetsLevel1(snapshot)) {
            nextLevel = 1;
        }
        if (nextLevel < 2 && meetsLevel2(snapshot)) {
            nextLevel = 2;
        }
        if (nextLevel < 3 && meetsLevel3(snapshot)) {
            nextLevel = 3;
        }
        return Math.min(MAX_LEVEL, nextLevel);
    }

    public LevelProgressResponse buildProgress(int currentLevel, ProgressSnapshot snapshot) {
        if (currentLevel >= MAX_LEVEL) {
            return new LevelProgressResponse(currentLevel, null, true, 0, 0, 100, List.of());
        }

        int nextLevel = currentLevel + 1;
        List<LevelCriterionProgress> criteria = new ArrayList<>();
        if (nextLevel == 1) {
            criteria.add(toCriterion("communities_visited", "进入不同社区", snapshot.visitedCommunitiesAll(), LEVEL1_REQUIRED_COMMUNITY_VISITS, "个"));
            criteria.add(toCriterion("read_posts", "累计阅读主帖", snapshot.readPostsAll(), LEVEL1_REQUIRED_READ_POSTS, "篇"));
            criteria.add(toCriterion("read_minutes", "累计阅读时长", toMinutes(snapshot.readSecondsAll()), LEVEL1_REQUIRED_READ_SECONDS / 60L, "分钟"));
        } else if (nextLevel == 2) {
            criteria.add(toCriterion("active_days", "累计活跃天数", snapshot.activeDaysAll(), LEVEL2_REQUIRED_ACTIVE_DAYS, "天"));
            criteria.add(toCriterion("likes_given", "累计点赞次数", snapshot.likesGivenAll(), LEVEL2_REQUIRED_LIKES_GIVEN, "次"));
            criteria.add(toCriterion("likes_received", "累计获得点赞", snapshot.likesReceivedAll(), LEVEL2_REQUIRED_LIKES_RECEIVED, "次"));
            criteria.add(toCriterion("main_post_communities", "主帖覆盖社区", snapshot.mainPostCommunitiesAll(), LEVEL2_REQUIRED_MAIN_POST_COMMUNITIES, "个"));
            criteria.add(toCriterion("communities_visited", "进入不同社区", snapshot.visitedCommunitiesAll(), LEVEL2_REQUIRED_COMMUNITY_VISITS, "个"));
            criteria.add(toCriterion("read_posts", "累计阅读主帖", snapshot.readPostsAll(), LEVEL2_REQUIRED_READ_POSTS, "篇"));
            criteria.add(toCriterion("read_minutes", "累计阅读时长", toMinutes(snapshot.readSecondsAll()), LEVEL2_REQUIRED_READ_SECONDS / 60L, "分钟"));
        } else if (nextLevel == 3) {
            criteria.add(toCriterion("recent_active_days", "近 100 天活跃天数", snapshot.activeDaysRecent100(), LEVEL3_REQUIRED_ACTIVE_DAYS, "天"));
            criteria.add(toCriterion("recent_main_post_communities", "近 100 天主帖覆盖社区", snapshot.mainPostCommunitiesRecent100(), LEVEL3_REQUIRED_MAIN_POST_COMMUNITIES, "个"));
            criteria.add(toCriterion("recent_view_posts_ratio", "近 100 天阅读新主帖", snapshot.viewedPostsRecent100(), snapshot.level3RequiredViewedPosts(), "篇"));
            criteria.add(toCriterion("recent_likes_received", "近 100 天获得点赞", snapshot.likesReceivedRecent100(), LEVEL3_REQUIRED_LIKES_RECEIVED, "次"));
            criteria.add(toCriterion("recent_likes_given", "近 100 天点赞次数", snapshot.likesGivenRecent100(), LEVEL3_REQUIRED_LIKES_GIVEN, "次"));
        }

        int achieved = (int) criteria.stream().filter(LevelCriterionProgress::achieved).count();
        int total = criteria.size();
        int percent = total == 0 ? 100 : (int) Math.round(achieved * 100.0d / total);
        return new LevelProgressResponse(
                currentLevel,
                nextLevel,
                false,
                achieved,
                total,
                Math.max(0, Math.min(100, percent)),
                criteria
        );
    }

    private boolean meetsLevel1(ProgressSnapshot snapshot) {
        return snapshot.visitedCommunitiesAll() >= LEVEL1_REQUIRED_COMMUNITY_VISITS
                && snapshot.readPostsAll() >= LEVEL1_REQUIRED_READ_POSTS
                && snapshot.readSecondsAll() >= LEVEL1_REQUIRED_READ_SECONDS;
    }

    private boolean meetsLevel2(ProgressSnapshot snapshot) {
        return snapshot.activeDaysAll() >= LEVEL2_REQUIRED_ACTIVE_DAYS
                && snapshot.likesGivenAll() >= LEVEL2_REQUIRED_LIKES_GIVEN
                && snapshot.likesReceivedAll() >= LEVEL2_REQUIRED_LIKES_RECEIVED
                && snapshot.mainPostCommunitiesAll() >= LEVEL2_REQUIRED_MAIN_POST_COMMUNITIES
                && snapshot.visitedCommunitiesAll() >= LEVEL2_REQUIRED_COMMUNITY_VISITS
                && snapshot.readPostsAll() >= LEVEL2_REQUIRED_READ_POSTS
                && snapshot.readSecondsAll() >= LEVEL2_REQUIRED_READ_SECONDS;
    }

    private boolean meetsLevel3(ProgressSnapshot snapshot) {
        return snapshot.activeDaysRecent100() >= LEVEL3_REQUIRED_ACTIVE_DAYS
                && snapshot.mainPostCommunitiesRecent100() >= LEVEL3_REQUIRED_MAIN_POST_COMMUNITIES
                && snapshot.viewedPostsRecent100() >= snapshot.level3RequiredViewedPosts()
                && snapshot.likesReceivedRecent100() >= LEVEL3_REQUIRED_LIKES_RECEIVED
                && snapshot.likesGivenRecent100() >= LEVEL3_REQUIRED_LIKES_GIVEN;
    }

    private LevelCriterionProgress toCriterion(
            String key,
            String label,
            long current,
            long required,
            String unit
    ) {
        long normalizedCurrent = Math.max(0L, current);
        long normalizedRequired = Math.max(0L, required);
        boolean achieved = normalizedCurrent >= normalizedRequired;
        return new LevelCriterionProgress(key, label, normalizedCurrent, normalizedRequired, unit, achieved);
    }

    private long toMinutes(long seconds) {
        return Math.max(0L, seconds) / 60L;
    }
}
