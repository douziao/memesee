package com.memesee.user.infrastructure.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(RecentPostStatsCacheProperties.class)
public class RecentPostStatsCacheConfiguration {

    @Bean
    public RecentPostStatsCache recentPostStatsCache(
            RecentPostStatsCacheProperties properties,
            StringRedisTemplate redisTemplate,
            MeterRegistry meterRegistry,
            ObjectMapper objectMapper
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                RecentPostStatsCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisRecentPostStatsCache::new
        );
    }
}
