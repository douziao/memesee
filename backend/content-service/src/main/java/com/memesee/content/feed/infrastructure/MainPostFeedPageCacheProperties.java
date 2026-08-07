package com.memesee.content.feed.infrastructure;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.main-post-feed-page")
public class MainPostFeedPageCacheProperties extends PlatformCacheProperties {

    public MainPostFeedPageCacheProperties() {
        super(Duration.ofSeconds(20), "memesee:content:main-post-feed-page", null);
    }
}
