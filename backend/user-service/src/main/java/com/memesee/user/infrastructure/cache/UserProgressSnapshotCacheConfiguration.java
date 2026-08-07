package com.memesee.user.infrastructure.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(UserProgressSnapshotCacheProperties.class)
public class UserProgressSnapshotCacheConfiguration {

    @Bean
    public UserProgressSnapshotCache userProgressSnapshotCache(
            UserProgressSnapshotCacheProperties properties,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                UserProgressSnapshotCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisUserProgressSnapshotCache::new
        );
    }
}
