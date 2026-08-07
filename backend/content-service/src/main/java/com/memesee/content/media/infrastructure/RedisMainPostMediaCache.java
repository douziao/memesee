package com.memesee.content.media.infrastructure;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.VersionedJsonCachePayloadCodec;
import com.memesee.platform.cache.VersionedJsonRedisCacheSupport;
import com.memesee.content.media.dto.MediaAssetResponse;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisMainPostMediaCache implements MainPostMediaCache {

    private static final TypeReference<List<MediaAssetResponse>> MEDIA_TYPE = new TypeReference<>() {
    };

    private final Duration ttl;
    private final Duration freshnessTtl;
    private final String keyPrefix;
    private final VersionedJsonRedisCacheSupport cacheSupport;

    public RedisMainPostMediaCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MainPostMediaCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this.ttl = properties.getTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.cacheSupport = new VersionedJsonRedisCacheSupport(
                redisTemplate,
                new VersionedJsonCachePayloadCodec(objectMapper, properties.getSerializationVersion()),
                new CacheMetricsRecorder(meterRegistry, "main-post-media"),
                "main-post-media",
                PlatformLocalCache.create(properties.getLocalCache())
        );
    }

    @Override
    public Optional<List<MediaAssetResponse>> getMedia(Long mainPostId) {
        return cacheSupport.read(buildRedisKey(mainPostId), null, MEDIA_TYPE);
    }

    @Override
    public PlatformCacheReadResult<List<MediaAssetResponse>> getMediaSnapshot(Long mainPostId) {
        return cacheSupport.readSnapshot(
                buildRedisKey(mainPostId),
                null,
                MEDIA_TYPE,
                freshnessTtl
        );
    }

    @Override
    public void putMedia(Long mainPostId, List<MediaAssetResponse> mediaAssets) {
        if (mainPostId == null || mediaAssets == null) {
            return;
        }
        cacheSupport.write(buildRedisKey(mainPostId), mediaAssets, ttl);
    }

    @Override
    public void evictMedia(Long mainPostId) {
        if (mainPostId == null) {
            return;
        }
        cacheSupport.evict(buildRedisKey(mainPostId), null);
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

    private String buildRedisKey(Long mainPostId) {
        return keyPrefix + ":" + String.valueOf(mainPostId) + ":attachments";
    }
}
