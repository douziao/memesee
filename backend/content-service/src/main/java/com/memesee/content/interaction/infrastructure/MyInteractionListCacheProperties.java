package com.memesee.content.interaction.infrastructure;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.my-interaction-list")
public class MyInteractionListCacheProperties extends PlatformCacheProperties {

    public MyInteractionListCacheProperties() {
        super(Duration.ofSeconds(30), "memesee:content:my-interaction-list", "content:my-interactions:list");
    }
}
