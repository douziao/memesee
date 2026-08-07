package com.memesee.content.interaction.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.interaction.application.InteractionBatchProjectionPort;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.interaction-batch",
        name = "mode",
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisInteractionBatchProjectionPort implements InteractionBatchProjectionPort {

    private static final String PROJECTION_NAME = "interaction-batch";
    private static final String ADAPTER_NAME = "mybatis";
    private static final String LIKE = "LIKE";
    private static final String FAVORITE = "FAVORITE";

    private final MybatisInteractionBatchProjectionMapper mybatisInteractionBatchProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisInteractionBatchProjectionPort(
            MybatisInteractionBatchProjectionMapper mybatisInteractionBatchProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisInteractionBatchProjectionMapper = mybatisInteractionBatchProjectionMapper;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public ViewerInteractionProjection loadMainPostViewerInteractionState(Collection<Long> mainPostIds, String username) {
        List<Long> normalizedMainPostIds = normalizeIds(mainPostIds);
        String normalizedUsername = normalizeUsername(username);
        if (normalizedMainPostIds.isEmpty() || normalizedUsername == null) {
            return ViewerInteractionProjection.empty();
        }
        List<MybatisInteractionBatchTargetRow> rows = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "main-post-viewer-state",
                () -> mybatisInteractionBatchProjectionMapper.selectMainPostViewerInteractions(
                        normalizedMainPostIds,
                        normalizedUsername
                )
        );
        return toViewerInteractionProjection(rows);
    }

    @Override
    public Map<Long, Long> loadSubPostFavoriteCounts(Collection<Long> subPostIds) {
        List<Long> normalizedSubPostIds = normalizeIds(subPostIds);
        if (normalizedSubPostIds.isEmpty()) {
            return Map.of();
        }
        List<MybatisInteractionBatchCountRow> rows = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-favorite-counts",
                () -> mybatisInteractionBatchProjectionMapper.selectSubPostFavoriteCounts(normalizedSubPostIds)
        );
        Map<Long, Long> favoriteCounts = new LinkedHashMap<>();
        rows.forEach(row -> favoriteCounts.put(row.getTargetId(), safeLong(row.getTotalCount())));
        return favoriteCounts;
    }

    @Override
    public ViewerInteractionProjection loadSubPostViewerInteractionState(Collection<Long> subPostIds, String username) {
        List<Long> normalizedSubPostIds = normalizeIds(subPostIds);
        String normalizedUsername = normalizeUsername(username);
        if (normalizedSubPostIds.isEmpty() || normalizedUsername == null) {
            return ViewerInteractionProjection.empty();
        }
        List<MybatisInteractionBatchTargetRow> rows = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-viewer-state",
                () -> mybatisInteractionBatchProjectionMapper.selectSubPostViewerInteractions(
                        normalizedSubPostIds,
                        normalizedUsername
                )
        );
        return toViewerInteractionProjection(rows);
    }

    private ViewerInteractionProjection toViewerInteractionProjection(List<MybatisInteractionBatchTargetRow> rows) {
        Set<Long> likedIds = new LinkedHashSet<>();
        Set<Long> favoritedIds = new LinkedHashSet<>();
        rows.forEach(row -> {
            if (LIKE.equals(row.getInteractionType())) {
                likedIds.add(row.getTargetId());
            } else if (FAVORITE.equals(row.getInteractionType())) {
                favoritedIds.add(row.getTargetId());
            }
        });
        return new ViewerInteractionProjection(Set.copyOf(likedIds), Set.copyOf(favoritedIds));
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

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            return null;
        }
        return username.trim();
    }

    private long safeLong(Long value) {
        return value == null ? 0L : value;
    }
}
