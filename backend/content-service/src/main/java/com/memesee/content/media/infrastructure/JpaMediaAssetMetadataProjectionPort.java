package com.memesee.content.media.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.media.application.MediaAssetMetadataProjectionPort;
import com.memesee.content.media.application.MediaAssetMetadataProjectionPort.MediaAssetMetadataProjection;
import com.memesee.content.media.domain.MediaAsset;
import com.memesee.content.media.domain.MediaAssetStatus;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.media-asset-metadata",
        name = "mode",
        havingValue = "jpa"
)
public class JpaMediaAssetMetadataProjectionPort implements MediaAssetMetadataProjectionPort {

    private static final String PROJECTION_NAME = "media-asset-metadata";
    private static final String ADAPTER_NAME = "jpa";

    private final MediaAssetRepository mediaAssetRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaMediaAssetMetadataProjectionPort(
            MediaAssetRepository mediaAssetRepository,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public Optional<MediaAssetMetadataProjection> loadActiveMediaAsset(Long assetId) {
        if (assetId == null) {
            return Optional.empty();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "active-media-asset",
                () -> mediaAssetRepository.findByIdAndStatus(assetId, MediaAssetStatus.ACTIVE)
                        .map(this::toProjection)
        );
    }

    @Override
    public List<MediaAssetMetadataProjection> loadOwnedActiveMediaAssets(String ownerUsername, Collection<Long> assetIds) {
        List<Long> normalizedAssetIds = normalizeIds(assetIds);
        if (normalizedAssetIds.isEmpty()) {
            return List.of();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "owned-active-media-assets",
                () -> loadOwnedActiveMediaAssetsInternal(ownerUsername, normalizedAssetIds)
        );
    }

    private List<MediaAssetMetadataProjection> loadOwnedActiveMediaAssetsInternal(
            String ownerUsername,
            List<Long> assetIds
    ) {
        Map<Long, MediaAssetMetadataProjection> projectionsById = new LinkedHashMap<>();
        mediaAssetRepository.findAllByOwnerUsernameAndIdInAndStatus(ownerUsername, assetIds, MediaAssetStatus.ACTIVE)
                .forEach(asset -> projectionsById.put(asset.getId(), toProjection(asset)));
        List<MediaAssetMetadataProjection> projections = new ArrayList<>();
        for (Long assetId : assetIds) {
            MediaAssetMetadataProjection projection = projectionsById.get(assetId);
            if (projection != null) {
                projections.add(projection);
            }
        }
        return List.copyOf(projections);
    }

    private MediaAssetMetadataProjection toProjection(MediaAsset asset) {
        return new MediaAssetMetadataProjection(
                asset.getId(),
                asset.getPublicId(),
                asset.getOwnerUsername(),
                asset.getKind(),
                asset.getBucketName(),
                asset.getObjectKey(),
                asset.getOriginalFilename(),
                asset.getContentType(),
                asset.getSizeBytes(),
                asset.getProcessingStatus().name(),
                asset.getBlurDataUrl()
        );
    }

    private List<Long> normalizeIds(Collection<Long> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> normalizedIds = new LinkedHashSet<>();
        assetIds.stream()
                .filter(Objects::nonNull)
                .forEach(normalizedIds::add);
        return List.copyOf(normalizedIds);
    }
}
