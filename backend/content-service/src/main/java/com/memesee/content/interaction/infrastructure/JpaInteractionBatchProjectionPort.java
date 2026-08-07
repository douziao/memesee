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
import java.util.stream.Collectors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "app.projection.interaction-batch", name = "mode", havingValue = "jpa")
public class JpaInteractionBatchProjectionPort implements InteractionBatchProjectionPort {

    private static final String PROJECTION_NAME = "interaction-batch";
    private static final String ADAPTER_NAME = "jpa";

    private final MainPostLikeRepository mainPostLikeRepository;
    private final MainPostFavoriteRepository mainPostFavoriteRepository;
    private final SubPostLikeRepository subPostLikeRepository;
    private final SubPostFavoriteRepository subPostFavoriteRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaInteractionBatchProjectionPort(
            MainPostLikeRepository mainPostLikeRepository,
            MainPostFavoriteRepository mainPostFavoriteRepository,
            SubPostLikeRepository subPostLikeRepository,
            SubPostFavoriteRepository subPostFavoriteRepository,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mainPostLikeRepository = mainPostLikeRepository;
        this.mainPostFavoriteRepository = mainPostFavoriteRepository;
        this.subPostLikeRepository = subPostLikeRepository;
        this.subPostFavoriteRepository = subPostFavoriteRepository;
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
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "main-post-viewer-state",
                () -> new ViewerInteractionProjection(
                        toIdSet(mainPostLikeRepository.findAllByMainPostIdInAndUsername(normalizedMainPostIds, normalizedUsername)
                                .stream()
                                .map(like -> like.getMainPostId())
                                .toList()),
                        toIdSet(mainPostFavoriteRepository.findAllByMainPostIdInAndUsername(normalizedMainPostIds, normalizedUsername)
                                .stream()
                                .map(favorite -> favorite.getMainPostId())
                                .toList())
                )
        );
    }

    @Override
    public Map<Long, Long> loadSubPostFavoriteCounts(Collection<Long> subPostIds) {
        List<Long> normalizedSubPostIds = normalizeIds(subPostIds);
        if (normalizedSubPostIds.isEmpty()) {
            return Map.of();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-favorite-counts",
                () -> {
                    Map<Long, Long> favoriteCounts = new LinkedHashMap<>();
                    subPostFavoriteRepository.countAllBySubPostIdIn(normalizedSubPostIds)
                            .forEach(view -> favoriteCounts.put(view.getTargetId(), view.getTotalCount()));
                    return favoriteCounts;
                }
        );
    }

    @Override
    public ViewerInteractionProjection loadSubPostViewerInteractionState(Collection<Long> subPostIds, String username) {
        List<Long> normalizedSubPostIds = normalizeIds(subPostIds);
        String normalizedUsername = normalizeUsername(username);
        if (normalizedSubPostIds.isEmpty() || normalizedUsername == null) {
            return ViewerInteractionProjection.empty();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-viewer-state",
                () -> new ViewerInteractionProjection(
                        toIdSet(subPostLikeRepository.findAllBySubPostIdInAndUsername(normalizedSubPostIds, normalizedUsername)
                                .stream()
                                .map(like -> like.getSubPostId())
                                .toList()),
                        toIdSet(subPostFavoriteRepository.findAllBySubPostIdInAndUsername(normalizedSubPostIds, normalizedUsername)
                                .stream()
                                .map(favorite -> favorite.getSubPostId())
                                .toList())
                )
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

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            return null;
        }
        return username.trim();
    }

    private Set<Long> toIdSet(List<Long> ids) {
        return ids.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
