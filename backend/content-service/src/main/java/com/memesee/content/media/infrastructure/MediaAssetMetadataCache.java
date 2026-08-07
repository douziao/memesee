package com.memesee.content.media.infrastructure;

import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.Optional;

public interface MediaAssetMetadataCache {

    Optional<MediaAssetResponse> getMediaAsset(Long assetId);

    default PlatformCacheReadResult<MediaAssetResponse> getMediaAssetSnapshot(Long assetId) {
        return getMediaAsset(assetId)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putMediaAsset(MediaAssetResponse response);

    default void evictMediaAsset(Long assetId) {
    }

    default void putMissingMediaAsset(Long assetId) {
    }

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
