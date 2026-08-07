package com.memesee.content.notification.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.common.outbox.application.ContentOutboxEventHandler;
import com.memesee.content.notification.domain.NotificationType;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Component
public class NotificationRequestedOutboxHandler implements ContentOutboxEventHandler {

    private final ObjectMapper objectMapper;
    private final NotificationCollaborationApplicationService notificationCollaborationApplicationService;

    public NotificationRequestedOutboxHandler(
            ObjectMapper objectMapper,
            @Lazy NotificationCollaborationApplicationService notificationCollaborationApplicationService
    ) {
        this.objectMapper = objectMapper;
        this.notificationCollaborationApplicationService = notificationCollaborationApplicationService;
    }

    @Override
    public boolean supports(String eventType) {
        return OutboxNotificationRequestPublisher.NOTIFICATION_REQUESTED_EVENT_TYPE.equals(eventType);
    }

    @Override
    public void handle(String payloadJson) {
        try {
            NotificationRequestedOutboxPayload payload = objectMapper.readValue(
                    payloadJson,
                    NotificationRequestedOutboxPayload.class
            );
            dispatch(payload, validatePayload(payload));
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("Failed to deserialize notification request payload.", error);
        }
    }

    private void dispatch(NotificationRequestedOutboxPayload payload, NotificationType notificationType) {
        switch (notificationType) {
            case MAIN_POST_LIKED -> notificationCollaborationApplicationService.notifyMainPostLiked(
                    payload.recipientUsername(),
                    payload.actorUsername(),
                    payload.mainPostId(),
                    payload.mainPostTitle()
            );
            case MAIN_POST_FAVORITED -> notificationCollaborationApplicationService.notifyMainPostFavorited(
                    payload.recipientUsername(),
                    payload.actorUsername(),
                    payload.mainPostId(),
                    payload.mainPostTitle()
            );
            case SUB_POST_CREATED -> notificationCollaborationApplicationService.notifySubPostCreated(
                    payload.recipientUsername(),
                    payload.actorUsername(),
                    payload.mainPostId(),
                    payload.mainPostTitle(),
                    payload.subPostId(),
                    payload.subPostPreview()
            );
            case SUB_POST_REPLIED -> notificationCollaborationApplicationService.notifySubPostReplied(
                    payload.recipientUsername(),
                    payload.actorUsername(),
                    payload.mainPostId(),
                    payload.mainPostTitle(),
                    payload.subPostId(),
                    payload.subPostPreview()
            );
            case SUB_POST_LIKED -> notificationCollaborationApplicationService.notifySubPostLiked(
                    payload.recipientUsername(),
                    payload.actorUsername(),
                    payload.mainPostId(),
                    payload.mainPostTitle(),
                    payload.subPostId(),
                    payload.subPostPreview()
            );
            case SUB_POST_FAVORITED -> notificationCollaborationApplicationService.notifySubPostFavorited(
                    payload.recipientUsername(),
                    payload.actorUsername(),
                    payload.mainPostId(),
                    payload.mainPostTitle(),
                    payload.subPostId(),
                    payload.subPostPreview()
            );
            default -> throw new IllegalArgumentException("Unsupported notification request type=" + notificationType);
        }
    }

    private NotificationType validatePayload(NotificationRequestedOutboxPayload payload) {
        if (payload == null || payload.mainPostId() == null) {
            throw new IllegalArgumentException("Notification request payload is incomplete.");
        }

        NotificationType notificationType = resolveNotificationType(payload.notificationType());
        if (requiresSubPostId(notificationType) && payload.subPostId() == null) {
            throw new IllegalArgumentException("Notification request payload is missing subPostId.");
        }
        return notificationType;
    }

    private NotificationType resolveNotificationType(String notificationType) {
        if (notificationType == null || notificationType.isBlank()) {
            throw new IllegalArgumentException("Notification request payload is missing notificationType.");
        }
        try {
            return NotificationType.valueOf(notificationType.trim());
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("Unsupported notification request type=" + notificationType, error);
        }
    }

    private boolean requiresSubPostId(NotificationType notificationType) {
        return notificationType == NotificationType.SUB_POST_CREATED
                || notificationType == NotificationType.SUB_POST_REPLIED
                || notificationType == NotificationType.SUB_POST_LIKED
                || notificationType == NotificationType.SUB_POST_FAVORITED;
    }
}
