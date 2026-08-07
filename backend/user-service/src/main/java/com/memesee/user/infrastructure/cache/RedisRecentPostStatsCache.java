package com.memesee.user.infrastructure.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.StringValueRedisCacheSupport;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisRecentPostStatsCache implements RecentPostStatsCache {

    private final Duration ttl;
    private final Duration freshnessTtl;
    private final String keyPrefix;
    private final String legacyKeyPrefix;
    private final StringValueRedisCacheSupport<Long> cacheSupport;

    public RedisRecentPostStatsCache(
            StringRedisTemplate redisTemplate,
            RecentPostStatsCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this(
                redisTemplate,
                properties,
                meterRegistry,
                new ObjectMapper().findAndRegisterModules()
        );
    }

    public RedisRecentPostStatsCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            RecentPostStatsCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this(redisTemplate, properties, meterRegistry, objectMapper);
    }

    public RedisRecentPostStatsCache(
            StringRedisTemplate redisTemplate,
            RecentPostStatsCacheProperties properties,
            MeterRegistry meterRegistry,
            ObjectMapper objectMapper
    ) {
        this.ttl = properties.getTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.legacyKeyPrefix = properties.getLegacyKeyPrefix();
        this.cacheSupport = new StringValueRedisCacheSupport<>(
                redisTemplate,
                new CacheMetricsRecorder(meterRegistry, "recent-post-stats"),
                "recent-post-stats",
                Long::parseLong,
                String::valueOf,
                PlatformLocalCache.create(properties.getLocalCache()),
                properties.getSerializationVersion(),
                objectMapper
        );
    }

    @Override
    public Optional<Long> getRecentCreatedPosts(int days) {
        return cacheSupport.read(buildRedisKey(days), buildLegacyRedisKey(days));
    }

    @Override
    public PlatformCacheReadResult<Long> getRecentCreatedPostsSnapshot(int days) {
        return cacheSupport.readSnapshot(buildRedisKey(days), buildLegacyRedisKey(days), freshnessTtl);
    }

    @Override
    public void putRecentCreatedPosts(int days, long count) {
        cacheSupport.writeIndexed(buildRedisKey(days), buildIndexKey(), count, ttl);
    }

    @Override
    public void evictRecentCreatedPosts() {
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

    private String buildRedisKey(int days) {
        return keyPrefix + ":created-count:" + days;
    }

    private String buildIndexKey() {
        return keyPrefix + ":created-count:index";
    }

    private String buildLegacyRedisKey(int days) {
        return legacyKeyPrefix + ":created-count:" + days;
    }

    private String buildLegacyIndexKey() {
        return legacyKeyPrefix + ":created-count:keys";
    }
}
