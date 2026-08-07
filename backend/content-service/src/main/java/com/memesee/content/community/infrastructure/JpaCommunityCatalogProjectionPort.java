package com.memesee.content.community.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.community.application.CommunityCatalogProjectionPort;
import com.memesee.content.community.domain.Community;
import java.util.Collection;
import java.util.Comparator;
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
        havingValue = "jpa"
)
public class JpaCommunityCatalogProjectionPort implements CommunityCatalogProjectionPort {

    private static final String PROJECTION_NAME = "community-catalog";
    private static final String ADAPTER_NAME = "jpa";

    private static final Comparator<Community> COMMUNITY_ORDER =
            Comparator.comparingInt(Community::getSortOrder).thenComparing(Community::getId);

    private final CommunityRepository communityRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaCommunityCatalogProjectionPort(
            CommunityRepository communityRepository,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.communityRepository = communityRepository;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public List<CommunityCatalogProjection> loadCommunityCatalog() {
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "community-list",
                () -> communityRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                        .map(this::toProjection)
                        .toList()
        );
    }

    @Override
    public Optional<CommunityCatalogProjection> loadCommunityBySlug(String slug) {
        if (slug == null || slug.isBlank()) {
            return Optional.empty();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "community-by-slug",
                () -> communityRepository.findBySlug(slug).map(this::toProjection)
        );
    }

    @Override
    public Optional<CommunityCatalogProjection> loadCommunityById(Long communityId) {
        if (communityId == null) {
            return Optional.empty();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "community-by-id",
                () -> communityRepository.findById(communityId).map(this::toProjection)
        );
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
                () -> communityRepository.findAllById(normalizedIds).stream()
                        .sorted(COMMUNITY_ORDER)
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

    private CommunityCatalogProjection toProjection(Community community) {
        return new CommunityCatalogProjection(
                community.getId(),
                community.getSlug(),
                community.getName(),
                community.getDescription(),
                community.getSortOrder()
        );
    }
}
