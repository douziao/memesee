package com.memesee.content.notification.dto;

import java.util.List;

public record NotificationListResponse(
        long unreadCount,
        List<NotificationItemResponse> items
) {
}
