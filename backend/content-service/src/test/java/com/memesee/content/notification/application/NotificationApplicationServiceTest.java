package com.memesee.content.notification.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.memesee.content.common.application.ContentCacheInvalidationCoordinator;
import com.memesee.content.common.application.ContentReferenceAvailabilityService;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.common.auth.JwtService;
import com.memesee.content.common.outbox.application.ContentOutboxService;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.notification.application.NotificationListProjectionPort.NotificationListItemProjection;
import com.memesee.content.notification.domain.ContentNotification;
import com.memesee.content.notification.domain.NotificationType;
import com.memesee.content.notification.dto.NotificationListResponse;
import com.memesee.content.notification.infrastructure.ContentNotificationRepository;
import com.memesee.content.notification.infrastructure.NotificationListCache;
import com.memesee.content.notification.infrastructure.NotificationUnreadCountCache;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NotificationApplicationServiceTest {

    private final NotificationListProjectionPort notificationListProjectionPort = mock(NotificationListProjectionPort.class);
    private final NotificationUnreadCountProjectionPort notificationUnreadCountProjectionPort =
            mock(NotificationUnreadCountProjectionPort.class);
    private final ContentNotificationRepository contentNotificationRepository = mock(ContentNotificationRepository.class);
    private final MainPostRepository mainPostRepository = mock(MainPostRepository.class);
    private final SubPostRepository subPostRepository = mock(SubPostRepository.class);
    private final ContentReferenceAvailabilityService referenceAvailabilityService =
            new ContentReferenceAvailabilityService(mainPostRepository, subPostRepository);
    private final NotificationListCache notificationListCache = mock(NotificationListCache.class);
    private final NotificationUnreadCountCache notificationUnreadCountCache = mock(NotificationUnreadCountCache.class);
    private final TestContentCacheInvalidationCoordinator cacheInvalidationCoordinator =
            new TestContentCacheInvalidationCoordinator();

    private final NotificationApplicationService service = new NotificationApplicationService(
            notificationListProjectionPort,
            notificationUnreadCountProjectionPort,
            contentNotificationRepository,
            referenceAvailabilityService,
            new AuthContextResolver(new FixedJwtService()),
            notificationListCache,
            notificationUnreadCountCache,
            null,
            cacheInvalidationCoordinator,
            new PlatformAsyncRefreshCoordinator()
    );

    @BeforeEach
    void setUp() {
        when(notificationListCache.getNotificationListSnapshot(any())).thenCallRealMethod();
        when(notificationListCache.getNotificationList(any())).thenReturn(Optional.empty());
        when(notificationUnreadCountCache.getUnreadCountSnapshot(any())).thenCallRealMethod();
        when(notificationUnreadCountCache.getUnreadCount(any())).thenReturn(Optional.empty());
    }

    @Test
    void listNotificationsAnnotatesDeletedPostAndSubPostTargetsWithoutMutatingIds() {
        Instant now = Instant.parse("2026-06-08T00:00:00Z");
        when(notificationListProjectionPort.loadNotifications(any())).thenReturn(List.of(
                projection(1L, NotificationType.SUB_POST_CREATED, "active title", "active body", 42L, 7L, now),
                projection(2L, NotificationType.SUB_POST_REPLIED, "old deleted sub-post title", "old deleted sub-post body", 42L, 8L, now.plusSeconds(1)),
                projection(3L, NotificationType.MAIN_POST_LIKED, "old deleted main-post title", "old deleted main-post body", 99L, null, now.plusSeconds(2))
        ));
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(any())).thenReturn(List.of(mainPost(42L)));
        when(subPostRepository.findByIdIn(any())).thenReturn(List.of(subPost(7L, 42L)));
        when(notificationUnreadCountProjectionPort.loadUnreadCount("alice")).thenReturn(3L);

        NotificationListResponse response = service.listNotifications("Bearer token", 20, null, null, null);

        assertThat(response.unreadCount()).isEqualTo(3L);
        assertThat(response.items()).hasSize(3);
        assertThat(response.items().get(0).mainPostId()).isEqualTo(42L);
        assertThat(response.items().get(0).subPostId()).isEqualTo(7L);
        assertThat(response.items().get(0).title()).isEqualTo("active title");
        assertThat(response.items().get(0).body()).isEqualTo("active body");
        assertThat(response.items().get(0).unavailableReason()).isEmpty();
        assertThat(response.items().get(1).mainPostId()).isEqualTo(42L);
        assertThat(response.items().get(1).subPostId()).isEqualTo(8L);
        assertThat(response.items().get(1).unavailableReason()).isEqualTo("sub-post-deleted");
        assertThat(response.items().get(1).title()).isEqualTo("\u5173\u8054\u5b50\u5e16\u5df2\u5220\u9664");
        assertThat(response.items().get(1).body()).isEqualTo("\u8fd9\u6761\u901a\u77e5\u5173\u8054\u7684\u5b50\u5e16\u5df2\u5220\u9664\u3002");
        assertThat(response.items().get(1).title()).doesNotContain("old deleted sub-post");
        assertThat(response.items().get(1).body()).doesNotContain("old deleted sub-post");
        assertThat(response.items().get(2).mainPostId()).isEqualTo(99L);
        assertThat(response.items().get(2).unavailableReason()).isEqualTo("post-deleted");
        assertThat(response.items().get(2).title()).isEqualTo("\u5173\u8054\u4e3b\u5e16\u5df2\u5220\u9664");
        assertThat(response.items().get(2).body()).isEqualTo("\u8fd9\u6761\u901a\u77e5\u5173\u8054\u7684\u4e3b\u5e16\u5df2\u5220\u9664\u3002");
        assertThat(response.items().get(2).title()).doesNotContain("old deleted main-post");
        assertThat(response.items().get(2).body()).doesNotContain("old deleted main-post");
    }

    @Test
    void cachedNotificationListRedactsUnavailableReferencesEvenWhenRefreshFails() {
        Instant now = Instant.parse("2026-06-08T00:00:00Z");
        when(notificationListCache.getNotificationList(any())).thenReturn(Optional.of(new NotificationListResponse(
                3L,
                List.of(
                        notificationItem(1L, NotificationType.SUB_POST_CREATED, "active title", "active body", 42L, 7L, now),
                        notificationItem(2L, NotificationType.SUB_POST_REPLIED, "old deleted sub-post title", "old deleted sub-post body", 42L, 8L, now.plusSeconds(1)),
                        notificationItem(3L, NotificationType.MAIN_POST_LIKED, "old deleted main-post title", "old deleted main-post body", 99L, null, now.plusSeconds(2))
                )
        )));
        when(notificationListProjectionPort.loadNotifications(any()))
                .thenThrow(new IllegalStateException("projection unavailable"));
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(any())).thenReturn(List.of(mainPost(42L)));
        when(subPostRepository.findByIdIn(any())).thenReturn(List.of(subPost(7L, 42L)));

        NotificationListResponse response = service.listNotifications("Bearer token", 20, null, null, null);

        assertThat(response.unreadCount()).isEqualTo(3L);
        assertThat(response.items()).hasSize(3);
        assertThat(response.items().get(0).title()).isEqualTo("active title");
        assertThat(response.items().get(0).body()).isEqualTo("active body");
        assertThat(response.items().get(0).unavailableReason()).isEmpty();
        assertThat(response.items().get(1).unavailableReason()).isEqualTo("sub-post-deleted");
        assertThat(response.items().get(1).title()).isEqualTo("\u5173\u8054\u5b50\u5e16\u5df2\u5220\u9664");
        assertThat(response.items().get(1).body()).isEqualTo("\u8fd9\u6761\u901a\u77e5\u5173\u8054\u7684\u5b50\u5e16\u5df2\u5220\u9664\u3002");
        assertThat(response.items().get(1).title()).doesNotContain("old deleted sub-post");
        assertThat(response.items().get(1).body()).doesNotContain("old deleted sub-post");
        assertThat(response.items().get(2).unavailableReason()).isEqualTo("post-deleted");
        assertThat(response.items().get(2).title()).isEqualTo("\u5173\u8054\u4e3b\u5e16\u5df2\u5220\u9664");
        assertThat(response.items().get(2).body()).isEqualTo("\u8fd9\u6761\u901a\u77e5\u5173\u8054\u7684\u4e3b\u5e16\u5df2\u5220\u9664\u3002");
        assertThat(response.items().get(2).title()).doesNotContain("old deleted main-post");
        assertThat(response.items().get(2).body()).doesNotContain("old deleted main-post");
        verify(notificationListCache).evictNotificationLists("alice");
        verify(notificationListCache).recordLoaderHit();
    }

    @Test
    void invalidateNotificationsReferencingMainPostEvictsAffectedRecipientsOnlyOnce() {
        when(contentNotificationRepository.findDistinctUsernamesByMainPostId(42L))
                .thenReturn(List.of(" alice ", "bob", "alice", " "));

        service.invalidateNotificationsReferencingMainPost(42L);

        assertThat(cacheInvalidationCoordinator.changedUsernames).containsExactly("alice", "bob");
    }

    @Test
    void invalidateNotificationsReferencingSubPostEvictsAffectedRecipientsOnlyOnce() {
        when(contentNotificationRepository.findDistinctUsernamesBySubPostId(7L))
                .thenReturn(List.of("alice", " bob ", "bob", ""));

        service.invalidateNotificationsReferencingSubPost(7L);

        assertThat(cacheInvalidationCoordinator.changedUsernames).containsExactly("alice", "bob");
    }

    @Test
    void markAllReadReturnsFreshUnreadCountWithoutWritingUnreadCacheInsideTransaction() {
        ContentNotification notification = notification(NotificationType.SUB_POST_CREATED, 42L, 7L);
        when(contentNotificationRepository.findAllByUsername("alice")).thenReturn(List.of(notification));
        when(notificationUnreadCountProjectionPort.loadUnreadCount("alice")).thenReturn(0L);

        var response = service.markAllRead("Bearer token");

        assertThat(response.unreadCount()).isZero();
        assertThat(notification.isRead()).isTrue();
        assertThat(cacheInvalidationCoordinator.changedUsernames).containsExactly("alice");
        verify(notificationUnreadCountCache, never()).putUnreadCount(any(), anyLong());
    }

    @Test
    void markReadReturnsFreshUnreadCountWithoutWritingUnreadCacheInsideTransaction() {
        ContentNotification notification = notification(NotificationType.MAIN_POST_LIKED, 42L, null);
        when(contentNotificationRepository.findByIdAndUsername(5L, "alice")).thenReturn(Optional.of(notification));
        when(notificationUnreadCountProjectionPort.loadUnreadCount("alice")).thenReturn(1L);

        var response = service.markRead("Bearer token", 5L);

        assertThat(response.unreadCount()).isEqualTo(1L);
        assertThat(notification.isRead()).isTrue();
        assertThat(cacheInvalidationCoordinator.changedUsernames).containsExactly("alice");
        verify(notificationUnreadCountCache, never()).putUnreadCount(any(), anyLong());
    }

    @Test
    void notifyMainPostLikedEvictsRecipientNotificationCachesAfterCreate() {
        RecordingContentOutboxService contentOutboxService = new RecordingContentOutboxService();
        NotificationApplicationService notificationService = serviceWithOutbox(contentOutboxService);
        doAnswer(invocation -> {
            ContentNotification notification = invocation.getArgument(0);
            writeField(notification, "id", 11L);
            return notification;
        }).when(contentNotificationRepository).save(any(ContentNotification.class));

        notificationService.notifyMainPostLiked(" bob ", "alice", 42L, "title");

        assertThat(cacheInvalidationCoordinator.changedUsernames).containsExactly("bob");
        assertThat(contentOutboxService.eventTypes).containsExactly("content.notification.created");
        verify(contentNotificationRepository).save(any(ContentNotification.class));
    }

    private NotificationListItemProjection projection(
            Long id,
            NotificationType type,
            Long mainPostId,
            Long subPostId,
            Instant createdAt
    ) {
        return projection(id, type, "title", "body", mainPostId, subPostId, createdAt);
    }

    private NotificationListItemProjection projection(
            Long id,
            NotificationType type,
            String title,
            String body,
            Long mainPostId,
            Long subPostId,
            Instant createdAt
    ) {
        return new NotificationListItemProjection(
                id,
                type,
                title,
                body,
                mainPostId,
                subPostId,
                "actor",
                createdAt,
                false
        );
    }

    private com.memesee.content.notification.dto.NotificationItemResponse notificationItem(
            Long id,
            NotificationType type,
            String title,
            String body,
            Long mainPostId,
            Long subPostId,
            Instant createdAt
    ) {
        return new com.memesee.content.notification.dto.NotificationItemResponse(
                id,
                type.name(),
                title,
                body,
                mainPostId,
                subPostId,
                "actor",
                createdAt,
                false,
                ""
        );
    }

    private MainPost mainPost(Long id) {
        MainPost mainPost = new MainPost(1L, "author", "title", "content");
        writeField(mainPost, "id", id);
        return mainPost;
    }

    private ContentNotification notification(NotificationType type, Long mainPostId, Long subPostId) {
        return new ContentNotification(
                "alice",
                type,
                "title",
                "body",
                mainPostId,
                subPostId,
                "actor"
        );
    }

    private NotificationApplicationService serviceWithOutbox(ContentOutboxService contentOutboxService) {
        return new NotificationApplicationService(
                notificationListProjectionPort,
                notificationUnreadCountProjectionPort,
                contentNotificationRepository,
                referenceAvailabilityService,
                new AuthContextResolver(new FixedJwtService()),
                notificationListCache,
                notificationUnreadCountCache,
                contentOutboxService,
                cacheInvalidationCoordinator,
                new PlatformAsyncRefreshCoordinator()
        );
    }

    private SubPost subPost(Long id, Long mainPostId) {
        SubPost subPost = new SubPost(mainPostId, null, "author", "content");
        writeField(subPost, "id", id);
        return subPost;
    }

    private static void writeField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError("Unable to set field " + fieldName, exception);
        }
    }

    private static class FixedJwtService extends JwtService {
        FixedJwtService() {
            super("test-secret-with-at-least-thirty-two-characters");
        }

        @Override
        public String extractUsername(String token) {
            return "alice";
        }

        @Override
        public int extractUserLevel(String token) {
            return 1;
        }
    }

    private static class TestContentCacheInvalidationCoordinator extends ContentCacheInvalidationCoordinator {
        private final List<String> changedUsernames = new ArrayList<>();

        TestContentCacheInvalidationCoordinator() {
            super(null, null, null, null);
        }

        @Override
        public void onNotificationChanged(String recipientUsername) {
            changedUsernames.add(recipientUsername);
        }
    }

    private static class RecordingContentOutboxService extends ContentOutboxService {
        private final List<String> eventTypes = new ArrayList<>();

        RecordingContentOutboxService() {
            super(null, null, null);
        }

        @Override
        public void append(String aggregateType, String aggregateId, String eventType, Object payload) {
            eventTypes.add(eventType);
        }
    }
}
