package com.memesee.content.notification.application;

import com.memesee.content.common.outbox.application.ContentOutboxService;
import com.memesee.content.notification.domain.NotificationType;
import org.springframework.stereotype.Service;

@Service
public class OutboxNotificationRequestPublisher implements NotificationRequestPublisher {

    static final String NOTIFICATION_REQUESTED_EVENT_TYPE = "content.notification.requested";

    private final ContentOutboxService contentOutboxService;

    public OutboxNotificationRequestPublisher(ContentOutboxService contentOutboxService) {
        this.contentOutboxService = contentOutboxService;
    }

    @Override
    public void notifyMainPostLiked(String recipientUsername, String actorUsername, Long mainPostId, String mainPostTitle) {
        appendRequest(
                NotificationType.MAIN_POST_LIKED,
                recipientUsername,
                actorUsername,
                mainPostId,
                null,
                mainPostTitle,
                null
        );
    }

    @Override
    public void notifyMainPostFavorited(String recipientUsername, String actorUsername, Long mainPostId, String mainPostTitle) {
        appendRequest(
                NotificationType.MAIN_POST_FAVORITED,
                recipientUsername,
                actorUsername,
                mainPostId,
                null,
                mainPostTitle,
                null
        );
    }

    @Override
    public void notifySubPostCreated(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    ) {
        appendRequest(
                NotificationType.SUB_POST_CREATED,
                recipientUsername,
                actorUsername,
                mainPostId,
                subPostId,
                mainPostTitle,
                subPostPreview
        );
    }

    @Override
    public void notifySubPostReplied(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    ) {
        appendRequest(
                NotificationType.SUB_POST_REPLIED,
                recipientUsername,
                actorUsername,
                mainPostId,
                subPostId,
                mainPostTitle,
                subPostPreview
        );
    }

    @Override
    public void notifySubPostLiked(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    ) {
        appendRequest(
                NotificationType.SUB_POST_LIKED,
                recipientUsername,
                actorUsername,
                mainPostId,
                subPostId,
                mainPostTitle,
                subPostPreview
        );
    }

    @Override
    public void notifySubPostFavorited(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    ) {
        appendRequest(
                NotificationType.SUB_POST_FAVORITED,
                recipientUsername,
                actorUsername,
                mainPostId,
                subPostId,
                mainPostTitle,
                subPostPreview
        );
    }

    private void appendRequest(
            NotificationType notificationType,
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            Long subPostId,
            String mainPostTitle,
            String subPostPreview
    ) {
        if (notificationType == null) {
            throw new IllegalArgumentException("notificationType must not be null.");
        }
        if (mainPostId == null) {
            throw new IllegalArgumentException("mainPostId must not be null.");
        }
        if (requiresSubPostId(notificationType) && subPostId == null) {
            throw new IllegalArgumentException("subPostId must not be null.");
        }

        String normalizedRecipient = normalizeUsername(recipientUsername);
        String normalizedActor = normalizeUsername(actorUsername);
        if (normalizedRecipient.isBlank() || normalizedActor.isBlank()) {
            return;
        }
        if (normalizedRecipient.equalsIgnoreCase(normalizedActor)) {
            return;
        }

        contentOutboxService.append(
                "notification-request",
                buildAggregateId(notificationType, normalizedRecipient, normalizedActor, mainPostId, subPostId),
                NOTIFICATION_REQUESTED_EVENT_TYPE,
                new NotificationRequestedOutboxPayload(
                        notificationType.name(),
                        normalizedRecipient,
                        normalizedActor,
                        mainPostId,
                        subPostId,
                        normalizeOptionalTitle(mainPostTitle),
                        normalizeOptionalPreview(subPostPreview)
                )
        );
    }

    private boolean requiresSubPostId(NotificationType notificationType) {
        return notificationType == NotificationType.SUB_POST_CREATED
                || notificationType == NotificationType.SUB_POST_REPLIED
                || notificationType == NotificationType.SUB_POST_LIKED
                || notificationType == NotificationType.SUB_POST_FAVORITED;
    }

    private String normalizeUsername(String username) {
        if (username == null) {
            return "";
        }
        return username.trim();
    }

    private String normalizeOptionalTitle(String mainPostTitle) {
        if (mainPostTitle == null || mainPostTitle.isBlank()) {
            return null;
        }
        return mainPostTitle.trim();
    }

    private String normalizeOptionalPreview(String subPostPreview) {
        if (subPostPreview == null || subPostPreview.isBlank()) {
            return null;
        }
        return subPostPreview.trim();
    }

    private String buildAggregateId(
            NotificationType notificationType,
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            Long subPostId
    ) {
        return notificationType.name()
                + ":"
                + recipientUsername
                + ":"
                + actorUsername
                + ":"
                + mainPostId
                + ":"
                + (subPostId == null ? "-" : subPostId);
    }
}
