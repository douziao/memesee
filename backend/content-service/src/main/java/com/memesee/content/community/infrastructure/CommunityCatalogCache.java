package com.memesee.content.community.infrastructure;

import com.memesee.content.community.dto.CommunityResponse;
import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.List;
import java.util.Optional;

public interface CommunityCatalogCache {

    Optional<List<CommunityResponse>> getCommunityList();

    default PlatformCacheReadResult<List<CommunityResponse>> getCommunityListSnapshot() {
        return getCommunityList()
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    Optional<CommunityResponse> getCommunity(String slug);

    Optional<CommunityResponse> getCommunityById(Long communityId);

    default PlatformCacheReadResult<CommunityResponse> getCommunitySnapshot(String slug) {
        return getCommunity(slug)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    default PlatformCacheReadResult<CommunityResponse> getCommunityByIdSnapshot(Long communityId) {
        return getCommunityById(communityId)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putCommunityList(List<CommunityResponse> communities);

    void putCommunity(CommunityResponse community);

    void evictCommunityCatalog();

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }

    default void putMissingCommunity(String slug) {
    }

    default void putMissingCommunityById(Long communityId) {
    }
}
