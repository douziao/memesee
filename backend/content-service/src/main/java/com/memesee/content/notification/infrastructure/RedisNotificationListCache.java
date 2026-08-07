package com.memesee.content.notification.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.CacheKeyEncoder;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.VersionedJsonCachePayloadCodec;
import com.memesee.platform.cache.VersionedJsonRedisCacheSupport;
import com.memesee.content.notification.dto.NotificationListResponse;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisNotificationListCache implements NotificationListCache {

    private final Duration ttl;
    private final Duration freshnessTtl;
    private final String keyPrefix;
    private final String legacyKeyPrefix;
    private final VersionedJsonRedisCacheSupport cacheSupport;

    public RedisNotificationListCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            NotificationListCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this.ttl = properties.getTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.legacyKeyPrefix = properties.getLegacyKeyPrefix();
        this.cacheSupport = new VersionedJsonRedisCacheSupport(
                redisTemplate,
                new VersionedJsonCachePayloadCodec(objectMapper, properties.getSerializationVersion()),
                new CacheMetricsRecorder(meterRegistry, "notification-list"),
                "notification-list",
                PlatformLocalCache.create(properties.getLocalCache())
        );
    }

    @Override
    public Optional<NotificationListResponse> getNotificationList(NotificationListCacheKey key) {
        return cacheSupport.read(buildRedisKey(key), buildLegacyRedisKey(key), NotificationListResponse.class);
    }

    @Override
    public PlatformCacheReadResult<NotificationListResponse> getNotificationListSnapshot(NotificationListCacheKey key) {
        return cacheSupport.readSnapshot(
                buildRedisKey(key),
                buildLegacyRedisKey(key),
                NotificationListResponse.class,
                freshnessTtl
        );
    }

    @Override
    public void putNotificationList(NotificationListCacheKey key, NotificationListResponse response) {
        cacheSupport.writeIndexed(buildRedisKey(key), buildUserIndexKey(key.username()), response, ttl);
    }

    @Override
    public void evictNotificationLists(String username) {
        cacheSupport.evictIndexed(buildUserIndexKey(username), buildLegacyUserIndexKey(username));
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

    private String buildRedisKey(NotificationListCacheKey key) {
        return keyPrefix + ":"
                + encode(key.username())
                + ":"
                + key.limit()
                + ":"
                + encode(key.type())
                + ":"
                + unreadToken(key.unread())
                + ":"
                + encode(key.actorUsername());
    }

    private String buildUserIndexKey(String username) {
        return keyPrefix + ":" + encode(username) + ":index";
    }

    private String buildLegacyRedisKey(NotificationListCacheKey key) {
        return legacyKeyPrefix + ":"
                + encode(key.username())
                + ":"
                + key.limit()
                + ":"
                + encode(key.type())
                + ":"
                + unreadToken(key.unread())
                + ":"
                + encode(key.actorUsername());
    }

    private String buildLegacyUserIndexKey(String username) {
        return legacyKeyPrefix + ":keys:" + encode(username);
    }

    private String unreadToken(Boolean unread) {
        if (unread == null) {
            return "all";
        }
        return unread ? "unread" : "read";
    }

    private String encode(String value) {
        return CacheKeyEncoder.encodeNullable(value);
    }
}
