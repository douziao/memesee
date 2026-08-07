package com.memesee.user.infrastructure.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.CacheKeyEncoder;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.VersionedJsonCachePayloadCodec;
import com.memesee.platform.cache.VersionedJsonRedisCacheSupport;
import com.memesee.user.service.ProgressSnapshot;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisUserProgressSnapshotCache implements UserProgressSnapshotCache {

    private final Duration ttl;
    private final Duration freshnessTtl;
    private final String keyPrefix;
    private final String legacyKeyPrefix;
    private final VersionedJsonRedisCacheSupport cacheSupport;

    public RedisUserProgressSnapshotCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            UserProgressSnapshotCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this.ttl = properties.getTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.legacyKeyPrefix = properties.getLegacyKeyPrefix();
        this.cacheSupport = new VersionedJsonRedisCacheSupport(
                redisTemplate,
                new VersionedJsonCachePayloadCodec(objectMapper, properties.getSerializationVersion()),
                new CacheMetricsRecorder(meterRegistry, "user-progress-snapshot"),
                "user-progress-snapshot",
                PlatformLocalCache.create(properties.getLocalCache())
        );
    }

    @Override
    public Optional<ProgressSnapshot> getSnapshot(String username) {
        return cacheSupport.read(buildRedisKey(username), buildLegacyRedisKey(username), ProgressSnapshot.class);
    }

    @Override
    public PlatformCacheReadResult<ProgressSnapshot> getSnapshotSnapshot(String username) {
        return cacheSupport.readSnapshot(
                buildRedisKey(username),
                buildLegacyRedisKey(username),
                ProgressSnapshot.class,
                freshnessTtl
        );
    }

    @Override
    public void putSnapshot(String username, ProgressSnapshot snapshot) {
        cacheSupport.writeIndexed(buildRedisKey(username), buildIndexKey(), snapshot, ttl);
    }

    @Override
    public void evictSnapshot(String username) {
        cacheSupport.evict(buildRedisKey(username), buildLegacyRedisKey(username));
    }

    @Override
    public void evictAllSnapshots() {
        cacheSupport.evictIndexed(buildIndexKey(), buildLegacyIndexKey());
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
        return keyPrefix + ":" + encode(username) + ":snapshot";
    }

    private String buildIndexKey() {
        return keyPrefix + ":index";
    }

    private String buildLegacyRedisKey(String username) {
        return legacyKeyPrefix + ":" + encode(username);
    }

    private String buildLegacyIndexKey() {
        return legacyKeyPrefix + ":keys";
    }

    private String encode(String value) {
        return CacheKeyEncoder.encodeNullable(value);
    }
}
