package com.memesee.content.common.outbox.infrastructure;

import com.memesee.content.common.observability.ProjectionQueryMetricsRecorder;
import com.memesee.content.common.outbox.application.ContentOutboxStatusProjectionPort;
import com.memesee.content.common.outbox.domain.ContentOutboxEvent;
import com.memesee.content.common.outbox.domain.ContentOutboxEventStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "app.projection.content-outbox-status", name = "mode", havingValue = "jpa")
public class JpaContentOutboxStatusProjectionPort implements ContentOutboxStatusProjectionPort {

    private static final String PROJECTION_NAME = "content-outbox-status";
    private static final String ADAPTER_NAME = "jpa";

    private final ContentOutboxEventRepository contentOutboxEventRepository;
    private final ProjectionQueryMetricsRecorder projectionQueryMetricsRecorder;

    public JpaContentOutboxStatusProjectionPort(
            ContentOutboxEventRepository contentOutboxEventRepository,
            ObjectProvider<ProjectionQueryMetricsRecorder> projectionQueryMetricsRecorderProvider
    ) {
        this.contentOutboxEventRepository = contentOutboxEventRepository;
        this.projectionQueryMetricsRecorder = projectionQueryMetricsRecorderProvider
                .getIfAvailable(ProjectionQueryMetricsRecorder::noop);
    }

    @Override
    public BacklogProjection loadBacklog() {
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "backlog",
                () -> new BacklogProjection(
                        contentOutboxEventRepository.countByStatus(ContentOutboxEventStatus.PENDING),
                        contentOutboxEventRepository.countByStatus(ContentOutboxEventStatus.PROCESSING),
                        contentOutboxEventRepository.countByStatus(ContentOutboxEventStatus.PROCESSED),
                        contentOutboxEventRepository.countByStatus(ContentOutboxEventStatus.FAILED)
                )
        );
    }

    @Override
    public Optional<PendingEventProjection> loadOldestPendingEvent() {
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "oldest-pending",
                () -> contentOutboxEventRepository.findFirstByStatusOrderByCreatedAtAscIdAsc(ContentOutboxEventStatus.PENDING)
                        .map(this::toPendingProjection)
        );
    }

    @Override
    public List<FailedEventProjection> loadRecentFailedEvents(int limit) {
        int safeLimit = Math.max(1, limit);
        return projectionQueryMetricsRecorder.record(
                PROJECTION_NAME,
                ADAPTER_NAME,
                "recent-failed",
                () -> contentOutboxEventRepository.findAllByStatusOrderByCreatedAtDescIdDesc(
                                ContentOutboxEventStatus.FAILED,
                                PageRequest.of(0, safeLimit)
                        ).stream()
                        .map(this::toFailedProjection)
                        .toList()
        );
    }

    private PendingEventProjection toPendingProjection(ContentOutboxEvent event) {
        return new PendingEventProjection(
                event.getId(),
                event.getEventType(),
                event.getAggregateType(),
                event.getAggregateId(),
                event.getAttemptCount(),
                event.getCreatedAt(),
                event.getAvailableAt()
        );
    }

    private FailedEventProjection toFailedProjection(ContentOutboxEvent event) {
        return new FailedEventProjection(
                event.getId(),
                event.getEventType(),
                event.getAggregateType(),
                event.getAggregateId(),
                event.getAttemptCount(),
                event.getCreatedAt(),
                event.getLastError()
        );
    }
}
