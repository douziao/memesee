package com.memesee.content.feed.infrastructure;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.feed.dto.FeedPageResponse;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import com.memesee.platform.cache.CacheKeyEncoder;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.VersionedJsonCachePayloadCodec;
import com.memesee.platform.cache.VersionedJsonRedisCacheSupport;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisMainPostFeedPageCache implements MainPostFeedPageCache {

    private static final TypeReference<FeedPageResponse<MainPostSummaryResponse>> FEED_PAGE_TYPE =
            new TypeReference<>() {
            };

    private final Duration ttl;
    private final Duration freshnessTtl;
    private final String keyPrefix;
    private final VersionedJsonRedisCacheSupport cacheSupport;

    public RedisMainPostFeedPageCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MainPostFeedPageCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this.ttl = properties.getTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.cacheSupport = new VersionedJsonRedisCacheSupport(
                redisTemplate,
                new VersionedJsonCachePayloadCodec(objectMapper, properties.getSerializationVersion()),
                new CacheMetricsRecorder(meterRegistry, "main-post-feed-page"),
                "main-post-feed-page",
                PlatformLocalCache.create(properties.getLocalCache())
        );
    }

    @Override
    public Optional<FeedPageResponse<MainPostSummaryResponse>> getFeedPage(MainPostFeedPageCacheKey key) {
        return cacheSupport.read(buildRedisKey(key), null, FEED_PAGE_TYPE);
    }

    @Override
    public PlatformCacheReadResult<FeedPageResponse<MainPostSummaryResponse>> getFeedPageSnapshot(
            MainPostFeedPageCacheKey key
    ) {
        return cacheSupport.readSnapshot(buildRedisKey(key), null, FEED_PAGE_TYPE, freshnessTtl);
    }

    @Override
    public void putFeedPage(MainPostFeedPageCacheKey key, FeedPageResponse<MainPostSummaryResponse> response) {
        cacheSupport.writeIndexed(buildRedisKey(key), buildIndexKey(), response, ttl);
    }

    @Override
    public void evictAllFeedPages() {
        cacheSupport.evictIndexed(buildIndexKey(), null);
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

    private String buildRedisKey(MainPostFeedPageCacheKey key) {
        return keyPrefix + ":"
                + encodeNullable(key.communitySlug()) + ":"
                + encodeNullable(key.sortMode()) + ":"
                + encodeNullable(key.cursor()) + ":"
                + key.size();
    }

    private String buildIndexKey() {
        return keyPrefix + ":index";
    }

    private String encodeNullable(String value) {
        return CacheKeyEncoder.encodeNullable(value);
    }
}
