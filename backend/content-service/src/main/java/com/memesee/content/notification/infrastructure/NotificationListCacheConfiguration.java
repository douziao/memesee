package com.memesee.content.notification.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(NotificationListCacheProperties.class)
public class NotificationListCacheConfiguration {

    @Bean
    public NotificationListCache notificationListCache(
            NotificationListCacheProperties properties,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                NotificationListCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisNotificationListCache::new
        );
    }
}
