package com.memesee.content.interaction.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(MyInteractionListCacheProperties.class)
public class MyInteractionListCacheConfiguration {

    @Bean
    public MyInteractionListCache myInteractionListCache(
            MyInteractionListCacheProperties properties,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                MyInteractionListCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisMyInteractionListCache::new
        );
    }
}
