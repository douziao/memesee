package com.memesee.content.common.admin;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class InternalAdminAuditRecorder {

    public static final String INTERNAL_OPERATOR_HEADER = "X-Internal-Operator";
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String USER_AGENT_HEADER = "User-Agent";

    static final String ADMIN_OPERATION_TOTAL_METRIC_NAME = "memesee.internal.admin.operation";
    static final String ADMIN_OPERATION_DURATION_METRIC_NAME = "memesee.internal.admin.operation.duration";

    private static final Logger log = LoggerFactory.getLogger(InternalAdminAuditRecorder.class);
    private static final InternalAdminAuditRecorder NO_OP = new InternalAdminAuditRecorder();
    private static final InternalAdminAuditEvent STARTUP_EVENT = new InternalAdminAuditEvent(
            "startup",
            "ready",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            0L
    );

    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> counters;
    private final Map<String, Timer> timers;

    private InternalAdminAuditRecorder() {
        this.meterRegistry = null;
        this.counters = null;
        this.timers = null;
    }

    public InternalAdminAuditRecorder(MeterRegistry meterRegistry) {
        this.meterRegistry = Objects.requireNonNull(meterRegistry, "meterRegistry must not be null");
        this.counters = new ConcurrentHashMap<>();
        this.timers = new ConcurrentHashMap<>();
        registerStartupMeters();
    }

    public static InternalAdminAuditRecorder noop() {
        return NO_OP;
    }

    public void record(InternalAdminAuditEvent event) {
        if (event == null) {
            return;
        }
        if (meterRegistry == null) {
            return;
        }
        counter(event).increment();
        timer(event).record(Math.max(0L, event.durationNanos()), TimeUnit.NANOSECONDS);
        log.info(
                "event=\"internal_admin_operation\" operation=\"{}\" outcome=\"{}\" operator=\"{}\" requestId=\"{}\" userAgent=\"{}\" batchSize=\"{}\" limit=\"{}\" targetId=\"{}\" resultCount=\"{}\" durationMs=\"{}\" - internal_admin_operation",
                normalizeLogValue(event.operation()),
                normalizeLogValue(event.outcome()),
                normalizeLogValue(event.operator()),
                normalizeLogValue(event.requestId()),
                normalizeLogValue(event.userAgent()),
                event.batchSize(),
                event.limit(),
                event.targetId(),
                event.resultCount(),
                TimeUnit.NANOSECONDS.toMillis(Math.max(0L, event.durationNanos()))
        );
    }

    private Counter counter(InternalAdminAuditEvent event) {
        String key = metricKey(event);
        return counters.computeIfAbsent(key, ignored -> Counter.builder(ADMIN_OPERATION_TOTAL_METRIC_NAME)
                .tag("operation", normalizeTagValue(event.operation()))
                .tag("outcome", normalizeTagValue(event.outcome()))
                .register(meterRegistry));
    }

    private void registerStartupMeters() {
        counter(STARTUP_EVENT);
        timer(STARTUP_EVENT);
    }

    private Timer timer(InternalAdminAuditEvent event) {
        String key = metricKey(event);
        return timers.computeIfAbsent(key, ignored -> Timer.builder(ADMIN_OPERATION_DURATION_METRIC_NAME)
                .tag("operation", normalizeTagValue(event.operation()))
                .tag("outcome", normalizeTagValue(event.outcome()))
                .register(meterRegistry));
    }

    private String metricKey(InternalAdminAuditEvent event) {
        return normalizeTagValue(event.operation()) + "|" + normalizeTagValue(event.outcome());
    }

    private String normalizeTagValue(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.trim();
    }

    private String normalizeLogValue(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 120) {
            return trimmed;
        }
        return trimmed.substring(0, 120);
    }

    public record InternalAdminAuditEvent(
            String operation,
            String outcome,
            String operator,
            String requestId,
            String userAgent,
            Integer batchSize,
            Integer limit,
            Long targetId,
            Integer resultCount,
            long durationNanos
    ) {
    }
}
