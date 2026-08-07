package com.memesee.content.common.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ProjectionQueryMetricsRecorder {

    private static final Logger log = LoggerFactory.getLogger(ProjectionQueryMetricsRecorder.class);

    private static final String DURATION_METRIC_NAME = "memesee.projection.query.duration";
    private static final String SLOW_METRIC_NAME = "memesee.projection.query.slow";

    private static final ProjectionQueryMetricsRecorder NO_OP = new ProjectionQueryMetricsRecorder();

    private final MeterRegistry meterRegistry;
    private final long slowQueryThresholdNanos;
    private final long slowQueryThresholdMillis;
    private final Map<String, Timer> timers;
    private final Map<String, Counter> slowCounters;

    private ProjectionQueryMetricsRecorder() {
        this.meterRegistry = null;
        this.slowQueryThresholdNanos = Long.MAX_VALUE;
        this.slowQueryThresholdMillis = Long.MAX_VALUE;
        this.timers = null;
        this.slowCounters = null;
    }

    public ProjectionQueryMetricsRecorder(
            MeterRegistry meterRegistry,
            Duration slowQueryThreshold
    ) {
        this.meterRegistry = Objects.requireNonNull(meterRegistry, "meterRegistry must not be null");
        Duration safeSlowQueryThreshold =
                Objects.requireNonNull(slowQueryThreshold, "slowQueryThreshold must not be null");
        this.slowQueryThresholdNanos = safeSlowQueryThreshold.toNanos();
        this.slowQueryThresholdMillis = safeSlowQueryThreshold.toMillis();
        this.timers = new ConcurrentHashMap<>();
        this.slowCounters = new ConcurrentHashMap<>();
    }

    public static ProjectionQueryMetricsRecorder noop() {
        return NO_OP;
    }

    public <T> T record(String projection, String adapter, String operation, Supplier<T> supplier) {
        if (meterRegistry == null) {
            return supplier.get();
        }
        String normalizedProjection = normalizeTagValue(projection, "unknown");
        String normalizedAdapter = normalizeTagValue(adapter, "unknown");
        String normalizedOperation = normalizeTagValue(operation, "unknown");
        long start = System.nanoTime();
        String outcome = "success";
        try {
            return supplier.get();
        } catch (RuntimeException ex) {
            outcome = "error";
            throw ex;
        } finally {
            long durationNanos = System.nanoTime() - start;
            timer(normalizedProjection, normalizedAdapter, normalizedOperation, outcome)
                    .record(durationNanos, TimeUnit.NANOSECONDS);
            if (durationNanos >= slowQueryThresholdNanos) {
                slowCounter(normalizedProjection, normalizedAdapter, normalizedOperation, outcome).increment();
                log.warn(
                        "event=\"projection_query_slow\" projection=\"{}\" adapter=\"{}\" operation=\"{}\" outcome=\"{}\" durationMs=\"{}\" thresholdMs=\"{}\"- projection_query_slow",
                        normalizedProjection,
                        normalizedAdapter,
                        normalizedOperation,
                        outcome,
                        TimeUnit.NANOSECONDS.toMillis(durationNanos),
                        slowQueryThresholdMillis
                );
            }
        }
    }

    private Timer timer(String projection, String adapter, String operation, String outcome) {
        String timerKey = String.join("|", projection, adapter, operation, outcome);
        return timers.computeIfAbsent(timerKey, ignored -> Timer.builder(DURATION_METRIC_NAME)
                .tag("projection", projection)
                .tag("adapter", adapter)
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry));
    }

    private Counter slowCounter(String projection, String adapter, String operation, String outcome) {
        String counterKey = String.join("|", projection, adapter, operation, outcome);
        return slowCounters.computeIfAbsent(counterKey, ignored -> Counter.builder(SLOW_METRIC_NAME)
                .tag("projection", projection)
                .tag("adapter", adapter)
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry));
    }

    private String normalizeTagValue(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }
}
