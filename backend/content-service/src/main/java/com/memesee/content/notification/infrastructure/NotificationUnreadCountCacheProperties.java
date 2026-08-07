package com.memesee.content.notification.infrastructure;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.notification-unread-count")
public class NotificationUnreadCountCacheProperties extends PlatformCacheProperties {

    public NotificationUnreadCountCacheProperties() {
        super(Duration.ofSeconds(30), "memesee:content:notification-unread-count", "content:notifications:unread-count");
    }
}
