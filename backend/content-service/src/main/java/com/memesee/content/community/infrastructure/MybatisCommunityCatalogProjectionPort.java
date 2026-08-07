package com.memesee.content.community.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.community.application.CommunityCatalogProjectionPort;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.community-catalog",
        name = "mode",
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisCommunityCatalogProjectionPort implements CommunityCatalogProjectionPort {

    private static final String PROJECTION_NAME = "community-catalog";
    private static final String ADAPTER_NAME = "mybatis";

    private final MybatisCommunityCatalogProjectionMapper mybatisCommunityCatalogProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisCommunityCatalogProjectionPort(
            MybatisCommunityCatalogProjectionMapper mybatisCommunityCatalogProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisCommunityCatalogProjectionMapper = mybatisCommunityCatalogProjectionMapper;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public List<CommunityCatalogProjection> loadCommunityCatalog() {
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "community-list",
                () -> mybatisCommunityCatalogProjectionMapper.selectCommunityCatalog().stream()
                        .map(this::toProjection)
                        .toList()
        );
    }

    @Override
    public Optional<CommunityCatalogProjection> loadCommunityBySlug(String slug) {
        if (slug == null || slug.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "community-by-slug",
                () -> mybatisCommunityCatalogProjectionMapper.selectCommunityBySlug(slug)
        )).map(this::toProjection);
    }

    @Override
    public Optional<CommunityCatalogProjection> loadCommunityById(Long communityId) {
        if (communityId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "community-by-id",
                () -> mybatisCommunityCatalogProjectionMapper.selectCommunityById(communityId)
        )).map(this::toProjection);
    }

    @Override
    public List<CommunityCatalogProjection> loadCommunitiesByIds(Collection<Long> communityIds) {
        List<Long> normalizedIds = normalizeIds(communityIds);
        if (normalizedIds.isEmpty()) {
            return List.of();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "community-by-ids",
                () -> mybatisCommunityCatalogProjectionMapper.selectCommunitiesByIds(normalizedIds).stream()
                        .map(this::toProjection)
                        .toList()
        );
    }

    private List<Long> normalizeIds(Collection<Long> communityIds) {
        if (communityIds == null || communityIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> normalizedIds = new LinkedHashSet<>();
        communityIds.stream()
                .filter(Objects::nonNull)
                .forEach(normalizedIds::add);
        return List.copyOf(normalizedIds);
    }

    private CommunityCatalogProjection toProjection(MybatisCommunityCatalogProjectionRow row) {
        return new CommunityCatalogProjection(
                row.getId(),
                row.getSlug(),
                row.getName(),
                row.getDescription(),
                row.getSortOrder() == null ? 0 : row.getSortOrder()
        );
    }
}
