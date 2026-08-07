package com.memesee.content.notification.application;

import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.common.application.ContentCacheInvalidationCoordinator;
import com.memesee.content.common.application.ContentReferenceAvailabilityService;
import com.memesee.content.common.outbox.application.ContentOutboxService;
import com.memesee.content.notification.dto.NotificationItemResponse;
import com.memesee.content.notification.dto.NotificationListResponse;
import com.memesee.content.notification.dto.NotificationReadStateResponse;
import com.memesee.content.notification.application.NotificationListProjectionPort.NotificationListItemProjection;
import com.memesee.content.notification.application.NotificationListProjectionPort.NotificationListProjectionQuery;
import com.memesee.content.notification.domain.ContentNotification;
import com.memesee.content.notification.domain.NotificationType;
import com.memesee.content.notification.infrastructure.ContentNotificationRepository;
import com.memesee.content.notification.infrastructure.NotificationListCache;
import com.memesee.content.notification.infrastructure.NotificationListCacheKey;
import com.memesee.content.notification.infrastructure.NotificationUnreadCountCache;
import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformSingleFlight;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationApplicationService
        implements NotificationCollaborationApplicationService, NotificationReferenceInvalidator {

    private static final Logger log = LoggerFactory.getLogger(NotificationApplicationService.class);

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;
    private static final String POST_DELETED_REASON = "post-deleted";
    private static final String SUB_POST_DELETED_REASON = "sub-post-deleted";
    private static final String DELETED_POST_NOTIFICATION_TITLE = "关联主帖已删除";
    private static final String DELETED_POST_NOTIFICATION_BODY = "这条通知关联的主帖已删除。";
    private static final String DELETED_SUB_POST_NOTIFICATION_TITLE = "关联子帖已删除";
    private static final String DELETED_SUB_POST_NOTIFICATION_BODY = "这条通知关联的子帖已删除。";

    private final NotificationListProjectionPort notificationListProjectionPort;
    private final NotificationUnreadCountProjectionPort notificationUnreadCountProjectionPort;
    private final ContentNotificationRepository contentNotificationRepository;
    private final ContentReferenceAvailabilityService referenceAvailabilityService;
    private final AuthContextResolver authContextResolver;
    private final NotificationListCache notificationListCache;
    private final NotificationUnreadCountCache notificationUnreadCountCache;
    private final ContentOutboxService contentOutboxService;
    private final ContentCacheInvalidationCoordinator cacheInvalidationCoordinator;
    private final PlatformAsyncRefreshCoordinator asyncRefreshCoordinator;
    private final PlatformSingleFlight cacheLoadSingleFlight = new PlatformSingleFlight();
    private final PlatformSingleFlight unreadCountLoadSingleFlight = new PlatformSingleFlight();

    @Autowired
    public NotificationApplicationService(
            NotificationListProjectionPort notificationListProjectionPort,
            NotificationUnreadCountProjectionPort notificationUnreadCountProjectionPort,
            ContentNotificationRepository contentNotificationRepository,
            ContentReferenceAvailabilityService referenceAvailabilityService,
            AuthContextResolver authContextResolver,
            NotificationListCache notificationListCache,
            NotificationUnreadCountCache notificationUnreadCountCache,
            ContentOutboxService contentOutboxService,
            ContentCacheInvalidationCoordinator cacheInvalidationCoordinator
    ) {
        this(
                notificationListProjectionPort,
                notificationUnreadCountProjectionPort,
                contentNotificationRepository,
                referenceAvailabilityService,
                authContextResolver,
                notificationListCache,
                notificationUnreadCountCache,
                contentOutboxService,
                cacheInvalidationCoordinator,
                new PlatformAsyncRefreshCoordinator()
        );
    }

    NotificationApplicationService(
            NotificationListProjectionPort notificationListProjectionPort,
            NotificationUnreadCountProjectionPort notificationUnreadCountProjectionPort,
            ContentNotificationRepository contentNotificationRepository,
            ContentReferenceAvailabilityService referenceAvailabilityService,
            AuthContextResolver authContextResolver,
            NotificationListCache notificationListCache,
            NotificationUnreadCountCache notificationUnreadCountCache,
            ContentOutboxService contentOutboxService,
            ContentCacheInvalidationCoordinator cacheInvalidationCoordinator,
            PlatformAsyncRefreshCoordinator asyncRefreshCoordinator
    ) {
        this.notificationListProjectionPort = notificationListProjectionPort;
        this.notificationUnreadCountProjectionPort = notificationUnreadCountProjectionPort;
        this.contentNotificationRepository = contentNotificationRepository;
        this.referenceAvailabilityService = referenceAvailabilityService;
        this.authContextResolver = authContextResolver;
        this.notificationListCache = notificationListCache;
        this.notificationUnreadCountCache = notificationUnreadCountCache;
        this.contentOutboxService = contentOutboxService;
        this.cacheInvalidationCoordinator = cacheInvalidationCoordinator;
        this.asyncRefreshCoordinator = asyncRefreshCoordinator;
    }

    @Transactional(readOnly = true)
    public NotificationListResponse listNotifications(
            String authorizationHeader,
            Integer limit,
            Boolean unread,
            String type,
            String actorUsername
    ) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        NotificationListCacheKey cacheKey = new NotificationListCacheKey(
                authContext.username(),
                normalizeLimit(limit),
                normalizeType(type),
                unread,
                normalizeActorUsername(actorUsername)
        );
        PlatformCacheReadResult<NotificationListResponse> cachedSnapshot =
                notificationListCache.getNotificationListSnapshot(cacheKey);
        if (cachedSnapshot.value().isPresent()) {
            NotificationListResponse cachedResponse = cachedSnapshot.value().orElseThrow();
            NotificationListResponse privacyCheckedResponse = filterUnavailableCachedNotifications(
                    cacheKey,
                    cachedResponse
            );
            triggerAsyncNotificationListRefreshIfStale(cacheKey, cachedSnapshot);
            return privacyCheckedResponse;
        }
        return cacheLoadSingleFlight.execute(
                buildNotificationListSingleFlightKey(cacheKey),
                () -> {
                    notificationListCache.recordLoaderHit();
                    return refreshNotificationList(cacheKey);
                },
                notificationListCache::recordRequestMerge
        );
    }

    private NotificationListResponse refreshNotificationList(NotificationListCacheKey cacheKey) {
        List<NotificationListItemProjection> notifications = notificationListProjectionPort.loadNotifications(
                new NotificationListProjectionQuery(
                        cacheKey.username(),
                        cacheKey.type() == null ? null : NotificationType.valueOf(cacheKey.type()),
                        cacheKey.unread(),
                        cacheKey.actorUsername(),
                        cacheKey.limit()
                )
        );
        Set<Long> activeMainPostIds = loadActiveMainPostIds(notifications);
        Set<Long> activeSubPostIds = loadActiveSubPostIds(notifications);
        List<NotificationItemResponse> items = notifications.stream()
                .map(notification -> toResponse(notification, activeMainPostIds, activeSubPostIds))
                .toList();
        long unreadCount = loadUnreadCount(cacheKey.username());
        NotificationListResponse response = new NotificationListResponse(unreadCount, items);
        notificationListCache.putNotificationList(cacheKey, response);
        return response;
    }

    private NotificationListResponse filterUnavailableCachedNotifications(
            NotificationListCacheKey cacheKey,
            NotificationListResponse cachedResponse
    ) {
        if (cachedResponse == null) {
            return new NotificationListResponse(0L, List.of());
        }
        List<NotificationItemResponse> cachedItems =
                cachedResponse.items() == null ? List.of() : cachedResponse.items();
        Set<Long> activeMainPostIds = loadActiveMainPostIdsFromIds(cachedItems.stream()
                .map(NotificationItemResponse::mainPostId)
                .toList());
        Set<Long> activeSubPostIds = loadActiveSubPostIdsFromIds(cachedItems.stream()
                .map(NotificationItemResponse::subPostId)
                .toList());
        List<NotificationItemResponse> sanitizedItems = cachedItems.stream()
                .map(notification -> toResponse(notification, activeMainPostIds, activeSubPostIds))
                .toList();
        NotificationListResponse sanitizedResponse =
                new NotificationListResponse(cachedResponse.unreadCount(), sanitizedItems);
        if (sanitizedResponse.equals(cachedResponse)) {
            return cachedResponse;
        }
        notificationListCache.evictNotificationLists(cacheKey.username());
        try {
            notificationListCache.recordLoaderHit();
            return refreshNotificationList(cacheKey);
        } catch (RuntimeException error) {
            log.warn("notification_list_cache_privacy_refresh_failed key={}", cacheKey, error);
            return sanitizedResponse;
        }
    }

    @Transactional
    public NotificationReadStateResponse markAllRead(String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        List<ContentNotification> notifications = contentNotificationRepository.findAllByUsername(authContext.username());
        notifications.forEach(ContentNotification::markRead);
        cacheInvalidationCoordinator.onNotificationChanged(authContext.username());
        long unreadCount = loadFreshUnreadCount(authContext.username());
        return new NotificationReadStateResponse(unreadCount);
    }

    @Transactional
    public NotificationReadStateResponse markRead(String authorizationHeader, Long notificationId) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        ContentNotification notification = contentNotificationRepository.findByIdAndUsername(notificationId, authContext.username())
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        ApiErrorCode.RESOURCE_NOT_FOUND,
                        "\u901a\u77e5\u4e0d\u5b58\u5728\u3002"
        ));
        notification.markRead();
        cacheInvalidationCoordinator.onNotificationChanged(authContext.username());
        long unreadCount = loadFreshUnreadCount(authContext.username());
        return new NotificationReadStateResponse(unreadCount);
    }

    @Override
    @Transactional(readOnly = true)
    public void invalidateNotificationsReferencingMainPost(Long mainPostId) {
        Long requiredMainPostId = requirePositiveId(mainPostId, "mainPostId");
        contentNotificationRepository.findDistinctUsernamesByMainPostId(requiredMainPostId).stream()
                .map(this::normalizeUsername)
                .filter(username -> !username.isBlank())
                .distinct()
                .forEach(cacheInvalidationCoordinator::onNotificationChanged);
    }

    @Override
    @Transactional(readOnly = true)
    public void invalidateNotificationsReferencingSubPost(Long subPostId) {
        Long requiredSubPostId = requirePositiveId(subPostId, "subPostId");
        contentNotificationRepository.findDistinctUsernamesBySubPostId(requiredSubPostId).stream()
                .map(this::normalizeUsername)
                .filter(username -> !username.isBlank())
                .distinct()
                .forEach(cacheInvalidationCoordinator::onNotificationChanged);
    }

    @Transactional
    public void notifyMainPostLiked(String recipientUsername, String actorUsername, Long mainPostId, String mainPostTitle) {
        saveNotification(
                recipientUsername,
                actorUsername,
                NotificationType.MAIN_POST_LIKED,
                "\u4f60\u7684\u4e3b\u5e16\u6536\u5230\u4e86\u65b0\u7684\u70b9\u8d5e",
                actorUsername + "\u70b9\u8d5e\u4e86\u300a" + normalizeTitle(mainPostTitle) + "\u300b",
                mainPostId,
                null
        );
    }

    @Transactional
    public void notifyMainPostFavorited(String recipientUsername, String actorUsername, Long mainPostId, String mainPostTitle) {
        saveNotification(
                recipientUsername,
                actorUsername,
                NotificationType.MAIN_POST_FAVORITED,
                "\u4f60\u7684\u4e3b\u5e16\u88ab\u6536\u85cf\u4e86",
                actorUsername + "\u6536\u85cf\u4e86\u300a" + normalizeTitle(mainPostTitle) + "\u300b",
                mainPostId,
                null
        );
    }

    @Transactional
    public void notifySubPostCreated(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    ) {
        saveNotification(
                recipientUsername,
                actorUsername,
                NotificationType.SUB_POST_CREATED,
                "\u4f60\u7684\u4e3b\u5e16\u6536\u5230\u4e86\u65b0\u5b50\u5e16",
                actorUsername + "\u5728\u300a" + normalizeTitle(mainPostTitle) + "\u300b\u4e0b\u53d1\u5e03\uff1a" + normalizePreview(subPostPreview),
                mainPostId,
                subPostId
        );
    }

    @Transactional
    public void notifySubPostReplied(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    ) {
        saveNotification(
                recipientUsername,
                actorUsername,
                NotificationType.SUB_POST_REPLIED,
                "\u4f60\u7684\u5b50\u5e16\u6536\u5230\u4e86\u65b0\u56de\u590d",
                actorUsername + "\u5728\u300a" + normalizeTitle(mainPostTitle) + "\u300b\u4e0b\u56de\u590d\uff1a" + normalizePreview(subPostPreview),
                mainPostId,
                subPostId
        );
    }

    @Transactional
    public void notifySubPostLiked(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    ) {
        saveNotification(
                recipientUsername,
                actorUsername,
                NotificationType.SUB_POST_LIKED,
                "\u4f60\u7684\u5b50\u5e16\u6536\u5230\u4e86\u65b0\u7684\u70b9\u8d5e",
                actorUsername + "\u70b9\u8d5e\u4e86\u300a" + normalizeTitle(mainPostTitle) + "\u300b\u4e0b\u7684\u5b50\u5e16\uff1a" + normalizePreview(subPostPreview),
                mainPostId,
                subPostId
        );
    }

    @Transactional
    public void notifySubPostFavorited(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    ) {
        saveNotification(
                recipientUsername,
                actorUsername,
                NotificationType.SUB_POST_FAVORITED,
                "\u4f60\u7684\u5b50\u5e16\u88ab\u6536\u85cf\u4e86",
                actorUsername + "\u6536\u85cf\u4e86\u300a" + normalizeTitle(mainPostTitle) + "\u300b\u4e0b\u7684\u5b50\u5e16\uff1a" + normalizePreview(subPostPreview),
                mainPostId,
                subPostId
        );
    }

    private void saveNotification(
            String recipientUsername,
            String actorUsername,
            NotificationType type,
            String title,
            String body,
            Long mainPostId,
            Long subPostId
    ) {
        String normalizedRecipient = normalizeUsername(recipientUsername);
        String normalizedActor = normalizeUsername(actorUsername);
        if (normalizedRecipient.isBlank() || normalizedActor.isBlank()) {
            return;
        }
        if (normalizedRecipient.equalsIgnoreCase(normalizedActor)) {
            return;
        }
        if (hasDuplicateInteractionNotification(
                normalizedRecipient,
                normalizedActor,
                type,
                mainPostId,
                subPostId
        )) {
            return;
        }
        ContentNotification notification = new ContentNotification(
                normalizedRecipient,
                type,
                title,
                truncate(body, 500),
                mainPostId,
                subPostId,
                normalizedActor
        );
        notification.assignDedupeKey(buildInteractionNotificationDedupeKey(
                normalizedRecipient,
                normalizedActor,
                type,
                mainPostId,
                subPostId
        ));
        ContentNotification savedNotification = contentNotificationRepository.save(notification);
        contentOutboxService.append(
                "notification",
                String.valueOf(savedNotification.getId()),
                "content.notification.created",
                new NotificationCreatedOutboxPayload(
                        savedNotification.getId(),
                        savedNotification.getUsername(),
                        savedNotification.getActorUsername(),
                        savedNotification.getType().name(),
                        savedNotification.getTitle(),
                        savedNotification.getBody(),
                        savedNotification.getMainPostId(),
                        savedNotification.getSubPostId(),
                        savedNotification.getCreatedAt()
                )
        );
        cacheInvalidationCoordinator.onNotificationChanged(normalizedRecipient);
    }

    private boolean hasDuplicateInteractionNotification(
            String recipientUsername,
            String actorUsername,
            NotificationType type,
            Long mainPostId,
            Long subPostId
    ) {
        if (!isInteractionNotification(type)) {
            return false;
        }
        if (subPostId == null) {
            return contentNotificationRepository.existsByUsernameAndTypeAndActorUsernameAndMainPostIdAndSubPostIdIsNull(
                    recipientUsername,
                    type,
                    actorUsername,
                    mainPostId
            );
        }
        return contentNotificationRepository.existsByUsernameAndTypeAndActorUsernameAndMainPostIdAndSubPostId(
                recipientUsername,
                type,
                actorUsername,
                mainPostId,
                subPostId
        );
    }

    private String buildInteractionNotificationDedupeKey(
            String recipientUsername,
            String actorUsername,
            NotificationType type,
            Long mainPostId,
            Long subPostId
    ) {
        if (!isInteractionNotification(type)) {
            return null;
        }
        return type.name()
                + ":"
                + recipientUsername
                + ":"
                + actorUsername
                + ":"
                + mainPostId
                + ":"
                + (subPostId == null ? "-" : subPostId);
    }

    private boolean isInteractionNotification(NotificationType type) {
        return type == NotificationType.MAIN_POST_LIKED
                || type == NotificationType.MAIN_POST_FAVORITED
                || type == NotificationType.SUB_POST_LIKED
                || type == NotificationType.SUB_POST_FAVORITED;
    }

    private long loadUnreadCount(String username) {
        PlatformCacheReadResult<Long> cachedUnreadCount = notificationUnreadCountCache.getUnreadCountSnapshot(username);
        if (cachedUnreadCount.value().isPresent()) {
            triggerAsyncUnreadCountRefreshIfStale(username, cachedUnreadCount);
            return cachedUnreadCount.value().orElseThrow();
        }
        return unreadCountLoadSingleFlight.execute(
                buildNotificationUnreadCountSingleFlightKey(username),
                () -> refreshUnreadCount(username),
                notificationUnreadCountCache::recordRequestMerge
        );
    }

    private long refreshUnreadCount(String username) {
        notificationUnreadCountCache.recordLoaderHit();
        long unreadCount = notificationUnreadCountProjectionPort.loadUnreadCount(username);
        notificationUnreadCountCache.putUnreadCount(username, unreadCount);
        return unreadCount;
    }

    private long loadFreshUnreadCount(String username) {
        return notificationUnreadCountProjectionPort.loadUnreadCount(username);
    }

    private void triggerAsyncUnreadCountRefreshIfStale(String username, PlatformCacheReadResult<Long> cachedUnreadCount) {
        if (!cachedUnreadCount.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "notification-unread-count-refresh:" + username,
                () -> {
                    try {
                        refreshUnreadCount(username);
                    } catch (RuntimeException error) {
                        log.warn("notification_unread_count_async_refresh_failed username={}", username, error);
                    }
                },
                notificationUnreadCountCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            notificationUnreadCountCache.recordRefresh();
            return;
        }
        notificationUnreadCountCache.recordRefreshMerge();
    }

    private void triggerAsyncNotificationListRefreshIfStale(
            NotificationListCacheKey cacheKey,
            PlatformCacheReadResult<NotificationListResponse> cachedSnapshot
    ) {
        if (!cachedSnapshot.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "notification-list-refresh:" + String.valueOf(cacheKey),
                () -> {
                    try {
                        notificationListCache.recordLoaderHit();
                        refreshNotificationList(cacheKey);
                    } catch (RuntimeException error) {
                        log.warn("notification_list_async_refresh_failed key={}", cacheKey, error);
                    }
                },
                notificationListCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            notificationListCache.recordRefresh();
            return;
        }
        notificationListCache.recordRefreshMerge();
    }

    private String buildNotificationListSingleFlightKey(NotificationListCacheKey cacheKey) {
        return "notification-list:" + String.valueOf(cacheKey);
    }

    private String buildNotificationUnreadCountSingleFlightKey(String username) {
        return "notification-unread-count:" + username;
    }

    private NotificationItemResponse toResponse(ContentNotification notification) {
        return new NotificationItemResponse(
                notification.getId(),
                notification.getType().name(),
                notification.getTitle(),
                notification.getBody(),
                notification.getMainPostId(),
                notification.getSubPostId(),
                notification.getActorUsername(),
                notification.getCreatedAt(),
                notification.isRead(),
                ""
        );
    }

    private NotificationItemResponse toResponse(
            NotificationListItemProjection notification,
            Set<Long> activeMainPostIds,
            Set<Long> activeSubPostIds
    ) {
        String unavailableReason = resolveUnavailableReason(
                notification.mainPostId(),
                notification.subPostId(),
                activeMainPostIds,
                activeSubPostIds
        );
        return new NotificationItemResponse(
                notification.id(),
                notification.type().name(),
                notificationResponseTitle(notification.title(), unavailableReason),
                notificationResponseBody(notification.body(), unavailableReason),
                notification.mainPostId(),
                notification.subPostId(),
                notification.actorUsername(),
                notification.createdAt(),
                notification.read(),
                unavailableReason
        );
    }

    private NotificationItemResponse toResponse(
            NotificationItemResponse notification,
            Set<Long> activeMainPostIds,
            Set<Long> activeSubPostIds
    ) {
        String unavailableReason = resolveUnavailableReason(
                notification.mainPostId(),
                notification.subPostId(),
                activeMainPostIds,
                activeSubPostIds
        );
        return new NotificationItemResponse(
                notification.id(),
                notification.type(),
                notificationResponseTitle(notification.title(), unavailableReason),
                notificationResponseBody(notification.body(), unavailableReason),
                notification.mainPostId(),
                notification.subPostId(),
                notification.actorUsername(),
                notification.createdAt(),
                notification.read(),
                unavailableReason
        );
    }

    private String notificationResponseTitle(String title, String unavailableReason) {
        if (POST_DELETED_REASON.equals(unavailableReason)) {
            return DELETED_POST_NOTIFICATION_TITLE;
        }
        if (SUB_POST_DELETED_REASON.equals(unavailableReason)) {
            return DELETED_SUB_POST_NOTIFICATION_TITLE;
        }
        return title;
    }

    private String notificationResponseBody(String body, String unavailableReason) {
        if (POST_DELETED_REASON.equals(unavailableReason)) {
            return DELETED_POST_NOTIFICATION_BODY;
        }
        if (SUB_POST_DELETED_REASON.equals(unavailableReason)) {
            return DELETED_SUB_POST_NOTIFICATION_BODY;
        }
        return body;
    }

    private Set<Long> loadActiveMainPostIds(List<NotificationListItemProjection> notifications) {
        return loadActiveMainPostIdsFromIds(notifications.stream()
                .map(NotificationListItemProjection::mainPostId)
                .toList());
    }

    private Set<Long> loadActiveMainPostIdsFromIds(Collection<Long> rawMainPostIds) {
        return referenceAvailabilityService.loadActiveMainPostIds(rawMainPostIds);
    }

    private Set<Long> loadActiveSubPostIds(List<NotificationListItemProjection> notifications) {
        return loadActiveSubPostIdsFromIds(notifications.stream()
                .map(NotificationListItemProjection::subPostId)
                .toList());
    }

    private Set<Long> loadActiveSubPostIdsFromIds(Collection<Long> rawSubPostIds) {
        return referenceAvailabilityService.loadActiveSubPostIdsWithActiveMainPost(rawSubPostIds);
    }

    private String resolveUnavailableReason(
            Long mainPostId,
            Long subPostId,
            Set<Long> activeMainPostIds,
            Set<Long> activeSubPostIds
    ) {
        if (mainPostId != null && mainPostId > 0L && !activeMainPostIds.contains(mainPostId)) {
            return POST_DELETED_REASON;
        }
        if (subPostId != null && subPostId > 0L && !activeSubPostIds.contains(subPostId)) {
            return SUB_POST_DELETED_REASON;
        }
        return "";
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    private String normalizeType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return null;
        }
        String normalizedType = rawType.trim()
                .replace('-', '_')
                .toUpperCase();
        try {
            return NotificationType.valueOf(normalizedType).name();
        } catch (IllegalArgumentException error) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "通知类型不合法。",
                    java.util.Map.of("type", rawType)
            );
        }
    }

    private String normalizeActorUsername(String actorUsername) {
        if (actorUsername == null || actorUsername.isBlank()) {
            return null;
        }
        return actorUsername.trim();
    }

    private String normalizeUsername(String username) {
        if (username == null) {
            return "";
        }
        return username.trim();
    }

    private Long requirePositiveId(Long id, String fieldName) {
        if (id == null || id <= 0L) {
            throw new IllegalArgumentException(fieldName + " must be positive.");
        }
        return id;
    }

    private String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            return "\u4e3b\u5e16";
        }
        return truncate(title.trim(), 80);
    }

    private String normalizePreview(String preview) {
        if (preview == null || preview.isBlank()) {
            return "\u65e0\u5185\u5bb9";
        }
        return "\u201c" + truncate(preview.trim().replaceAll("\\s+", " "), 80) + "\u201d";
    }

    private String truncate(String value, int maxLength) {
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength - 3) + "...";
    }
}
