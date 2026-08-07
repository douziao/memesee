package com.memesee.content.notification.application;

import com.memesee.content.notification.domain.NotificationType;
import java.time.Instant;
import java.util.List;

public interface NotificationListProjectionPort {

    List<NotificationListItemProjection> loadNotifications(NotificationListProjectionQuery query);

    record NotificationListProjectionQuery(
            String username,
            NotificationType type,
            Boolean unread,
            String actorUsername,
            int limit
    ) {
    }

    record NotificationListItemProjection(
            Long id,
            NotificationType type,
            String title,
            String body,
            Long mainPostId,
            Long subPostId,
            String actorUsername,
            Instant createdAt,
            boolean read
    ) {
    }
}
