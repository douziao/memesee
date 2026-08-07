package com.memesee.content.notification.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.common.application.ContentCacheInvalidationCoordinator;
import com.memesee.content.common.outbox.application.ContentOutboxEventHandler;
import org.springframework.stereotype.Component;

@Component
public class NotificationCreatedOutboxHandler implements ContentOutboxEventHandler {

    private static final String EVENT_TYPE = "content.notification.created";

    private final ObjectMapper objectMapper;
    private final ContentCacheInvalidationCoordinator cacheInvalidationCoordinator;

    public NotificationCreatedOutboxHandler(
            ObjectMapper objectMapper,
            ContentCacheInvalidationCoordinator cacheInvalidationCoordinator
    ) {
        this.objectMapper = objectMapper;
        this.cacheInvalidationCoordinator = cacheInvalidationCoordinator;
    }

    @Override
    public boolean supports(String eventType) {
        return EVENT_TYPE.equals(eventType);
    }

    @Override
    public void handle(String payloadJson) {
        try {
            NotificationCreatedOutboxPayload payload = objectMapper.readValue(payloadJson, NotificationCreatedOutboxPayload.class);
            evictNotificationCaches(validatePayload(payload));
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("Failed to deserialize notification outbox payload.", error);
        }
    }

    private String validatePayload(NotificationCreatedOutboxPayload payload) {
        if (payload == null || payload.notificationId() == null) {
            throw new IllegalArgumentException("Notification created payload is incomplete.");
        }
        String recipientUsername = payload.recipientUsername();
        if (recipientUsername == null || recipientUsername.isBlank()) {
            throw new IllegalArgumentException("Notification created payload is missing recipientUsername.");
        }
        return recipientUsername.trim();
    }

    private void evictNotificationCaches(String recipientUsername) {
        cacheInvalidationCoordinator.onNotificationChanged(recipientUsername);
    }
}
