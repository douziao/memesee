package com.memesee.content.common.outbox.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.outbox.processor", name = "enabled", havingValue = "true")
public class ContentOutboxProcessorScheduler {

    private static final Logger log = LoggerFactory.getLogger(ContentOutboxProcessorScheduler.class);

    private final ContentOutboxProcessor contentOutboxProcessor;
    private final ContentOutboxRepairService contentOutboxRepairService;
    private final ContentOutboxProcessorExecutionGuard executionGuard;
    private final ContentOutboxProcessorProperties properties;

    public ContentOutboxProcessorScheduler(
            ContentOutboxProcessor contentOutboxProcessor,
            ContentOutboxRepairService contentOutboxRepairService,
            ContentOutboxProcessorExecutionGuard executionGuard,
            ContentOutboxProcessorProperties properties
    ) {
        this.contentOutboxProcessor = contentOutboxProcessor;
        this.contentOutboxRepairService = contentOutboxRepairService;
        this.executionGuard = executionGuard;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${app.outbox.processor.fixed-delay-ms:5000}")
    public void processPendingEvents() {
        ContentOutboxProcessorExecutionGuard.ExecutionOutcome outcome = executionGuard.execute(() -> {
            requeueRetryableFailedEvents();
            int processedCount = contentOutboxProcessor.processPendingBatch(properties.getBatchSize());
            if (processedCount > 0) {
                log.atInfo()
                        .addKeyValue("event", "content_outbox_batch_processed")
                        .addKeyValue("processedCount", processedCount)
                        .log("content_outbox_batch_processed");
            }
        });
        if (outcome == ContentOutboxProcessorExecutionGuard.ExecutionOutcome.SKIPPED_LOCK_BUSY) {
            log.atDebug()
                    .addKeyValue("event", "content_outbox_lock_busy")
                    .log("content_outbox_lock_busy");
        } else if (outcome == ContentOutboxProcessorExecutionGuard.ExecutionOutcome.SKIPPED_LOCK_ERROR) {
            log.atWarn()
                    .addKeyValue("event", "content_outbox_lock_error")
                    .log("content_outbox_lock_error");
        } else if (outcome == ContentOutboxProcessorExecutionGuard.ExecutionOutcome.EXECUTED_FAIL_OPEN) {
            log.atWarn()
                    .addKeyValue("event", "content_outbox_lock_fail_open")
                    .log("content_outbox_lock_fail_open");
        }
    }

    private void requeueRetryableFailedEvents() {
        ContentOutboxProcessorProperties.FailedRetryProperties retry = properties.getFailedRetry();
        if (retry == null || !retry.isEnabled()) {
            return;
        }
        int requeuedCount = contentOutboxRepairService.requeueRetryableFailedBatch(
                retry.getBatchSize(),
                retry.getDelay(),
                retry.getMaxAttempts()
        );
        if (requeuedCount > 0) {
            log.atInfo()
                    .addKeyValue("event", "content_outbox_failed_events_requeued")
                    .addKeyValue("requeuedCount", requeuedCount)
                    .log("content_outbox_failed_events_requeued");
        }
    }
}
