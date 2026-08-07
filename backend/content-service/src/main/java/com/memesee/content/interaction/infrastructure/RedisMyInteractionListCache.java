package com.memesee.content.interaction.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.CacheKeyEncoder;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.VersionedJsonCachePayloadCodec;
import com.memesee.platform.cache.VersionedJsonRedisCacheSupport;
import com.memesee.content.interaction.dto.MyInteractionListResponse;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisMyInteractionListCache implements MyInteractionListCache {

    private final Duration ttl;
    private final Duration freshnessTtl;
    private final String keyPrefix;
    private final String legacyKeyPrefix;
    private final VersionedJsonRedisCacheSupport cacheSupport;

    public RedisMyInteractionListCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MyInteractionListCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this.ttl = properties.getTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.legacyKeyPrefix = properties.getLegacyKeyPrefix();
        this.cacheSupport = new VersionedJsonRedisCacheSupport(
                redisTemplate,
                new VersionedJsonCachePayloadCodec(objectMapper, properties.getSerializationVersion()),
                new CacheMetricsRecorder(meterRegistry, "my-interaction-list"),
                "my-interaction-list",
                PlatformLocalCache.create(properties.getLocalCache())
        );
    }

    @Override
    public Optional<MyInteractionListResponse> getInteractionList(String username, int limit) {
        return cacheSupport.read(buildRedisKey(username, limit), buildLegacyRedisKey(username, limit), MyInteractionListResponse.class);
    }

    @Override
    public PlatformCacheReadResult<MyInteractionListResponse> getInteractionListSnapshot(String username, int limit) {
        return cacheSupport.readSnapshot(
                buildRedisKey(username, limit),
                buildLegacyRedisKey(username, limit),
                MyInteractionListResponse.class,
                freshnessTtl
        );
    }

    @Override
    public void putInteractionList(String username, int limit, MyInteractionListResponse response) {
        cacheSupport.writeIndexed(buildRedisKey(username, limit), buildUserIndexKey(username), response, ttl);
    }

    @Override
    public void evictInteractionLists(String username) {
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

    private String buildRedisKey(String username, int limit) {
        return keyPrefix + ":" + encode(username) + ":" + limit;
    }

    private String buildUserIndexKey(String username) {
        return keyPrefix + ":" + encode(username) + ":index";
    }

    private String buildLegacyRedisKey(String username, int limit) {
        return legacyKeyPrefix + ":" + encode(username) + ":" + limit;
    }

    private String buildLegacyUserIndexKey(String username) {
        return legacyKeyPrefix + ":keys:" + encode(username);
    }

    private String encode(String value) {
        return CacheKeyEncoder.encodeNullable(value);
    }
}
