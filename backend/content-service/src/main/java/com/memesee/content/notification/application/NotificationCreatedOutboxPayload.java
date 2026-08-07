package com.memesee.content.notification.application;

import java.time.Instant;

record NotificationCreatedOutboxPayload(
        Long notificationId,
        String recipientUsername,
        String actorUsername,
        String notificationType,
        String title,
        String body,
        Long mainPostId,
        Long subPostId,
        Instant createdAt
) {
}
