package com.memesee.content.common.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.memesee.content.common.admin.InternalAdminAuditRecorder.InternalAdminAuditEvent;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class InternalAdminAuditRecorderTest {

    @Test
    void registersStartupMetersForRuntimeMetricDefinitionChecks() {
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();

        new InternalAdminAuditRecorder(meterRegistry);

        assertThat(meterRegistry.find("memesee.internal.admin.operation")
                .tag("operation", "startup")
                .tag("outcome", "ready")
                .counter())
                .isNotNull();
        assertThat(meterRegistry.find("memesee.internal.admin.operation.duration")
                .tag("operation", "startup")
                .tag("outcome", "ready")
                .timer())
                .isNotNull();
    }

    @Test
    void recordsInternalAdminOperationCounterAndDurationWithLowCardinalityTags() {
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        InternalAdminAuditRecorder recorder = new InternalAdminAuditRecorder(meterRegistry);

        recorder.record(new InternalAdminAuditEvent(
                "feed.main-posts.rebuild",
                "success",
                "release-bot",
                "request-1",
                "curl/8",
                200,
                null,
                null,
                12,
                1_000_000L
        ));

        assertThat(meterRegistry.find("memesee.internal.admin.operation")
                .tag("operation", "feed.main-posts.rebuild")
                .tag("outcome", "success")
                .counter())
                .isNotNull();
        assertThat(meterRegistry.find("memesee.internal.admin.operation.duration")
                .tag("operation", "feed.main-posts.rebuild")
                .tag("outcome", "success")
                .timer())
                .isNotNull();
        assertThat(meterRegistry.find("memesee.internal.admin.operation")
                .tag("operator", "release-bot")
                .counter())
                .isNull();
    }
}
