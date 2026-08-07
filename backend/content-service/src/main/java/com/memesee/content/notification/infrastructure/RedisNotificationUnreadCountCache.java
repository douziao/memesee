package com.memesee.content.notification.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.CacheKeyEncoder;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.StringValueRedisCacheSupport;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisNotificationUnreadCountCache implements NotificationUnreadCountCache {

    private final Duration ttl;
    private final Duration freshnessTtl;
    private final String keyPrefix;
    private final String legacyKeyPrefix;
    private final StringValueRedisCacheSupport<Long> cacheSupport;

    public RedisNotificationUnreadCountCache(
            StringRedisTemplate redisTemplate,
            NotificationUnreadCountCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this(
                redisTemplate,
                properties,
                meterRegistry,
                new ObjectMapper().findAndRegisterModules()
        );
    }

    public RedisNotificationUnreadCountCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            NotificationUnreadCountCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this(redisTemplate, properties, meterRegistry, objectMapper);
    }

    public RedisNotificationUnreadCountCache(
            StringRedisTemplate redisTemplate,
            NotificationUnreadCountCacheProperties properties,
            MeterRegistry meterRegistry,
            ObjectMapper objectMapper
    ) {
        this.ttl = properties.getTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.legacyKeyPrefix = properties.getLegacyKeyPrefix();
        this.cacheSupport = new StringValueRedisCacheSupport<>(
                redisTemplate,
                new CacheMetricsRecorder(meterRegistry, "notification-unread-count"),
                "notification-unread-count",
                Long::parseLong,
                String::valueOf,
                PlatformLocalCache.create(properties.getLocalCache()),
                properties.getSerializationVersion(),
                objectMapper
        );
    }

    @Override
    public Optional<Long> getUnreadCount(String username) {
        return cacheSupport.read(buildRedisKey(username), buildLegacyRedisKey(username));
    }

    @Override
    public PlatformCacheReadResult<Long> getUnreadCountSnapshot(String username) {
        return cacheSupport.readSnapshot(buildRedisKey(username), buildLegacyRedisKey(username), freshnessTtl);
    }

    @Override
    public void putUnreadCount(String username, long unreadCount) {
        cacheSupport.write(buildRedisKey(username), unreadCount, ttl);
    }

    @Override
    public void evictUnreadCount(String username) {
        cacheSupport.evict(buildRedisKey(username), buildLegacyRedisKey(username));
    }

    @Override
    public void recordLoaderHit() {
        cacheSupport.recordLoaderHit();
    }

    @Override
    public void recordRequestMerge() {
        cacheSupport.recordRequestMerge();
    }

    @Override
    public void recordRefresh() {
        cacheSupport.recordRefresh();
    }

    @Override
    public void recordRefreshMerge() {
        cacheSupport.recordRefreshMerge();
    }

    private String buildRedisKey(String username) {
        return keyPrefix + ":" + encode(username) + ":count";
    }

    private String buildLegacyRedisKey(String username) {
        return legacyKeyPrefix + ":" + encode(username);
    }

    private String encode(String value) {
        return CacheKeyEncoder.encodeNullable(value);
    }
}
