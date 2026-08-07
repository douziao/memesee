package com.memesee.content.notification.infrastructure;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.notification-list")
public class NotificationListCacheProperties extends PlatformCacheProperties {

    public NotificationListCacheProperties() {
        super(Duration.ofSeconds(30), "memesee:content:notification-list", "content:notifications:list");
    }
}
