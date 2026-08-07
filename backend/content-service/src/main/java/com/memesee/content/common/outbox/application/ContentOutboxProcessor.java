package com.memesee.content.common.outbox.application;

import com.memesee.content.common.observability.OutboxMetricsRecorder;
import com.memesee.content.common.outbox.domain.ContentOutboxEvent;
import com.memesee.content.common.outbox.domain.ContentOutboxEventStatus;
import com.memesee.content.common.outbox.infrastructure.ContentOutboxEventRepository;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class ContentOutboxProcessor {

    private static final Logger log = LoggerFactory.getLogger(ContentOutboxProcessor.class);
    private static final String NOTIFICATION_REQUESTED_EVENT_TYPE = "content.notification.requested";
    private static final String NOTIFICATION_CREATED_EVENT_TYPE = "content.notification.created";

    private final ContentOutboxEventRepository contentOutboxEventRepository;
    private final List<ContentOutboxEventHandler> handlers;
    private final OutboxMetricsRecorder outboxMetricsRecorder;

    public ContentOutboxProcessor(
            ContentOutboxEventRepository contentOutboxEventRepository,
            List<ContentOutboxEventHandler> handlers,
            OutboxMetricsRecorder outboxMetricsRecorder
    ) {
        this.contentOutboxEventRepository = contentOutboxEventRepository;
        this.handlers = handlers;
        this.outboxMetricsRecorder = outboxMetricsRecorder;
    }

    public int processPendingBatch(int batchSize) {
        int safeBatchSize = Math.max(1, batchSize);
        int processedCount = 0;
        processedCount += processPendingBatchForEventType(
                NOTIFICATION_REQUESTED_EVENT_TYPE,
                safeBatchSize - processedCount
        );
        processedCount += processPendingBatchForEventType(
                NOTIFICATION_CREATED_EVENT_TYPE,
                safeBatchSize - processedCount
        );
        if (processedCount >= safeBatchSize) {
            return processedCount;
        }
        List<Long> pendingIds = contentOutboxEventRepository
                .findAllByStatusAndAvailableAtLessThanEqualOrderByIdAsc(
                        ContentOutboxEventStatus.PENDING,
                        Instant.now(),
                        PageRequest.of(0, safeBatchSize - processedCount)
                )
                .stream()
                .map(ContentOutboxEvent::getId)
                .toList();
        pendingIds.forEach(this::processEvent);
        return processedCount + pendingIds.size();
    }

    private int processPendingBatchForEventType(String eventType, int batchSize) {
        if (batchSize <= 0) {
            return 0;
        }
        List<Long> pendingIds = contentOutboxEventRepository
                .findAllByStatusAndEventTypeAndAvailableAtLessThanEqualOrderByIdAsc(
                        ContentOutboxEventStatus.PENDING,
                        eventType,
                        Instant.now(),
                        PageRequest.of(0, batchSize)
                )
                .stream()
                .map(ContentOutboxEvent::getId)
                .toList();
        pendingIds.forEach(this::processEvent);
        return pendingIds.size();
    }

    public void processEvent(Long eventId) {
        ContentOutboxEvent event = contentOutboxEventRepository.findById(eventId)
                .orElse(null);
        if (event == null || event.getStatus() != ContentOutboxEventStatus.PENDING) {
            return;
        }

        event.markProcessing();
        try {
            ContentOutboxEventHandler handler = resolveHandler(event.getEventType());
            handler.handle(event.getPayloadJson());
            event.markProcessed();
            outboxMetricsRecorder.processed();
        } catch (RuntimeException error) {
            event.markFailed(error.getMessage());
            outboxMetricsRecorder.failed();
            log.atWarn()
                    .addKeyValue("event", "content_outbox_processing_failed")
                    .addKeyValue("outboxEventId", event.getId())
                    .addKeyValue("eventType", event.getEventType())
                    .addKeyValue("aggregateType", event.getAggregateType())
                    .addKeyValue("aggregateId", event.getAggregateId())
                    .log("content_outbox_processing_failed", error);
        }
        contentOutboxEventRepository.save(event);
        outboxMetricsRecorder.refreshBacklog();
    }

    private ContentOutboxEventHandler resolveHandler(String eventType) {
        return handlers.stream()
                .filter(handler -> handler.supports(eventType))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No outbox handler registered for eventType=" + eventType));
    }
}
