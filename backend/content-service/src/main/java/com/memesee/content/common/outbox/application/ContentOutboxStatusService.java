package com.memesee.content.common.outbox.application;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ContentOutboxStatusService {

    private static final int DEFAULT_RECENT_FAILURE_LIMIT = 5;
    private static final int MAX_RECENT_FAILURE_LIMIT = 20;

    private final ContentOutboxStatusProjectionPort contentOutboxStatusProjectionPort;
    private final ContentOutboxProcessorProperties processorProperties;

    public ContentOutboxStatusService(
            ContentOutboxStatusProjectionPort contentOutboxStatusProjectionPort,
            ContentOutboxProcessorProperties processorProperties
    ) {
        this.contentOutboxStatusProjectionPort = contentOutboxStatusProjectionPort;
        this.processorProperties = processorProperties;
    }

    public ContentOutboxStatusView describe(Integer recentFailureLimit) {
        int safeRecentFailureLimit = normalizeRecentFailureLimit(recentFailureLimit);
        ContentOutboxStatusProjectionPort.BacklogProjection backlogProjection =
                contentOutboxStatusProjectionPort.loadBacklog();
        BacklogView backlog = new BacklogView(
                backlogProjection.pending(),
                backlogProjection.processing(),
                backlogProjection.processed(),
                backlogProjection.failed()
        );
        PendingEventView oldestPendingEvent = contentOutboxStatusProjectionPort
                .loadOldestPendingEvent()
                .map(this::toPendingEventView)
                .orElse(null);
        List<FailedEventView> recentFailedEvents = contentOutboxStatusProjectionPort
                .loadRecentFailedEvents(safeRecentFailureLimit)
                .stream()
                .map(this::toFailedEventView)
                .toList();

        return new ContentOutboxStatusView(
                Instant.now(),
                toProcessorSettingsView(),
                backlog,
                oldestPendingEvent,
                recentFailedEvents
        );
    }

    private int normalizeRecentFailureLimit(Integer recentFailureLimit) {
        if (recentFailureLimit == null || recentFailureLimit <= 0) {
            return DEFAULT_RECENT_FAILURE_LIMIT;
        }
        return Math.min(recentFailureLimit, MAX_RECENT_FAILURE_LIMIT);
    }

    private PendingEventView toPendingEventView(ContentOutboxStatusProjectionPort.PendingEventProjection event) {
        return new PendingEventView(
                event.id(),
                event.eventType(),
                event.aggregateType(),
                event.aggregateId(),
                event.attemptCount(),
                event.createdAt(),
                event.availableAt()
        );
    }

    private FailedEventView toFailedEventView(ContentOutboxStatusProjectionPort.FailedEventProjection event) {
        return new FailedEventView(
                event.id(),
                event.eventType(),
                event.aggregateType(),
                event.aggregateId(),
                event.attemptCount(),
                event.createdAt(),
                event.lastError()
        );
    }

    private ProcessorSettingsView toProcessorSettingsView() {
        ContentOutboxProcessorProperties.DistributedLockProperties distributedLock = processorProperties.getDistributedLock();
        return new ProcessorSettingsView(
                processorProperties.isEnabled(),
                processorProperties.getBatchSize(),
                processorProperties.getFixedDelayMs(),
                new DistributedLockSettingsView(
                        distributedLock.isEnabled(),
                        distributedLock.getKey(),
                        distributedLock.getWaitTime().toMillis(),
                        distributedLock.getLeaseTime().toMillis(),
                        distributedLock.isFailOpen()
                )
        );
    }

    public record ContentOutboxStatusView(
            Instant generatedAt,
            ProcessorSettingsView processor,
            BacklogView backlog,
            PendingEventView oldestPendingEvent,
            List<FailedEventView> recentFailedEvents
    ) {
    }

    public record ProcessorSettingsView(
            boolean enabled,
            int batchSize,
            long fixedDelayMs,
            DistributedLockSettingsView distributedLock
    ) {
    }

    public record DistributedLockSettingsView(
            boolean enabled,
            String key,
            long waitTimeMs,
            long leaseTimeMs,
            boolean failOpen
    ) {
    }

    public record BacklogView(
            long pending,
            long processing,
            long processed,
            long failed
    ) {
    }

    public record PendingEventView(
            Long id,
            String eventType,
            String aggregateType,
            String aggregateId,
            int attemptCount,
            Instant createdAt,
            Instant availableAt
    ) {
    }

    public record FailedEventView(
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
