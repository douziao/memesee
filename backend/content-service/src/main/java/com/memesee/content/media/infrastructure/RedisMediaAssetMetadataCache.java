package com.memesee.content.media.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.VersionedJsonCachePayloadCodec;
import com.memesee.platform.cache.VersionedJsonRedisCacheSupport;
import com.memesee.content.media.dto.MediaAssetResponse;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisMediaAssetMetadataCache implements MediaAssetMetadataCache {

    private final Duration ttl;
    private final Duration freshnessTtl;
    private final Duration nullValueTtl;
    private final String keyPrefix;
    private final VersionedJsonRedisCacheSupport cacheSupport;

    public RedisMediaAssetMetadataCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MediaAssetMetadataCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this.ttl = properties.getTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.nullValueTtl = properties.getNullValueTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.cacheSupport = new VersionedJsonRedisCacheSupport(
                redisTemplate,
                new VersionedJsonCachePayloadCodec(objectMapper, properties.getSerializationVersion()),
                new CacheMetricsRecorder(meterRegistry, "media-asset-metadata"),
                "media-asset-metadata",
                PlatformLocalCache.create(properties.getLocalCache())
        );
    }

    @Override
    public Optional<MediaAssetResponse> getMediaAsset(Long assetId) {
        return cacheSupport.read(buildRedisKey(assetId), null, MediaAssetResponse.class);
    }

    @Override
    public PlatformCacheReadResult<MediaAssetResponse> getMediaAssetSnapshot(Long assetId) {
        return cacheSupport.readSnapshot(
                buildRedisKey(assetId),
                null,
                MediaAssetResponse.class,
                freshnessTtl
        );
    }

    @Override
    public void putMediaAsset(MediaAssetResponse response) {
        if (response == null || response.id() == null) {
            return;
        }
        cacheSupport.write(buildRedisKey(response.id()), response, ttl);
    }

    @Override
    public void evictMediaAsset(Long assetId) {
        if (assetId == null) {
            return;
        }
        cacheSupport.evict(buildRedisKey(assetId), null);
    }

    @Override
    public void putMissingMediaAsset(Long assetId) {
        if (assetId == null) {
            return;
        }
        cacheSupport.writeNull(buildRedisKey(assetId), nullValueTtl);
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

    private String buildRedisKey(Long assetId) {
        return keyPrefix + ":" + String.valueOf(assetId) + ":detail";
    }
}
