package com.memesee.content.media.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.media.application.MediaAttachmentProjectionPort;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.media-attachment",
        name = "mode",
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisMediaAttachmentProjectionPort implements MediaAttachmentProjectionPort {

    private static final String PROJECTION_NAME = "media-attachment";
    private static final String ADAPTER_NAME = "mybatis";

    private final MybatisMediaAttachmentProjectionMapper mybatisMediaAttachmentProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisMediaAttachmentProjectionPort(
            MybatisMediaAttachmentProjectionMapper mybatisMediaAttachmentProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisMediaAttachmentProjectionMapper = mybatisMediaAttachmentProjectionMapper;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public Map<Long, List<MediaAttachmentProjection>> loadMainPostMedia(Collection<Long> mainPostIds) {
        List<Long> normalizedMainPostIds = normalizeIds(mainPostIds);
        if (normalizedMainPostIds.isEmpty()) {
            return Map.of();
        }
        List<MybatisMediaAttachmentProjectionRow> rows = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "main-post-media",
                () -> mybatisMediaAttachmentProjectionMapper.selectMainPostMedia(normalizedMainPostIds)
        );
        return groupRows(normalizedMainPostIds, rows);
    }

    @Override
    public Map<Long, List<MediaAttachmentProjection>> loadSubPostMedia(Collection<Long> subPostIds) {
        List<Long> normalizedSubPostIds = normalizeIds(subPostIds);
        if (normalizedSubPostIds.isEmpty()) {
            return Map.of();
        }
        List<MybatisMediaAttachmentProjectionRow> rows = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-media",
                () -> mybatisMediaAttachmentProjectionMapper.selectSubPostMedia(normalizedSubPostIds)
        );
        return groupRows(normalizedSubPostIds, rows);
    }

    private Map<Long, List<MediaAttachmentProjection>> groupRows(
            List<Long> ownerIds,
            List<MybatisMediaAttachmentProjectionRow> rows
    ) {
        Map<Long, List<MediaAttachmentProjection>> result = defaultMutableMap(ownerIds);
        rows.forEach(row -> {
            List<MediaAttachmentProjection> mediaAttachments = result.get(row.getOwnerId());
            if (mediaAttachments != null) {
                mediaAttachments.add(toProjection(row));
            }
        });
        return immutableCopy(result);
    }

    private MediaAttachmentProjection toProjection(MybatisMediaAttachmentProjectionRow row) {
        return new MediaAttachmentProjection(
                row.getAssetId(),
                row.getPublicId(),
                row.getKind(),
                row.getBucketName(),
                row.getObjectKey(),
                row.getContentType(),
                row.getOriginalFilename(),
                safeLong(row.getSizeBytes()),
                row.getProcessingStatus(),
                row.getBlurDataUrl()
        );
    }

    private List<Long> normalizeIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> normalizedIds = new LinkedHashSet<>();
        ids.stream()
                .filter(Objects::nonNull)
                .forEach(normalizedIds::add);
        return List.copyOf(normalizedIds);
    }

    private Map<Long, List<MediaAttachmentProjection>> defaultMutableMap(List<Long> ownerIds) {
        Map<Long, List<MediaAttachmentProjection>> result = new LinkedHashMap<>();
        ownerIds.forEach(ownerId -> result.put(ownerId, new java.util.ArrayList<>()));
        return result;
    }

    private Map<Long, List<MediaAttachmentProjection>> immutableCopy(
            Map<Long, List<MediaAttachmentProjection>> result
    ) {
        Map<Long, List<MediaAttachmentProjection>> copy = new LinkedHashMap<>();
        result.forEach((ownerId, projections) -> copy.put(ownerId, List.copyOf(projections)));
        return copy;
    }

    private long safeLong(Long value) {
        return value == null ? 0L : value;
    }
}
