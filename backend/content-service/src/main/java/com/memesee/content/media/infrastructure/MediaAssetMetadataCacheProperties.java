package com.memesee.content.media.infrastructure;

import com.memesee.platform.cache.PlatformCacheProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cache.media-asset-metadata")
public class MediaAssetMetadataCacheProperties extends PlatformCacheProperties {

    public MediaAssetMetadataCacheProperties() {
        super(Duration.ofMinutes(10), "memesee:content:media-asset-metadata", null);
    }
}
