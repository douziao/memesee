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
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisInteractionTargetCountProjectionPort implements InteractionTargetCountProjectionPort {

    private static final String PROJECTION_NAME = "interaction-target-count";
    private static final String ADAPTER_NAME = "mybatis";

    private final MybatisInteractionTargetCountProjectionMapper mybatisInteractionTargetCountProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisInteractionTargetCountProjectionPort(
            MybatisInteractionTargetCountProjectionMapper mybatisInteractionTargetCountProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisInteractionTargetCountProjectionMapper = mybatisInteractionTargetCountProjectionMapper;
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
                () -> mybatisInteractionTargetCountProjectionMapper.selectMainPostLikeCount(mainPostId)
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
                () -> mybatisInteractionTargetCountProjectionMapper.selectMainPostFavoriteCount(mainPostId)
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
                () -> mybatisInteractionTargetCountProjectionMapper.selectSubPostLikeCount(subPostId)
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
                () -> mybatisInteractionTargetCountProjectionMapper.selectSubPostFavoriteCount(subPostId)
        );
    }
}
