package com.memesee.content.feed.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(MainPostFeedPageCacheProperties.class)
public class MainPostFeedPageCacheConfiguration {

    @Bean
    public MainPostFeedPageCache mainPostFeedPageCache(
            MainPostFeedPageCacheProperties properties,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                MainPostFeedPageCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisMainPostFeedPageCache::new
        );
    }
}
