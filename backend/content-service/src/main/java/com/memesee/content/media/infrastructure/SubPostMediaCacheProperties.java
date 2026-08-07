package com.memesee.content.media.infrastructure;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.sub-post-media")
public class SubPostMediaCacheProperties extends PlatformCacheProperties {

    public SubPostMediaCacheProperties() {
        super(Duration.ofMinutes(10), "memesee:content:sub-post-media", null);
    }
}
