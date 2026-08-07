package com.memesee.user.service;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.user.entity.UserCommunityMainPostActivity;
import com.memesee.user.entity.UserCommunityVisit;
import com.memesee.user.entity.UserDailyMetric;
import com.memesee.user.repository.UserCommunityMainPostActivityRepository;
import com.memesee.user.repository.UserCommunityVisitRepository;
import com.memesee.user.repository.UserDailyMetricRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserPostEventApplicationService {

    private final RecentPostStatsService recentPostStatsService;
    private final UserCommunityMainPostActivityRepository userCommunityMainPostActivityRepository;
    private final UserCommunityVisitRepository userCommunityVisitRepository;
    private final UserDailyMetricRepository userDailyMetricRepository;
    private final UserCacheInvalidationCoordinator cacheInvalidationCoordinator;

    public UserPostEventApplicationService(
            RecentPostStatsService recentPostStatsService,
            UserCommunityMainPostActivityRepository userCommunityMainPostActivityRepository,
            UserCommunityVisitRepository userCommunityVisitRepository,
            UserDailyMetricRepository userDailyMetricRepository,
            UserCacheInvalidationCoordinator cacheInvalidationCoordinator
    ) {
        this.recentPostStatsService = recentPostStatsService;
        this.userCommunityMainPostActivityRepository = userCommunityMainPostActivityRepository;
        this.userCommunityVisitRepository = userCommunityVisitRepository;
        this.userDailyMetricRepository = userDailyMetricRepository;
        this.cacheInvalidationCoordinator = cacheInvalidationCoordinator;
    }

    @Transactional
    public void recordMainPostCreated(Long mainPostId, String authorUsername, String communitySlug, Instant occurredAt) {
        requireMainPostId(mainPostId);
        String normalizedAuthorUsername = normalizeRequiredUsername(authorUsername);
        String normalizedCommunitySlug = normalizeRequiredCommunitySlug(communitySlug);
        Instant safeOccurredAt = occurredAt == null ? Instant.now() : occurredAt;
        recentPostStatsService.recordPostCreated(mainPostId, safeOccurredAt);
        upsertCommunityMainPostActivity(normalizedAuthorUsername, normalizedCommunitySlug, safeOccurredAt);
        if (isNonLobbyCommunity(normalizedCommunitySlug)) {
            upsertCommunityVisit(normalizedAuthorUsername, normalizedCommunitySlug, safeOccurredAt);
        }
        touchDailyMetric(normalizedAuthorUsername, safeOccurredAt);
        cacheInvalidationCoordinator.onUserProgressChanged(normalizedAuthorUsername);
    }

    @Transactional
    public void recordMainPostDeleted(Long mainPostId, String authorUsername, String communitySlug, Instant occurredAt) {
        requireMainPostId(mainPostId);
        String normalizedAuthorUsername = normalizeRequiredUsername(authorUsername);
        String normalizedCommunitySlug = normalizeRequiredCommunitySlug(communitySlug);
        Instant safeOccurredAt = occurredAt == null ? Instant.now() : occurredAt;
        decrementCommunityMainPostActivity(normalizedAuthorUsername, normalizedCommunitySlug, safeOccurredAt);
        cacheInvalidationCoordinator.onUserProgressChanged(normalizedAuthorUsername);
    }

    private void requireMainPostId(Long mainPostId) {
        if (mainPostId == null || mainPostId <= 0L) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "mainPostId 不能为空。");
        }
    }

    private void upsertCommunityMainPostActivity(String username, String communitySlug, Instant now) {
        UserCommunityMainPostActivity activity = userCommunityMainPostActivityRepository
                .findByUsernameAndCommunitySlug(username, communitySlug)
                .orElse(null);
        if (activity == null) {
            userCommunityMainPostActivityRepository.save(new UserCommunityMainPostActivity(username, communitySlug, now));
            return;
        }
        activity.markMainPostCreated(now);
        userCommunityMainPostActivityRepository.save(activity);
    }

    private void decrementCommunityMainPostActivity(String username, String communitySlug, Instant now) {
        UserCommunityMainPostActivity activity = userCommunityMainPostActivityRepository
                .findByUsernameAndCommunitySlug(username, communitySlug)
                .orElse(null);
        if (activity == null) {
            return;
        }
        if (activity.getMainPostCount() <= 1L) {
            userCommunityMainPostActivityRepository.delete(activity);
            return;
        }
        activity.markMainPostDeleted(now);
        userCommunityMainPostActivityRepository.save(activity);
    }

    private void upsertCommunityVisit(String username, String communitySlug, Instant now) {
        UserCommunityVisit visit = userCommunityVisitRepository.findByUsernameAndCommunitySlug(username, communitySlug)
                .orElseGet(() -> new UserCommunityVisit(username, communitySlug, now));
        visit.touch(now);
        userCommunityVisitRepository.save(visit);
    }

    private void touchDailyMetric(String username, Instant now) {
        LocalDate date = now.atZone(ZoneOffset.UTC).toLocalDate();
        UserDailyMetric metric = userDailyMetricRepository.findByUsernameAndActivityDate(username, date)
                .orElseGet(() -> userDailyMetricRepository.save(new UserDailyMetric(username, date, now)));
        metric.markVisited(now);
        userDailyMetricRepository.save(metric);
    }

    private String normalizeRequiredUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "作者不能为空。");
        }
        return username.trim();
    }

    private String normalizeRequiredCommunitySlug(String communitySlug) {
        if (communitySlug == null || communitySlug.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "社区标识不能为空。");
        }
        return communitySlug.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isNonLobbyCommunity(String communitySlug) {
        return communitySlug != null && !"lobby".equalsIgnoreCase(communitySlug.trim());
    }
}
