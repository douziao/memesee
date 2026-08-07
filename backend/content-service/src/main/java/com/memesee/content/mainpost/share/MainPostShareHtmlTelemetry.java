package com.memesee.content.mainpost.share;

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
public class MainPostShareHtmlTelemetry {

    private static final Logger log = LoggerFactory.getLogger(MainPostShareHtmlTelemetry.class);

    static final String RENDER_TOTAL_METRIC_NAME = "memesee.share.html.render";
    static final String RENDER_DURATION_METRIC_NAME = "memesee.share.html.render.duration";

    private static final MainPostShareHtmlTelemetry NO_OP = new MainPostShareHtmlTelemetry();

    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> counters;
    private final Map<String, Timer> timers;

    private MainPostShareHtmlTelemetry() {
        this.meterRegistry = null;
        this.counters = null;
        this.timers = null;
    }

    public MainPostShareHtmlTelemetry(MeterRegistry meterRegistry) {
        this.meterRegistry = Objects.requireNonNull(meterRegistry, "meterRegistry must not be null");
        this.counters = new ConcurrentHashMap<>();
        this.timers = new ConcurrentHashMap<>();
    }

    public static MainPostShareHtmlTelemetry noop() {
        return NO_OP;
    }

    public void record(RenderObservation observation) {
        if (observation == null) {
            return;
        }
        if (meterRegistry != null) {
            counter(observation).increment();
            timer(observation).record(observation.durationNanos(), TimeUnit.NANOSECONDS);
        }
        log.info(
                "event=\"share_html_render\" mainPostId=\"{}\" requestedSubPostId=\"{}\" resolvedSubPostId=\"{}\" target=\"{}\" outcome=\"{}\" image=\"{}\" durationMs=\"{}\" - share_html_render",
                observation.mainPostId(),
                observation.requestedSubPostId(),
                observation.resolvedSubPostId(),
                observation.target(),
                observation.outcome(),
                observation.image(),
                TimeUnit.NANOSECONDS.toMillis(Math.max(0L, observation.durationNanos()))
        );
    }

    private Counter counter(RenderObservation observation) {
        String key = metricKey(observation);
        return counters.computeIfAbsent(key, ignored -> Counter.builder(RENDER_TOTAL_METRIC_NAME)
                .tag("target", observation.target())
                .tag("outcome", observation.outcome())
                .tag("image", observation.image())
                .register(meterRegistry));
    }

    private Timer timer(RenderObservation observation) {
        String key = metricKey(observation);
        return timers.computeIfAbsent(key, ignored -> Timer.builder(RENDER_DURATION_METRIC_NAME)
                .tag("target", observation.target())
                .tag("outcome", observation.outcome())
                .tag("image", observation.image())
                .register(meterRegistry));
    }

    private String metricKey(RenderObservation observation) {
        return String.join("|", observation.target(), observation.outcome(), observation.image());
    }

    public record RenderObservation(
            Long mainPostId,
            String requestedSubPostId,
            Long resolvedSubPostId,
            String target,
            String outcome,
            String image,
            long durationNanos
    ) {
    }
}
