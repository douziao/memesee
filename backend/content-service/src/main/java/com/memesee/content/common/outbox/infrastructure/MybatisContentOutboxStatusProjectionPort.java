package com.memesee.content.common.outbox.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.common.outbox.application.ContentOutboxStatusProjectionPort;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.projection.content-outbox-status",
        name = "mode",
        havingValue = "mybatis",
        matchIfMissing = true
)
public class MybatisContentOutboxStatusProjectionPort implements ContentOutboxStatusProjectionPort {

    private static final String PROJECTION_NAME = "content-outbox-status";
    private static final String ADAPTER_NAME = "mybatis";

    private final MybatisContentOutboxStatusProjectionMapper mybatisContentOutboxStatusProjectionMapper;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public MybatisContentOutboxStatusProjectionPort(
            MybatisContentOutboxStatusProjectionMapper mybatisContentOutboxStatusProjectionMapper,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.mybatisContentOutboxStatusProjectionMapper = mybatisContentOutboxStatusProjectionMapper;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public BacklogProjection loadBacklog() {
        MybatisContentOutboxBacklogRow row = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "backlog",
                mybatisContentOutboxStatusProjectionMapper::selectBacklog
        );
        if (row == null) {
            return new BacklogProjection(0L, 0L, 0L, 0L);
        }
        return new BacklogProjection(
                safeLong(row.getPendingCount()),
                safeLong(row.getProcessingCount()),
                safeLong(row.getProcessedCount()),
                safeLong(row.getFailedCount())
        );
    }

    @Override
    public Optional<PendingEventProjection> loadOldestPendingEvent() {
        MybatisContentOutboxPendingEventRow row = projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "oldest-pending",
                mybatisContentOutboxStatusProjectionMapper::selectOldestPendingEvent
        );
        return Optional.ofNullable(row).map(this::toPendingProjection);
    }

    @Override
    public List<FailedEventProjection> loadRecentFailedEvents(int limit) {
        int safeLimit = Math.max(1, limit);
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "recent-failed",
                () -> mybatisContentOutboxStatusProjectionMapper.selectRecentFailedEvents(safeLimit)
        ).stream()
                .map(this::toFailedProjection)
                .toList();
    }

    private PendingEventProjection toPendingProjection(MybatisContentOutboxPendingEventRow row) {
        return new PendingEventProjection(
                row.getId(),
                row.getEventType(),
                row.getAggregateType(),
                row.getAggregateId(),
                row.getAttemptCount() == null ? 0 : row.getAttemptCount(),
                toInstant(row.getCreatedAt()),
                toInstant(row.getAvailableAt())
        );
    }

    private FailedEventProjection toFailedProjection(MybatisContentOutboxFailedEventRow row) {
        return new FailedEventProjection(
                row.getId(),
                row.getEventType(),
                row.getAggregateType(),
                row.getAggregateId(),
                row.getAttemptCount() == null ? 0 : row.getAttemptCount(),
                toInstant(row.getCreatedAt()),
                row.getLastError()
        );
    }

    private long safeLong(Long value) {
        return value == null ? 0L : value;
    }

    private Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }
}
