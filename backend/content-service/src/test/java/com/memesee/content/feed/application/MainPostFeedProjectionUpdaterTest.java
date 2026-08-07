package com.memesee.content.feed.application;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.memesee.content.feed.infrastructure.MainPostFeedItemRepository;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.application.MainPostMediaCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class MainPostFeedProjectionUpdaterTest {

    private final MainPostRepository mainPostRepository = mock(MainPostRepository.class);
    private final MainPostFeedItemRepository feedItemRepository = mock(MainPostFeedItemRepository.class);
    private final TestMainPostFeedItemAssembler feedItemAssembler = new TestMainPostFeedItemAssembler();
    private final MainPostMediaCollaborationApplicationService mediaCollaborationApplicationService =
            mock(MainPostMediaCollaborationApplicationService.class);
    private final MainPostFeedProjectionUpdater updater = new MainPostFeedProjectionUpdater(
            mainPostRepository,
            feedItemRepository,
            feedItemAssembler,
            mediaCollaborationApplicationService
    );

    @Test
    void refreshMainPostDeletesProjectionWhenMainPostWasDeleted() {
        MainPost mainPost = mainPost(42L);
        mainPost.markDeleted();
        when(mainPostRepository.findById(42L)).thenReturn(Optional.of(mainPost));

        updater.refreshMainPost(42L);

        verify(feedItemRepository).deleteById(42L);
        org.mockito.Mockito.verify(feedItemRepository, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
        verify(mediaCollaborationApplicationService, org.mockito.Mockito.never())
                .resolveMainPostMedia(org.mockito.ArgumentMatchers.any());
        org.assertj.core.api.Assertions.assertThat(feedItemAssembler.assembledCount).isZero();
    }

    @Test
    void refreshMainPostDeletesProjectionWhenMainPostNoLongerExists() {
        when(mainPostRepository.findById(42L)).thenReturn(Optional.empty());

        updater.refreshMainPost(42L);

        verify(feedItemRepository).deleteById(42L);
    }

    private MainPost mainPost(Long id) {
        MainPost mainPost = new MainPost(10L, "author", "title", "content");
        writeField(mainPost, "id", id);
        return mainPost;
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

    private static class TestMainPostFeedItemAssembler extends MainPostFeedItemAssembler {
        private int assembledCount;

        TestMainPostFeedItemAssembler() {
            super(null, null, null);
        }

        @Override
        public com.memesee.content.feed.infrastructure.MainPostFeedItem assemble(
                MainPost mainPost,
                List<MediaAssetResponse> mediaAssets
        ) {
            assembledCount++;
            throw new AssertionError("Deleted main posts must not be assembled into feed projection.");
        }
    }
}
