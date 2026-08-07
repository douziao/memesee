package com.memesee.content.media.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.media.application.MediaAttachmentProjectionPort;
import com.memesee.content.media.domain.MainPostMediaLink;
import com.memesee.content.media.domain.MediaAsset;
import com.memesee.content.media.domain.MediaAssetStatus;
import com.memesee.content.media.domain.SubPostMediaLink;
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
        havingValue = "jpa"
)
public class JpaMediaAttachmentProjectionPort implements MediaAttachmentProjectionPort {

    private static final String PROJECTION_NAME = "media-attachment";
    private static final String ADAPTER_NAME = "jpa";

    private final MainPostMediaLinkRepository mainPostMediaLinkRepository;
    private final SubPostMediaLinkRepository subPostMediaLinkRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaMediaAttachmentProjectionPort(
            MainPostMediaLinkRepository mainPostMediaLinkRepository,
            SubPostMediaLinkRepository subPostMediaLinkRepository,
            MediaAssetRepository mediaAssetRepository,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mainPostMediaLinkRepository = mainPostMediaLinkRepository;
        this.subPostMediaLinkRepository = subPostMediaLinkRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public Map<Long, List<MediaAttachmentProjection>> loadMainPostMedia(Collection<Long> mainPostIds) {
        List<Long> normalizedMainPostIds = normalizeIds(mainPostIds);
        if (normalizedMainPostIds.isEmpty()) {
            return Map.of();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "main-post-media",
                () -> loadMainPostMediaInternal(normalizedMainPostIds)
        );
    }

    @Override
    public Map<Long, List<MediaAttachmentProjection>> loadSubPostMedia(Collection<Long> subPostIds) {
        List<Long> normalizedSubPostIds = normalizeIds(subPostIds);
        if (normalizedSubPostIds.isEmpty()) {
            return Map.of();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-media",
                () -> loadSubPostMediaInternal(normalizedSubPostIds)
        );
    }

    private Map<Long, List<MediaAttachmentProjection>> loadMainPostMediaInternal(List<Long> mainPostIds) {
        Map<Long, List<MediaAttachmentProjection>> result = defaultMutableMap(mainPostIds);
        List<MainPostMediaLink> links =
                mainPostMediaLinkRepository.findAllByMainPostIdInOrderByMainPostIdAscSortOrderAscIdAsc(mainPostIds);
        if (links.isEmpty()) {
            return immutableCopy(result);
        }
        Map<Long, MediaAsset> assetsById = loadAssetsById(links.stream().map(MainPostMediaLink::getMediaAssetId).toList());
        links.forEach(link -> appendProjection(result, link.getMainPostId(), assetsById.get(link.getMediaAssetId())));
        return immutableCopy(result);
    }

    private Map<Long, List<MediaAttachmentProjection>> loadSubPostMediaInternal(List<Long> subPostIds) {
        Map<Long, List<MediaAttachmentProjection>> result = defaultMutableMap(subPostIds);
        List<SubPostMediaLink> links =
                subPostMediaLinkRepository.findAllBySubPostIdInOrderBySubPostIdAscSortOrderAscIdAsc(subPostIds);
        if (links.isEmpty()) {
            return immutableCopy(result);
        }
        Map<Long, MediaAsset> assetsById = loadAssetsById(links.stream().map(SubPostMediaLink::getMediaAssetId).toList());
        links.forEach(link -> appendProjection(result, link.getSubPostId(), assetsById.get(link.getMediaAssetId())));
        return immutableCopy(result);
    }

    private void appendProjection(
            Map<Long, List<MediaAttachmentProjection>> result,
            Long ownerId,
            MediaAsset asset
    ) {
        if (ownerId == null || asset == null) {
            return;
        }
        List<MediaAttachmentProjection> mediaAttachments = result.get(ownerId);
        if (mediaAttachments == null) {
            return;
        }
        mediaAttachments.add(toProjection(asset));
    }

    private Map<Long, MediaAsset> loadAssetsById(Collection<Long> assetIds) {
        Map<Long, MediaAsset> assetsById = new LinkedHashMap<>();
        mediaAssetRepository.findAllByIdInAndStatus(assetIds, MediaAssetStatus.ACTIVE)
                .forEach(asset -> assetsById.put(asset.getId(), asset));
        return assetsById;
    }

    private MediaAttachmentProjection toProjection(MediaAsset asset) {
        return new MediaAttachmentProjection(
                asset.getId(),
                asset.getPublicId(),
                asset.getKind().name(),
                asset.getBucketName(),
                asset.getObjectKey(),
                asset.getContentType(),
                asset.getOriginalFilename(),
                asset.getSizeBytes(),
                asset.getProcessingStatus().name(),
                asset.getBlurDataUrl()
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
}
