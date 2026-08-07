package com.memesee.content.community.infrastructure;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.platform.cache.CacheMetricsRecorder;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformLocalCache;
import com.memesee.platform.cache.VersionedJsonCachePayloadCodec;
import com.memesee.platform.cache.VersionedJsonRedisCacheSupport;
import com.memesee.content.community.dto.CommunityResponse;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisCommunityCatalogCache implements CommunityCatalogCache {

    private static final TypeReference<List<CommunityResponse>> COMMUNITY_LIST_TYPE = new TypeReference<>() {
    };

    private final Duration ttl;
    private final Duration nullValueTtl;
    private final Duration freshnessTtl;
    private final String keyPrefix;
    private final String legacyKeyPrefix;
    private final VersionedJsonRedisCacheSupport cacheSupport;

    public RedisCommunityCatalogCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            CommunityCatalogCacheProperties properties,
            MeterRegistry meterRegistry
    ) {
        this.ttl = properties.getTtl();
        this.nullValueTtl = properties.getNullValueTtl();
        this.freshnessTtl = properties.getFreshnessTtl();
        this.keyPrefix = properties.getKeyPrefix();
        this.legacyKeyPrefix = properties.getLegacyKeyPrefix();
        this.cacheSupport = new VersionedJsonRedisCacheSupport(
                redisTemplate,
                new VersionedJsonCachePayloadCodec(objectMapper, properties.getSerializationVersion()),
                new CacheMetricsRecorder(meterRegistry, "community-catalog"),
                "community-catalog",
                PlatformLocalCache.create(properties.getLocalCache())
        );
    }

    @Override
    public Optional<List<CommunityResponse>> getCommunityList() {
        return readValue(buildCommunityListKey(), buildLegacyCommunityListKey(), COMMUNITY_LIST_TYPE);
    }

    @Override
    public PlatformCacheReadResult<List<CommunityResponse>> getCommunityListSnapshot() {
        return cacheSupport.readSnapshot(
                buildCommunityListKey(),
                buildLegacyCommunityListKey(),
                COMMUNITY_LIST_TYPE,
                freshnessTtl
        );
    }

    @Override
    public Optional<CommunityResponse> getCommunity(String slug) {
        return readValue(buildCommunityKey(slug), buildLegacyCommunityKey(slug), CommunityResponse.class);
    }

    @Override
    public PlatformCacheReadResult<CommunityResponse> getCommunitySnapshot(String slug) {
        return cacheSupport.readSnapshot(
                buildCommunityKey(slug),
                buildLegacyCommunityKey(slug),
                CommunityResponse.class,
                freshnessTtl
        );
    }

    @Override
    public Optional<CommunityResponse> getCommunityById(Long communityId) {
        if (communityId == null) {
            return Optional.empty();
        }
        return readValue(buildCommunityByIdKey(communityId), buildLegacyCommunityByIdKey(communityId), CommunityResponse.class);
    }

    @Override
    public PlatformCacheReadResult<CommunityResponse> getCommunityByIdSnapshot(Long communityId) {
        if (communityId == null) {
            return PlatformCacheReadResult.miss();
        }
        return cacheSupport.readSnapshot(
                buildCommunityByIdKey(communityId),
                buildLegacyCommunityByIdKey(communityId),
                CommunityResponse.class,
                freshnessTtl
        );
    }

    @Override
    public void putCommunityList(List<CommunityResponse> communities) {
        writeValue(buildCommunityListKey(), communities);
        communities.forEach(this::putCommunity);
    }

    @Override
    public void putCommunity(CommunityResponse community) {
        if (community == null || community.slug() == null || community.slug().isBlank()) {
            return;
        }
        writeValue(buildCommunityKey(community.slug()), community);
        if (community.id() != null) {
            writeValue(buildCommunityByIdKey(community.id()), community);
        }
    }

    @Override
    public void evictCommunityCatalog() {
        cacheSupport.evict(buildCommunityListKey(), buildLegacyCommunityListKey());
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

    @Override
    public void putMissingCommunity(String slug) {
        if (slug == null || slug.isBlank()) {
            return;
        }
        cacheSupport.writeNull(buildCommunityKey(slug), nullValueTtl);
    }

    @Override
    public void putMissingCommunityById(Long communityId) {
        if (communityId == null) {
            return;
        }
        cacheSupport.writeNull(buildCommunityByIdKey(communityId), nullValueTtl);
    }

    private String buildCommunityKey(String slug) {
        return keyPrefix + ":slug:" + slug + ":detail";
    }

    private String buildCommunityByIdKey(Long communityId) {
        return keyPrefix + ":id:" + communityId + ":detail";
    }

    private String buildCommunityListKey() {
        return keyPrefix + ":all:list";
    }

    private String buildLegacyCommunityKey(String slug) {
        return legacyKeyPrefix + ":item:" + slug;
    }

    private String buildLegacyCommunityByIdKey(Long communityId) {
        return legacyKeyPrefix + ":id:" + communityId;
    }

    private String buildLegacyCommunityListKey() {
        return legacyKeyPrefix + ":list";
    }

    private <T> Optional<T> readValue(String key, String legacyKey, Class<T> targetType) {
        return cacheSupport.read(key, legacyKey, targetType);
    }

    private <T> Optional<T> readValue(String key, String legacyKey, TypeReference<T> targetType) {
        return cacheSupport.read(key, legacyKey, targetType);
    }

    private void writeValue(String key, Object value) {
        cacheSupport.write(key, value, ttl);
    }
}
