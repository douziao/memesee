package com.memesee.user.service;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.user.dto.ActivityReportRequest;
import com.memesee.user.dto.ActivityReportResponse;
import com.memesee.user.dto.LevelProgressResponse;
import com.memesee.user.dto.UserProfileResponse;
import com.memesee.user.entity.User;
import com.memesee.user.entity.UserCommunitySubPostActivity;
import com.memesee.user.entity.UserCommunityVisit;
import com.memesee.user.entity.UserDailyMetric;
import com.memesee.user.entity.UserReadMainPost;
import com.memesee.user.repository.UserCommunitySubPostActivityRepository;
import com.memesee.user.repository.UserCommunityVisitRepository;
import com.memesee.user.repository.UserDailyMetricRepository;
import com.memesee.user.repository.UserReadMainPostRepository;
import com.memesee.user.repository.UserRepository;
import com.memesee.user.security.JwtService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserProgressService {

    private static final long LIGHT_ACTIVITY_EVALUATION_COOLDOWN_SECONDS = 30L;
    private static final long READ_SECONDS_EVALUATION_COOLDOWN_SECONDS = 120L;

    private final UserRepository userRepository;
    private final UserDailyMetricRepository userDailyMetricRepository;
    private final UserCommunityVisitRepository userCommunityVisitRepository;
    private final UserCommunitySubPostActivityRepository userCommunitySubPostActivityRepository;
    private final UserReadMainPostRepository userReadMainPostRepository;
    private final JwtService jwtService;
    private final UserProgressSnapshotService userProgressSnapshotService;
    private final UserPromotionPolicy userPromotionPolicy;
    private final UserCacheInvalidationCoordinator cacheInvalidationCoordinator;
    private final ConcurrentHashMap<String, Instant> lastEvaluationAt = new ConcurrentHashMap<>();

    public UserProgressService(
            UserRepository userRepository,
            UserDailyMetricRepository userDailyMetricRepository,
            UserCommunityVisitRepository userCommunityVisitRepository,
            UserCommunitySubPostActivityRepository userCommunitySubPostActivityRepository,
            UserReadMainPostRepository userReadMainPostRepository,
            JwtService jwtService,
            UserProgressSnapshotService userProgressSnapshotService,
            UserPromotionPolicy userPromotionPolicy,
            UserCacheInvalidationCoordinator cacheInvalidationCoordinator
    ) {
        this.userRepository = userRepository;
        this.userDailyMetricRepository = userDailyMetricRepository;
        this.userCommunityVisitRepository = userCommunityVisitRepository;
        this.userCommunitySubPostActivityRepository = userCommunitySubPostActivityRepository;
        this.userReadMainPostRepository = userReadMainPostRepository;
        this.jwtService = jwtService;
        this.userProgressSnapshotService = userProgressSnapshotService;
        this.userPromotionPolicy = userPromotionPolicy;
        this.cacheInvalidationCoordinator = cacheInvalidationCoordinator;
    }

    @Transactional
    public UserProfileResponse buildProfile(User user) {
        PromotionEvaluation evaluation = evaluateAndPromote(user);
        rememberEvaluation(user.getUsername(), Instant.now());
        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getCreatedAt(),
                evaluation.level(),
                evaluation.refreshedToken(),
                evaluation.progress()
        );
    }

    @Transactional
    public ActivityReportResponse reportActivity(User actor, ActivityReportRequest request) {
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "活跃上报内容不能为空。");
        }
        ActivityType activityType = ActivityType.from(request.type());
        Instant now = Instant.now();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        String actorUsername = actor.getUsername();
        boolean forceEvaluate = false;

        switch (activityType) {
            case COMMUNITY_ENTER -> {
                String communitySlug = normalizeCommunitySlug(request.communitySlug());
                if (hasText(communitySlug)) {
                    upsertCommunityVisit(actorUsername, communitySlug, now);
                }
                touchDailyMetric(actorUsername, today, now);
            }
            case MAIN_POST_READ -> {
                Long mainPostId = request.mainPostId();
                String communitySlug = normalizeCommunitySlug(request.communitySlug());
                if (mainPostId != null && mainPostId > 0L) {
                    upsertReadMainPost(actorUsername, mainPostId, communitySlug, now);
                }
                if (hasText(communitySlug)) {
                    upsertCommunityVisit(actorUsername, communitySlug, now);
                }
                touchDailyMetric(actorUsername, today, now);
            }
            case READ_SECONDS -> {
                long seconds = clampSeconds(request.seconds());
                UserDailyMetric metric = getOrCreateDailyMetric(actorUsername, today, now);
                metric.markVisited(now);
                metric.addReadSeconds(seconds, now);
                userDailyMetricRepository.save(metric);
            }
            case LIKE_GIVEN -> {
                UserDailyMetric actorMetric = getOrCreateDailyMetric(actorUsername, today, now);
                actorMetric.markVisited(now);
                actorMetric.incrementLikesGiven(now);
                userDailyMetricRepository.save(actorMetric);
                forceEvaluate = true;

                String targetUsername = normalizeUsername(request.targetUsername());
                if (hasText(targetUsername) && !actorUsername.equalsIgnoreCase(targetUsername)) {
                    userRepository.findByUsername(targetUsername).ifPresent(targetUser -> {
                        UserDailyMetric targetMetric = getOrCreateDailyMetric(targetUser.getUsername(), today, now);
                        targetMetric.incrementLikesReceived(now);
                        userDailyMetricRepository.save(targetMetric);
                        cacheInvalidationCoordinator.onUserProgressChanged(targetUser.getUsername());
                        maybeEvaluateAndPromote(targetUser, activityType, now, true);
                    });
                }
            }
            case SUB_POST_CREATED -> {
                String communitySlug = normalizeCommunitySlug(request.communitySlug());
                if (hasText(communitySlug)) {
                    upsertCommunitySubPostActivity(actorUsername, communitySlug, now);
                }
                if (isNonLobbyCommunity(communitySlug)) {
                    upsertCommunityVisit(actorUsername, communitySlug, now);
                }
                touchDailyMetric(actorUsername, today, now);
                forceEvaluate = true;
            }
        }

        cacheInvalidationCoordinator.onUserProgressChanged(actorUsername);
        PromotionEvaluation actorEvaluation = maybeEvaluateAndPromote(actor, activityType, now, forceEvaluate);
        return new ActivityReportResponse(
                actorEvaluation.level(),
                actorEvaluation.refreshedToken(),
                actorEvaluation.progress()
        );
    }

    private PromotionEvaluation evaluateAndPromote(User user) {
        ProgressSnapshot snapshot = userProgressSnapshotService.loadSnapshot(user.getUsername());
        int promotedLevel = userPromotionPolicy.calculatePromotedLevel(user.getLevel(), snapshot);
        String refreshedToken = null;
        if (promotedLevel != user.getLevel()) {
            user.setLevel(promotedLevel);
            userRepository.save(user);
            refreshedToken = jwtService.generateToken(user.getUsername(), promotedLevel);
        }
        LevelProgressResponse progress = userPromotionPolicy.buildProgress(promotedLevel, snapshot);
        return new PromotionEvaluation(promotedLevel, refreshedToken, progress);
    }

    private PromotionEvaluation maybeEvaluateAndPromote(
            User user,
            ActivityType activityType,
            Instant now,
            boolean forceEvaluate
    ) {
        if (!forceEvaluate && !shouldEvaluateNow(user.getUsername(), activityType, now)) {
            return new PromotionEvaluation(user.getLevel(), null, null);
        }
        PromotionEvaluation evaluation = evaluateAndPromote(user);
        rememberEvaluation(user.getUsername(), now);
        return evaluation;
    }

    private boolean shouldEvaluateNow(String username, ActivityType activityType, Instant now) {
        long cooldownSeconds = switch (activityType) {
            case READ_SECONDS -> READ_SECONDS_EVALUATION_COOLDOWN_SECONDS;
            case COMMUNITY_ENTER, MAIN_POST_READ -> LIGHT_ACTIVITY_EVALUATION_COOLDOWN_SECONDS;
            case LIKE_GIVEN, SUB_POST_CREATED -> 0L;
        };
        if (cooldownSeconds <= 0L) {
            return true;
        }
        Instant last = lastEvaluationAt.get(throttleKey(username));
        return last == null || !last.plusSeconds(cooldownSeconds).isAfter(now);
    }

    private void rememberEvaluation(String username, Instant now) {
        lastEvaluationAt.put(throttleKey(username), now);
    }

    private String throttleKey(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private UserDailyMetric touchDailyMetric(String username, LocalDate date, Instant now) {
        UserDailyMetric metric = getOrCreateDailyMetric(username, date, now);
        metric.markVisited(now);
        return userDailyMetricRepository.save(metric);
    }

    private UserDailyMetric getOrCreateDailyMetric(String username, LocalDate date, Instant now) {
        return userDailyMetricRepository.findByUsernameAndActivityDate(username, date)
                .orElseGet(() -> userDailyMetricRepository.save(new UserDailyMetric(username, date, now)));
    }

    private void upsertCommunityVisit(String username, String communitySlug, Instant now) {
        if (!hasText(communitySlug)) {
            return;
        }
        UserCommunityVisit visit = userCommunityVisitRepository.findByUsernameAndCommunitySlug(username, communitySlug)
                .orElseGet(() -> new UserCommunityVisit(username, communitySlug, now));
        visit.touch(now);
        userCommunityVisitRepository.save(visit);
    }

    private void upsertCommunitySubPostActivity(String username, String communitySlug, Instant now) {
        if (!hasText(communitySlug)) {
            return;
        }
        UserCommunitySubPostActivity activity = userCommunitySubPostActivityRepository
                .findByUsernameAndCommunitySlug(username, communitySlug)
                .orElse(null);
        if (activity == null) {
            userCommunitySubPostActivityRepository.save(new UserCommunitySubPostActivity(username, communitySlug, now));
            return;
        }
        activity.markSubPostCreated(now);
        userCommunitySubPostActivityRepository.save(activity);
    }

    private void upsertReadMainPost(String username, Long mainPostId, String communitySlug, Instant now) {
        if (mainPostId == null || mainPostId <= 0L) {
            return;
        }
        UserReadMainPost readMainPost = userReadMainPostRepository
                .findByUsernameAndMainPostId(username, mainPostId)
                .orElse(null);
        if (readMainPost == null) {
            userReadMainPostRepository.save(new UserReadMainPost(username, mainPostId, communitySlug, now));
            return;
        }
        readMainPost.touch(communitySlug, now);
        userReadMainPostRepository.save(readMainPost);
    }

    private long clampSeconds(Long seconds) {
        if (seconds == null) {
            return 0L;
        }
        return Math.max(0L, Math.min(600L, seconds));
    }

    private String normalizeCommunitySlug(String communitySlug) {
        if (!hasText(communitySlug)) {
            return "";
        }
        return communitySlug.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeUsername(String username) {
        if (!hasText(username)) {
            return "";
        }
        return username.trim();
    }

    private boolean isNonLobbyCommunity(String communitySlug) {
        return hasText(communitySlug) && !"lobby".equalsIgnoreCase(communitySlug.trim());
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private enum ActivityType {
        COMMUNITY_ENTER,
        MAIN_POST_READ,
        READ_SECONDS,
        LIKE_GIVEN,
        SUB_POST_CREATED;

        private static ActivityType from(String rawValue) {
            if (rawValue == null || rawValue.isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "活动类型不能为空。");
            }
            try {
                return ActivityType.valueOf(rawValue.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        ApiErrorCode.INVALID_REQUEST,
                        "不支持的活动类型：" + rawValue
                );
            }
        }
    }

    private record PromotionEvaluation(
            int level,
            String refreshedToken,
            LevelProgressResponse progress
    ) {
    }
}
