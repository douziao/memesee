package com.memesee.content.common.outbox.application;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ContentOutboxStatusProjectionPort {

    BacklogProjection loadBacklog();

    Optional<PendingEventProjection> loadOldestPendingEvent();

    List<FailedEventProjection> loadRecentFailedEvents(int limit);

    record BacklogProjection(
            long pending,
            long processing,
            long processed,
            long failed
    ) {
    }

    record PendingEventProjection(
            Long id,
            String eventType,
            String aggregateType,
            String aggregateId,
            int attemptCount,
            Instant createdAt,
            Instant availableAt
    ) {
    }

    record FailedEventProjection(
            Long id,
            String eventType,
            String aggregateType,
            String aggregateId,
            int attemptCount,
            Instant createdAt,
            String lastError
    ) {
    }
}
