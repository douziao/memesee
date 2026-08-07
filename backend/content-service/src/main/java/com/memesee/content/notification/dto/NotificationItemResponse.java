package com.memesee.content.notification.dto;

import java.time.Instant;

public record NotificationItemResponse(
        Long id,
        String type,
        String title,
        String body,
        Long mainPostId,
        Long subPostId,
        String actorUsername,
        Instant createdAt,
        boolean read,
        String unavailableReason
) {
}
