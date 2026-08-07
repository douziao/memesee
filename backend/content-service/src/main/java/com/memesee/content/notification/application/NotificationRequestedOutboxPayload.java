package com.memesee.content.notification.application;

record NotificationRequestedOutboxPayload(
        String notificationType,
        String recipientUsername,
        String actorUsername,
        Long mainPostId,
        Long subPostId,
        String mainPostTitle,
        String subPostPreview
) {
}
