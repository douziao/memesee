package com.memesee.content.community.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(CommunityCatalogCacheProperties.class)
public class CommunityCatalogCacheConfiguration {

    @Bean
    public CommunityCatalogCache communityCatalogCache(
            CommunityCatalogCacheProperties properties,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                CommunityCatalogCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisCommunityCatalogCache::new
        );
    }
}
