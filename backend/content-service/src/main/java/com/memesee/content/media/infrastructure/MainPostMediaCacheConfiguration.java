package com.memesee.content.media.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(MainPostMediaCacheProperties.class)
public class MainPostMediaCacheConfiguration {

    @Bean
    public MainPostMediaCache mainPostMediaCache(
            MainPostMediaCacheProperties properties,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                MainPostMediaCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisMainPostMediaCache::new
        );
    }
}
