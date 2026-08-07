package com.memesee.content.media.infrastructure;

import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.List;
import java.util.Optional;

public interface SubPostMediaCache {

    Optional<List<MediaAssetResponse>> getMedia(Long subPostId);

    default PlatformCacheReadResult<List<MediaAssetResponse>> getMediaSnapshot(Long subPostId) {
        return getMedia(subPostId)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putMedia(Long subPostId, List<MediaAssetResponse> mediaAssets);

    void evictMedia(Long subPostId);

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
