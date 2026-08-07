package com.memesee.content.feed.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.memesee.content.feed.infrastructure.MainPostFeedItem;
import com.memesee.content.feed.infrastructure.MainPostFeedItemRepository;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.application.MainPostMediaCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

class MainPostFeedProjectionRebuildServiceTest {

    private final MainPostRepository mainPostRepository = mock(MainPostRepository.class);
    private final MainPostFeedItemRepository feedItemRepository = mock(MainPostFeedItemRepository.class);
    private final TestMainPostFeedItemAssembler feedItemAssembler = new TestMainPostFeedItemAssembler();
    private final MainPostMediaCollaborationApplicationService mediaCollaborationApplicationService =
            mock(MainPostMediaCollaborationApplicationService.class);
    private final MainPostFeedProjectionRebuildService rebuildService = new MainPostFeedProjectionRebuildService(
            mainPostRepository,
            feedItemRepository,
            feedItemAssembler,
            mediaCollaborationApplicationService
    );

    @Test
    void rebuildAllSkipsDeletedMainPosts() {
        MainPost activePost = mainPost(42L);
        MainPostFeedItem activeFeedItem = feedItem(42L);
        feedItemAssembler.nextFeedItem = activeFeedItem;

        when(feedItemRepository.count()).thenReturn(3L);
        when(mainPostRepository.findByDeletedAtIsNullOrderByIdAsc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(activePost)));
        when(mediaCollaborationApplicationService.resolveMainPostMedia(List.of(activePost)))
                .thenReturn(Map.of(activePost.getId(), List.<MediaAssetResponse>of()));

        FeedProjectionRebuildResult result = rebuildService.rebuildAll(200);

        assertThat(result.deletedItems()).isEqualTo(3L);
        assertThat(result.rebuiltItems()).isEqualTo(1L);
        verify(feedItemRepository).deleteAllInBatch();
        verify(feedItemRepository).saveAll(List.of(activeFeedItem));
        verify(mainPostRepository, never()).findAllByOrderByIdAsc(any(Pageable.class));
        assertThat(feedItemAssembler.assembledMainPostIds).containsExactly(42L);
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

    private MainPostFeedItem feedItem(Long mainPostId) {
        Instant now = Instant.parse("2026-06-08T00:00:00Z");
        return new MainPostFeedItem(
                mainPostId,
                10L,
                "memes",
                "梗图",
                "title",
                "content",
                "long",
                "author",
                "[]",
                "[]",
                "[]",
                BigDecimal.ZERO.setScale(6),
                0L,
                0L,
                0L,
                0L,
                now,
                now,
                now,
                null
        );
    }

    private static class TestMainPostFeedItemAssembler extends MainPostFeedItemAssembler {
        private final List<Long> assembledMainPostIds = new ArrayList<>();
        private MainPostFeedItem nextFeedItem;

        TestMainPostFeedItemAssembler() {
            super(null, null, null);
        }

        @Override
        public MainPostFeedItem assemble(MainPost mainPost, List<MediaAssetResponse> mediaAssets) {
            assembledMainPostIds.add(mainPost.getId());
            return nextFeedItem;
        }
    }
}
