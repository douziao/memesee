package com.memesee.content.notification.application;

public interface NotificationUnreadCountProjectionPort {

    long loadUnreadCount(String username);
}
