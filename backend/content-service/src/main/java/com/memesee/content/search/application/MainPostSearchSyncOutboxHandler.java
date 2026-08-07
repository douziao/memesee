package com.memesee.content.search.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.common.outbox.application.ContentOutboxEventHandler;
import org.springframework.stereotype.Component;

@Component
public class MainPostSearchSyncOutboxHandler implements ContentOutboxEventHandler {

    private final ObjectMapper objectMapper;
    private final MainPostSearchIndexer mainPostSearchIndexer;

    public MainPostSearchSyncOutboxHandler(
            ObjectMapper objectMapper,
            MainPostSearchIndexer mainPostSearchIndexer
    ) {
        this.objectMapper = objectMapper;
        this.mainPostSearchIndexer = mainPostSearchIndexer;
    }

    @Override
    public boolean supports(String eventType) {
        return MainPostSearchSyncService.MAIN_POST_SEARCH_SYNC_EVENT_TYPE.equals(eventType);
    }

    @Override
    public void handle(String payloadJson) {
        try {
            MainPostSearchSyncPayload payload = objectMapper.readValue(payloadJson, MainPostSearchSyncPayload.class);
            validatePayload(payload);
            dispatch(payload);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("Failed to deserialize main-post search sync payload.", error);
        }
    }

    private void dispatch(MainPostSearchSyncPayload payload) {
        if (payload.action() == MainPostSearchSyncAction.DELETE) {
            mainPostSearchIndexer.delete(payload.mainPostId());
            return;
        }
        mainPostSearchIndexer.upsert(payload.document());
    }

    private void validatePayload(MainPostSearchSyncPayload payload) {
        if (payload == null || payload.action() == null || payload.mainPostId() == null) {
            throw new IllegalArgumentException("Main-post search sync payload is incomplete.");
        }
        if (payload.action() == MainPostSearchSyncAction.UPSERT) {
            MainPostSearchDocument document = payload.document();
            if (document == null || !payload.mainPostId().equals(document.mainPostId())) {
                throw new IllegalArgumentException("Main-post search sync upsert payload is invalid.");
            }
        }
    }
}
