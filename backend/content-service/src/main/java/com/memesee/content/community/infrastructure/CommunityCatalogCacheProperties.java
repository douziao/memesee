package com.memesee.content.community.infrastructure;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.community-catalog")
public class CommunityCatalogCacheProperties extends PlatformCacheProperties {

    public CommunityCatalogCacheProperties() {
        super(Duration.ofMinutes(10), "memesee:content:community-catalog", "content:community-catalog");
    }
}
