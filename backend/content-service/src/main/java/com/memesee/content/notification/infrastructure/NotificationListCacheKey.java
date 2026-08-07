package com.memesee.content.notification.infrastructure;

public record NotificationListCacheKey(
        String username,
        int limit,
        String type,
        Boolean unread,
        String actorUsername
) {
}
