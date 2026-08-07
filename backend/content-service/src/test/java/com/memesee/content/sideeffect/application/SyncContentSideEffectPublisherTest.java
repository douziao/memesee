package com.memesee.content.sideeffect.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.memesee.content.common.application.ContentCacheInvalidationCoordinator;
import com.memesee.content.community.domain.Community;
import com.memesee.content.feed.application.MainPostFeedProjectionUpdater;
import com.memesee.content.interaction.application.InteractionReferenceInvalidator;
import com.memesee.content.mainpost.application.MainPostApplicationSupport;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.notification.application.NotificationReferenceInvalidator;
import com.memesee.content.notification.application.NotificationRequestPublisher;
import com.memesee.content.subpost.domain.SubPost;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class SyncContentSideEffectPublisherTest {

    private final TestMainPostApplicationSupport mainPostApplicationSupport =
            new TestMainPostApplicationSupport();
    private final TestContentCacheInvalidationCoordinator cacheInvalidationCoordinator =
            new TestContentCacheInvalidationCoordinator();
    private final NotificationRequestPublisher notificationRequestPublisher =
            mock(NotificationRequestPublisher.class);
    private final NotificationReferenceInvalidator notificationReferenceInvalidator =
            mock(NotificationReferenceInvalidator.class);
    private final InteractionReferenceInvalidator interactionReferenceInvalidator =
            mock(InteractionReferenceInvalidator.class);
    private final UserProgressEventPublisher userProgressEventPublisher =
            mock(UserProgressEventPublisher.class);
    private final TestMainPostFeedProjectionUpdater mainPostFeedProjectionUpdater =
            new TestMainPostFeedProjectionUpdater();
    private final SyncContentSideEffectPublisher publisher = new SyncContentSideEffectPublisher(
            mainPostApplicationSupport,
            cacheInvalidationCoordinator,
            notificationRequestPublisher,
            notificationReferenceInvalidator,
            interactionReferenceInvalidator,
            userProgressEventPublisher,
            mainPostFeedProjectionUpdater
    );

    @Test
    void onMainPostDeletedEvictsNotificationsReferencingDeletedPost() {
        MainPost mainPost = mainPost(42L);
        mainPost.markDeleted();

        publisher.onMainPostDeleted(mainPost);

        assertThat(mainPostFeedProjectionUpdater.refreshedMainPostIds).containsExactly(42L);
        assertThat(cacheInvalidationCoordinator.mainPostChangedCount).isEqualTo(1);
        assertThat(mainPostApplicationSupport.deletedSearchIds).containsExactly(42L);
        verify(notificationReferenceInvalidator).invalidateNotificationsReferencingMainPost(42L);
        verify(interactionReferenceInvalidator).invalidateInteractionListsReferencingMainPost(42L);
        verify(userProgressEventPublisher).onMainPostDeleted(
                42L,
                "author",
                "memes",
                mainPost.getDeletedAt()
        );
    }

    @Test
    void onSubPostDeletedEvictsNotificationsReferencingDeletedSubPost() {
        MainPost mainPost = mainPost(42L);
        SubPost subPost = subPost(7L, 42L);

        publisher.onSubPostDeleted(mainPost, subPost);

        assertThat(mainPostFeedProjectionUpdater.refreshedMainPostIds).containsExactly(42L);
        assertThat(cacheInvalidationCoordinator.subPostChangedMainPostIds).containsExactly(42L);
        assertThat(mainPostApplicationSupport.syncedSearchPostIds).containsExactly(42L);
        verify(notificationReferenceInvalidator).invalidateNotificationsReferencingSubPost(7L);
        verify(interactionReferenceInvalidator).invalidateInteractionListsReferencingSubPost(7L);
    }

    @Test
    void onSubPostCreatedUsesMediaOnlyPreviewForBlankSubPostContent() {
        MainPost mainPost = mainPost(42L);
        SubPost subPost = new SubPost(42L, null, "reply-author", "   ");
        writeField(subPost, "id", 7L);

        publisher.onSubPostCreated(mainPost, subPost, "reply-author", null);

        verify(notificationRequestPublisher).notifySubPostCreated(
                "author",
                "reply-author",
                42L,
                "title",
                7L,
                "\u56fe\u7247\u5b50\u5e16"
        );
    }

    private MainPost mainPost(Long id) {
        MainPost mainPost = new MainPost(10L, "author", "title", "content");
        writeField(mainPost, "id", id);
        return mainPost;
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

    private static class TestMainPostApplicationSupport extends MainPostApplicationSupport {
        private final Community community = Community.snapshot(10L, "memes", "梗图", "description", 0);
        private final List<Long> syncedSearchPostIds = new ArrayList<>();
        private final List<Long> deletedSearchIds = new ArrayList<>();

        TestMainPostApplicationSupport() {
            super(null, null, null, null);
        }

        @Override
        public Community requireCommunityById(Long communityId) {
            return community;
        }

        @Override
        public void requestSearchSync(MainPost mainPost) {
            syncedSearchPostIds.add(mainPost.getId());
        }

        @Override
        public void requestSearchDelete(Long mainPostId) {
            deletedSearchIds.add(mainPostId);
        }
    }

    private static class TestContentCacheInvalidationCoordinator extends ContentCacheInvalidationCoordinator {
        private int mainPostChangedCount;
        private final List<Long> subPostChangedMainPostIds = new ArrayList<>();

        TestContentCacheInvalidationCoordinator() {
            super(null, null, null, null);
        }

        @Override
        public void onMainPostChanged() {
            mainPostChangedCount++;
        }

        @Override
        public void onSubPostChanged(Long mainPostId) {
            subPostChangedMainPostIds.add(mainPostId);
        }
    }

    private static class TestMainPostFeedProjectionUpdater extends MainPostFeedProjectionUpdater {
        private final List<Long> refreshedMainPostIds = new ArrayList<>();

        TestMainPostFeedProjectionUpdater() {
            super(null, null, null, null);
        }

        @Override
        public void refreshMainPost(Long mainPostId) {
            refreshedMainPostIds.add(mainPostId);
        }
    }
}
