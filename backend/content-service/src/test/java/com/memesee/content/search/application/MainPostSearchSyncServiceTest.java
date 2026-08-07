package com.memesee.content.search.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.memesee.content.common.outbox.application.ContentOutboxService;
import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.domain.MainPost;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MainPostSearchSyncServiceTest {

    private final RecordingContentOutboxService contentOutboxService = new RecordingContentOutboxService();
    private final MainPostSearchSyncService service = new MainPostSearchSyncService(
            contentOutboxService,
            new MainPostSearchDocumentFactory()
    );

    @Test
    void requestUpsertConvertsDeletedMainPostToDeleteWithoutIndexingContent() {
        MainPost mainPost = mainPost(42L, "stale title", "stale content");
        mainPost.markDeleted();

        service.requestUpsert(mainPost, null);

        assertThat(contentOutboxService.events).singleElement()
                .satisfies(event -> {
                    assertThat(event.aggregateType()).isEqualTo("main-post");
                    assertThat(event.aggregateId()).isEqualTo("42");
                    assertThat(event.eventType()).isEqualTo(MainPostSearchSyncService.MAIN_POST_SEARCH_SYNC_EVENT_TYPE);
                    assertThat(event.payload().action()).isEqualTo(MainPostSearchSyncAction.DELETE);
                    assertThat(event.payload().mainPostId()).isEqualTo(42L);
                    assertThat(event.payload().document()).isNull();
                });
    }

    @Test
    void requestUpsertIndexesActiveMainPostDocument() {
        MainPost mainPost = mainPost(42L, "visible title", "visible content");
        Community community = Community.snapshot(10L, "memes", "梗图", "description", 0);

        service.requestUpsert(mainPost, community);

        assertThat(contentOutboxService.events).singleElement()
                .satisfies(event -> {
                    assertThat(event.payload().action()).isEqualTo(MainPostSearchSyncAction.UPSERT);
                    assertThat(event.payload().document().mainPostId()).isEqualTo(42L);
                    assertThat(event.payload().document().title()).isEqualTo("visible title");
                    assertThat(event.payload().document().content()).isEqualTo("visible content");
                });
    }

    private MainPost mainPost(Long id, String title, String content) {
        MainPost mainPost = new MainPost(10L, "author", title, content);
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

    private static class RecordingContentOutboxService extends ContentOutboxService {
        private final List<RecordedOutboxEvent> events = new ArrayList<>();

        RecordingContentOutboxService() {
            super(null, null, null);
        }

        @Override
        public void append(String aggregateType, String aggregateId, String eventType, Object payload) {
            events.add(new RecordedOutboxEvent(
                    aggregateType,
                    aggregateId,
                    eventType,
                    (MainPostSearchSyncPayload) payload
            ));
        }
    }

    private record RecordedOutboxEvent(
            String aggregateType,
            String aggregateId,
            String eventType,
            MainPostSearchSyncPayload payload
    ) {
    }
}
