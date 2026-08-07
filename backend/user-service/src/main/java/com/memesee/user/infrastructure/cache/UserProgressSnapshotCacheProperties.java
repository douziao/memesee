package com.memesee.user.infrastructure.cache;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.user-progress-snapshot")
public class UserProgressSnapshotCacheProperties extends PlatformCacheProperties {

    public UserProgressSnapshotCacheProperties() {
        super(Duration.ofSeconds(30), "memesee:user:progress-snapshot", "user:progress-snapshot");
        setSerializationVersion("v2");
    }
}
