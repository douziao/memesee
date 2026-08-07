package com.memesee.content.notification.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.PlatformCacheFactory;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(NotificationUnreadCountCacheProperties.class)
public class NotificationUnreadCountCacheConfiguration {

    @Bean
    public NotificationUnreadCountCache notificationUnreadCountCache(
            NotificationUnreadCountCacheProperties properties,
            StringRedisTemplate redisTemplate,
            MeterRegistry meterRegistry,
            ObjectMapper objectMapper
    ) {
        return PlatformCacheFactory.createRedisJsonCache(
                properties,
                NotificationUnreadCountCache.class,
                redisTemplate,
                objectMapper,
                meterRegistry,
                RedisNotificationUnreadCountCache::new
        );
    }
}
