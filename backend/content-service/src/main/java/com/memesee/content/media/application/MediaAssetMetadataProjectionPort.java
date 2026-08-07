package com.memesee.content.media.application;

import com.memesee.content.media.domain.MediaAssetKind;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MediaAssetMetadataProjectionPort {

    Optional<MediaAssetMetadataProjection> loadActiveMediaAsset(Long assetId);

    List<MediaAssetMetadataProjection> loadOwnedActiveMediaAssets(String ownerUsername, Collection<Long> assetIds);

    record MediaAssetMetadataProjection(
            Long assetId,
            String publicId,
            String ownerUsername,
            MediaAssetKind kind,
            String bucketName,
            String objectKey,
            String originalFilename,
            String contentType,
            long sizeBytes,
            String processingStatus,
            String blurDataUrl
    ) {
    }
}
