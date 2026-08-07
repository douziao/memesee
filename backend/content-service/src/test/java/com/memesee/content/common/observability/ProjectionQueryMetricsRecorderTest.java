package com.memesee.content.common.observability;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class ProjectionQueryMetricsRecorderTest {

    @Test
    void recordsProjectionQueryDurationAndSlowSamples() {
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        ProjectionQueryMetricsRecorder recorder = new ProjectionQueryMetricsRecorder(
                meterRegistry,
                Duration.ZERO
        );

        String result = recorder.record(
                "community-catalog",
                "mybatis",
                "community-list",
                () -> "ok"
        );

        assertThat(result).isEqualTo("ok");
        assertThat(meterRegistry.find("memesee.projection.query.duration")
                .tag("projection", "community-catalog")
                .tag("adapter", "mybatis")
                .tag("operation", "community-list")
                .tag("outcome", "success")
                .timer())
                .isNotNull();
        assertThat(meterRegistry.find("memesee.projection.query.slow")
                .tag("projection", "community-catalog")
                .tag("adapter", "mybatis")
                .tag("operation", "community-list")
                .tag("outcome", "success")
                .counter())
                .isNotNull();
    }
}
