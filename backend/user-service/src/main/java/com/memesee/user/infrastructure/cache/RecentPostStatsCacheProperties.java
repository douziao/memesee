package com.memesee.user.infrastructure.cache;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.recent-post-stats")
public class RecentPostStatsCacheProperties extends PlatformCacheProperties {

    public RecentPostStatsCacheProperties() {
        super(Duration.ofMinutes(5), "memesee:user:recent-post-stats", "user:recent-post-stats");
    }
}
