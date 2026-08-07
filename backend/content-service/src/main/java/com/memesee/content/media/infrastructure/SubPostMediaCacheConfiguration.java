package com.memesee.content.media.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(SubPostMediaCacheProperties.class)
public class SubPostMediaCacheConfiguration {

    @Bean
    public SubPostMediaCache subPostMediaCache(
            SubPostMediaCacheProperties properties,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                SubPostMediaCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisSubPostMediaCache::new
        );
    }
}
