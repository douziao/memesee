package com.memesee.content.interaction.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.interaction.application.InteractionTargetCountProjectionPort;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.interaction-target-count",
        name = "mode",
        havingValue = "jpa"
)
public class JpaInteractionTargetCountProjectionPort implements InteractionTargetCountProjectionPort {

    private static final String PROJECTION_NAME = "interaction-target-count";
    private static final String ADAPTER_NAME = "jpa";

    private final MainPostLikeRepository mainPostLikeRepository;
    private final MainPostFavoriteRepository mainPostFavoriteRepository;
    private final SubPostLikeRepository subPostLikeRepository;
    private final SubPostFavoriteRepository subPostFavoriteRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaInteractionTargetCountProjectionPort(
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
    public long loadMainPostLikeCount(Long mainPostId) {
        if (mainPostId == null) {
            return 0L;
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "main-post-like-count",
                () -> mainPostLikeRepository.countByMainPostId(mainPostId)
        );
    }

    @Override
    public long loadMainPostFavoriteCount(Long mainPostId) {
        if (mainPostId == null) {
            return 0L;
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "main-post-favorite-count",
                () -> mainPostFavoriteRepository.countByMainPostId(mainPostId)
        );
    }

    @Override
    public long loadSubPostLikeCount(Long subPostId) {
        if (subPostId == null) {
            return 0L;
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-like-count",
                () -> subPostLikeRepository.countBySubPostId(subPostId)
        );
    }

    @Override
    public long loadSubPostFavoriteCount(Long subPostId) {
        if (subPostId == null) {
            return 0L;
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "sub-post-favorite-count",
                () -> subPostFavoriteRepository.countBySubPostId(subPostId)
        );
    }
}
