package com.memesee.content.common.observability;

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
public class ContentCommandTelemetry {

    private static final Logger log = LoggerFactory.getLogger(ContentCommandTelemetry.class);

    static final String COMMAND_TOTAL_METRIC_NAME = "memesee.content.command";
    static final String COMMAND_DURATION_METRIC_NAME = "memesee.content.command.duration";

    private static final ContentCommandTelemetry NO_OP = new ContentCommandTelemetry();
    private static final CommandObservation STARTUP_OBSERVATION = new CommandObservation(
            "content-command",
            "startup",
            "ready",
            null,
            null,
            null,
            null,
            "",
            "unknown",
            0,
            0,
            0L
    );

    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> counters;
    private final Map<String, Timer> timers;

    private ContentCommandTelemetry() {
        this.meterRegistry = null;
        this.counters = null;
        this.timers = null;
    }

    public ContentCommandTelemetry(MeterRegistry meterRegistry) {
        this.meterRegistry = Objects.requireNonNull(meterRegistry, "meterRegistry must not be null");
        this.counters = new ConcurrentHashMap<>();
        this.timers = new ConcurrentHashMap<>();
        registerStartupMeters();
    }

    public static ContentCommandTelemetry noop() {
        return NO_OP;
    }

    public void record(CommandObservation observation) {
        if (observation == null) {
            return;
        }
        if (meterRegistry != null) {
            counter(observation).increment();
            timer(observation).record(observation.durationNanos(), TimeUnit.NANOSECONDS);
        }
        log.info(
                "event=\"content_command\" aggregate=\"{}\" operation=\"{}\" outcome=\"{}\" mainPostId=\"{}\" subPostId=\"{}\" parentSubPostId=\"{}\" communityId=\"{}\" communitySlug=\"{}\" postMode=\"{}\" mediaAssetCount=\"{}\" tagCount=\"{}\" durationMs=\"{}\" - content_command",
                observation.aggregate(),
                observation.operation(),
                observation.outcome(),
                observation.mainPostId(),
                observation.subPostId(),
                observation.parentSubPostId(),
                observation.communityId(),
                observation.communitySlug(),
                observation.postMode(),
                observation.mediaAssetCount(),
                observation.tagCount(),
                TimeUnit.NANOSECONDS.toMillis(Math.max(0L, observation.durationNanos()))
        );
    }

    private Counter counter(CommandObservation observation) {
        String key = metricKey(observation);
        return counters.computeIfAbsent(key, ignored -> Counter.builder(COMMAND_TOTAL_METRIC_NAME)
                .tag("aggregate", normalizeTagValue(observation.aggregate(), "unknown"))
                .tag("operation", normalizeTagValue(observation.operation(), "unknown"))
                .tag("outcome", normalizeTagValue(observation.outcome(), "unknown"))
                .tag("postMode", normalizeTagValue(observation.postMode(), "unknown"))
                .register(meterRegistry));
    }

    private void registerStartupMeters() {
        counter(STARTUP_OBSERVATION);
        timer(STARTUP_OBSERVATION);
    }

    private Timer timer(CommandObservation observation) {
        String key = metricKey(observation);
        return timers.computeIfAbsent(key, ignored -> Timer.builder(COMMAND_DURATION_METRIC_NAME)
                .tag("aggregate", normalizeTagValue(observation.aggregate(), "unknown"))
                .tag("operation", normalizeTagValue(observation.operation(), "unknown"))
                .tag("outcome", normalizeTagValue(observation.outcome(), "unknown"))
                .tag("postMode", normalizeTagValue(observation.postMode(), "unknown"))
                .register(meterRegistry));
    }

    private String metricKey(CommandObservation observation) {
        return String.join(
                "|",
                normalizeTagValue(observation.aggregate(), "unknown"),
                normalizeTagValue(observation.operation(), "unknown"),
                normalizeTagValue(observation.outcome(), "unknown"),
                normalizeTagValue(observation.postMode(), "unknown")
        );
    }

    private String normalizeTagValue(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    public record CommandObservation(
            String aggregate,
            String operation,
            String outcome,
            Long mainPostId,
            Long subPostId,
            Long parentSubPostId,
            Long communityId,
            String communitySlug,
            String postMode,
            int mediaAssetCount,
            int tagCount,
            long durationNanos
    ) {
    }
}
