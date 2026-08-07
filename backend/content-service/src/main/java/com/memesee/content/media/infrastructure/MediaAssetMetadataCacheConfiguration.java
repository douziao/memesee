package com.memesee.content.media.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(MediaAssetMetadataCacheProperties.class)
public class MediaAssetMetadataCacheConfiguration {

    @Bean
    public MediaAssetMetadataCache mediaAssetMetadataCache(
            MediaAssetMetadataCacheProperties properties,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                MediaAssetMetadataCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisMediaAssetMetadataCache::new
        );
    }
}
