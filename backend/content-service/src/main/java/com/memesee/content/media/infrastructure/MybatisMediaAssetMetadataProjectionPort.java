package com.memesee.content.media.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.media.application.MediaAssetMetadataProjectionPort;
import com.memesee.content.media.application.MediaAssetMetadataProjectionPort.MediaAssetMetadataProjection;
import com.memesee.content.media.domain.MediaAssetKind;
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
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisMediaAssetMetadataProjectionPort implements MediaAssetMetadataProjectionPort {

    private static final String PROJECTION_NAME = "media-asset-metadata";
    private static final String ADAPTER_NAME = "mybatis";

    private final MybatisMediaAssetMetadataProjectionMapper mybatisMediaAssetMetadataProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisMediaAssetMetadataProjectionPort(
            MybatisMediaAssetMetadataProjectionMapper mybatisMediaAssetMetadataProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisMediaAssetMetadataProjectionMapper = mybatisMediaAssetMetadataProjectionMapper;
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
                () -> Optional.ofNullable(mybatisMediaAssetMetadataProjectionMapper.selectActiveMediaAsset(assetId))
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
                () -> mapRowsPreservingOrder(
                        normalizedAssetIds,
                        mybatisMediaAssetMetadataProjectionMapper.selectOwnedActiveMediaAssets(
                                ownerUsername,
                                normalizedAssetIds
                        )
                )
        );
    }

    private List<MediaAssetMetadataProjection> mapRowsPreservingOrder(
            List<Long> assetIds,
            List<MybatisMediaAssetMetadataProjectionRow> rows
    ) {
        Map<Long, MediaAssetMetadataProjection> projectionsById = new LinkedHashMap<>();
        rows.forEach(row -> projectionsById.put(row.getAssetId(), toProjection(row)));
        List<MediaAssetMetadataProjection> projections = new ArrayList<>();
        for (Long assetId : assetIds) {
            MediaAssetMetadataProjection projection = projectionsById.get(assetId);
            if (projection != null) {
                projections.add(projection);
            }
        }
        return List.copyOf(projections);
    }

    private MediaAssetMetadataProjection toProjection(MybatisMediaAssetMetadataProjectionRow row) {
        return new MediaAssetMetadataProjection(
                row.getAssetId(),
                row.getPublicId(),
                row.getOwnerUsername(),
                toKind(row.getKind()),
                row.getBucketName(),
                row.getObjectKey(),
                row.getOriginalFilename(),
                row.getContentType(),
                safeLong(row.getSizeBytes()),
                row.getProcessingStatus(),
                row.getBlurDataUrl()
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

    private MediaAssetKind toKind(String kind) {
        return kind == null ? null : MediaAssetKind.valueOf(kind);
    }

    private long safeLong(Long value) {
        return value == null ? 0L : value;
    }
}
