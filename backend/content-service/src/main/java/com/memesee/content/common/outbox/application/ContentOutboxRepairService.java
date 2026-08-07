package com.memesee.content.common.outbox.application;

import com.memesee.content.common.observability.OutboxMetricsRecorder;
import com.memesee.content.common.outbox.domain.ContentOutboxEvent;
import com.memesee.content.common.outbox.domain.ContentOutboxEventStatus;
import com.memesee.content.common.outbox.infrastructure.ContentOutboxEventRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class ContentOutboxRepairService {

    private final ContentOutboxEventRepository contentOutboxEventRepository;
    private final OutboxMetricsRecorder outboxMetricsRecorder;

    public ContentOutboxRepairService(
            ContentOutboxEventRepository contentOutboxEventRepository,
            OutboxMetricsRecorder outboxMetricsRecorder
    ) {
        this.contentOutboxEventRepository = contentOutboxEventRepository;
        this.outboxMetricsRecorder = outboxMetricsRecorder;
    }

    public boolean requeueFailedEvent(Long eventId, Duration delay) {
        ContentOutboxEvent event = contentOutboxEventRepository.findById(eventId)
                .orElse(null);
        if (event == null || event.getStatus() != ContentOutboxEventStatus.FAILED) {
            return false;
        }
        event.markPendingForRetry(nextAvailableAt(delay));
        contentOutboxEventRepository.save(event);
        outboxMetricsRecorder.requeued();
        outboxMetricsRecorder.refreshBacklog();
        return true;
    }

    public int requeueFailedBatch(int batchSize, Duration delay) {
        int safeBatchSize = Math.max(1, batchSize);
        List<ContentOutboxEvent> failedEvents = contentOutboxEventRepository.findAllByStatusOrderByIdAsc(
                ContentOutboxEventStatus.FAILED,
                PageRequest.of(0, safeBatchSize)
        );
        return requeueFailedEvents(failedEvents, delay);
    }

    public int requeueRetryableFailedBatch(int batchSize, Duration delay, int maxAttempts) {
        int safeBatchSize = Math.max(1, batchSize);
        int safeMaxAttempts = Math.max(1, maxAttempts);
        List<ContentOutboxEvent> failedEvents =
                contentOutboxEventRepository.findAllByStatusAndAttemptCountLessThanOrderByIdAsc(
                        ContentOutboxEventStatus.FAILED,
                        safeMaxAttempts,
                        PageRequest.of(0, safeBatchSize)
                );
        return requeueFailedEvents(failedEvents, delay);
    }

    private int requeueFailedEvents(List<ContentOutboxEvent> failedEvents, Duration delay) {
        Instant nextAvailableAt = nextAvailableAt(delay);
        failedEvents.forEach(event -> event.markPendingForRetry(nextAvailableAt));
        if (!failedEvents.isEmpty()) {
            contentOutboxEventRepository.saveAll(failedEvents);
            for (int index = 0; index < failedEvents.size(); index++) {
                outboxMetricsRecorder.requeued();
            }
            outboxMetricsRecorder.refreshBacklog();
        }
        return failedEvents.size();
    }

    private Instant nextAvailableAt(Duration delay) {
        Duration safeDelay = delay == null || delay.isNegative() ? Duration.ZERO : delay;
        return Instant.now().plus(safeDelay);
    }
}
