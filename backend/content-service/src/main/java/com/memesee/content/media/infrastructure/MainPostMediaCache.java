package com.memesee.content.media.infrastructure;

import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.platform.cache.PlatformCacheReadResult;
import java.util.List;
import java.util.Optional;

public interface MainPostMediaCache {

    Optional<List<MediaAssetResponse>> getMedia(Long mainPostId);

    default PlatformCacheReadResult<List<MediaAssetResponse>> getMediaSnapshot(Long mainPostId) {
        return getMedia(mainPostId)
                .map(value -> PlatformCacheReadResult.hit(Optional.of(value), false))
                .orElseGet(PlatformCacheReadResult::miss);
    }

    void putMedia(Long mainPostId, List<MediaAssetResponse> mediaAssets);

    void evictMedia(Long mainPostId);

    default void recordLoaderHit() {
    }

    default void recordRequestMerge() {
    }

    default void recordRefresh() {
    }

    default void recordRefreshMerge() {
    }
}
