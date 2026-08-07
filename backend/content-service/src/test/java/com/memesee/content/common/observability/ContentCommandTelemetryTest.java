package com.memesee.content.common.observability;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import org.junit.jupiter.api.Test;

class ContentCommandTelemetryTest {

    @Test
    void recordsContentCommandCounterAndDuration() {
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        ContentCommandTelemetry telemetry = new ContentCommandTelemetry(meterRegistry);

        assertThat(meterRegistry.find("memesee.content.command")
                .tag("aggregate", "content-command")
                .tag("operation", "startup")
                .tag("outcome", "ready")
                .tag("postMode", "unknown")
                .counter())
                .isNotNull();
        assertThat(meterRegistry.find("memesee.content.command.duration")
                .tag("aggregate", "content-command")
                .tag("operation", "startup")
                .tag("outcome", "ready")
                .tag("postMode", "unknown")
                .timer())
                .isNotNull();

        telemetry.record(new ContentCommandTelemetry.CommandObservation(
                "main-post",
                "create",
                "success",
                42L,
                null,
                null,
                10L,
                "memes",
                "rich",
                2,
                3,
                1_000_000L
        ));

        assertThat(meterRegistry.find("memesee.content.command")
                .tag("aggregate", "main-post")
                .tag("operation", "create")
                .tag("outcome", "success")
                .tag("postMode", "rich")
                .counter())
                .isNotNull();
        assertThat(meterRegistry.find("memesee.content.command.duration")
                .tag("aggregate", "main-post")
                .tag("operation", "create")
                .tag("outcome", "success")
                .tag("postMode", "rich")
                .timer())
                .isNotNull();
    }

    @Test
    void exposesStartupMetersInPrometheusScrape() {
        PrometheusMeterRegistry meterRegistry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);

        new ContentCommandTelemetry(meterRegistry);

        String scrape = meterRegistry.scrape();
        assertThat(scrape).contains("memesee_content_command_total");
        assertThat(scrape).contains("memesee_content_command_duration_seconds_count");
        assertThat(scrape).contains("aggregate=\"content-command\"");
        assertThat(scrape).contains("operation=\"startup\"");
        assertThat(scrape).contains("outcome=\"ready\"");
        assertThat(scrape).contains("postMode=\"unknown\"");
    }
}
