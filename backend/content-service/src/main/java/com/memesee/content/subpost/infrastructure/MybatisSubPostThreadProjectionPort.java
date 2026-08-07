package com.memesee.content.subpost.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.subpost.application.SubPostThreadProjectionPort;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.sub-post-thread",
        name = "mode",
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisSubPostThreadProjectionPort implements SubPostThreadProjectionPort {

    private static final String PROJECTION_NAME = "sub-post-thread";
    private static final String ADAPTER_NAME = "mybatis";

    private final MybatisSubPostThreadProjectionMapper mybatisSubPostThreadProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisSubPostThreadProjectionPort(
            MybatisSubPostThreadProjectionMapper mybatisSubPostThreadProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisSubPostThreadProjectionMapper = mybatisSubPostThreadProjectionMapper;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public List<SubPostThreadProjection> loadThreadPage(
            Long mainPostId,
            Instant cursorCreatedAt,
            Long cursorSubPostId,
            int limit
    ) {
        if (mainPostId == null || limit <= 0) {
            return List.of();
        }
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "thread-page",
                () -> mybatisSubPostThreadProjectionMapper.selectPageByMainPostId(
                                mainPostId,
                                cursorCreatedAt == null ? null : Timestamp.from(cursorCreatedAt),
                                cursorSubPostId,
                                limit
                        )
                        .stream()
                        .map(this::toProjection)
                        .toList()
        );
    }

    private SubPostThreadProjection toProjection(MybatisSubPostThreadProjectionRow row) {
        return new SubPostThreadProjection(
                row.getId(),
                row.getMainPostId(),
                row.getParentSubPostId(),
                row.getParentSubPostAuthorUsername(),
                row.getAuthorUsername(),
                row.getContent(),
                row.getLikeCount(),
                row.getChildSubPostCount(),
                toInstant(row.getCreatedAt()),
                toInstant(row.getUpdatedAt())
        );
    }

    private Instant toInstant(java.sql.Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }
}
