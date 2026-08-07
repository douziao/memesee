package com.memesee.content.common.observability;

import com.memesee.content.common.outbox.domain.ContentOutboxEventStatus;
import com.memesee.content.common.outbox.infrastructure.ContentOutboxEventRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

@Component
public class OutboxMetricsRecorder {

    private static final String OPERATIONS_METRIC_NAME = "memesee.outbox.operations";
    private static final String BACKLOG_METRIC_NAME = "memesee.outbox.backlog";

    private final MeterRegistry meterRegistry;
    private final ContentOutboxEventRepository contentOutboxEventRepository;
    private final Map<String, Counter> operationCounters = new ConcurrentHashMap<>();
    private final Map<ContentOutboxEventStatus, AtomicLong> backlogGauges = new EnumMap<>(ContentOutboxEventStatus.class);

    public OutboxMetricsRecorder(
            MeterRegistry meterRegistry,
            ContentOutboxEventRepository contentOutboxEventRepository
    ) {
        this.meterRegistry = Objects.requireNonNull(meterRegistry, "meterRegistry must not be null");
        this.contentOutboxEventRepository = Objects.requireNonNull(
                contentOutboxEventRepository,
                "contentOutboxEventRepository must not be null"
        );
        initializeBacklogGauges();
    }

    public void appended() {
        recordOperation("append");
    }

    public void processed() {
        recordOperation("processed");
    }

    public void failed() {
        recordOperation("failed");
    }

    public void requeued() {
        recordOperation("requeue");
    }

    public void lockAcquired() {
        recordOperation("lock-acquired");
    }

    public void lockBusy() {
        recordOperation("lock-busy");
    }

    public void lockError() {
        recordOperation("lock-error");
    }

    public void lockFailOpen() {
        recordOperation("lock-fail-open");
    }

    public void refreshBacklog() {
        backlogGauges.forEach((status, gauge) ->
                gauge.set(contentOutboxEventRepository.countByStatus(status))
        );
    }

    private void recordOperation(String operation) {
        operationCounters.computeIfAbsent(operation, ignored -> Counter.builder(OPERATIONS_METRIC_NAME)
                        .tag("operation", operation)
                        .register(meterRegistry))
                .increment();
    }

    private void initializeBacklogGauges() {
        for (ContentOutboxEventStatus status : ContentOutboxEventStatus.values()) {
            AtomicLong gaugeValue = new AtomicLong(0L);
            backlogGauges.put(status, gaugeValue);
            Gauge.builder(BACKLOG_METRIC_NAME, gaugeValue, AtomicLong::get)
                    .tag("status", status.name())
                    .register(meterRegistry);
        }
        refreshBacklog();
    }
}
