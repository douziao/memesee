package com.memesee.content.media.infrastructure;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.main-post-media")
public class MainPostMediaCacheProperties extends PlatformCacheProperties {

    public MainPostMediaCacheProperties() {
        super(Duration.ofMinutes(10), "memesee:content:main-post-media", null);
    }
}
