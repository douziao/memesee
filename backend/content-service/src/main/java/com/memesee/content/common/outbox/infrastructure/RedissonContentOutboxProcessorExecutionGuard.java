package com.memesee.content.common.outbox.infrastructure;

import com.memesee.content.common.observability.OutboxMetricsRecorder;
import com.memesee.content.common.outbox.application.ContentOutboxProcessorExecutionGuard;
import com.memesee.content.common.outbox.application.ContentOutboxProcessorProperties;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class RedissonContentOutboxProcessorExecutionGuard implements ContentOutboxProcessorExecutionGuard {

    private static final Logger log = LoggerFactory.getLogger(RedissonContentOutboxProcessorExecutionGuard.class);

    private final ContentOutboxProcessorLockClient lockClient;
    private final ContentOutboxProcessorProperties.DistributedLockProperties properties;
    private final OutboxMetricsRecorder outboxMetricsRecorder;

    RedissonContentOutboxProcessorExecutionGuard(
            ContentOutboxProcessorLockClient lockClient,
            ContentOutboxProcessorProperties processorProperties,
            OutboxMetricsRecorder outboxMetricsRecorder
    ) {
        this.lockClient = Objects.requireNonNull(lockClient, "lockClient must not be null");
        this.properties = Objects.requireNonNull(processorProperties, "processorProperties must not be null")
                .getDistributedLock();
        this.outboxMetricsRecorder = Objects.requireNonNull(
                outboxMetricsRecorder,
                "outboxMetricsRecorder must not be null"
        );
    }

    @Override
    public ExecutionOutcome execute(Runnable task) {
        Objects.requireNonNull(task, "task must not be null");
        ContentOutboxProcessorLockClient.LockHandle lockHandle = null;
        try {
            lockHandle = lockClient.tryLock(
                    properties.getKey(),
                    properties.getWaitTime(),
                    properties.getLeaseTime()
            );
            if (!lockHandle.acquired()) {
                outboxMetricsRecorder.lockBusy();
                return ExecutionOutcome.SKIPPED_LOCK_BUSY;
            }

            outboxMetricsRecorder.lockAcquired();
            task.run();
            return ExecutionOutcome.EXECUTED;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            outboxMetricsRecorder.lockError();
            return ExecutionOutcome.SKIPPED_LOCK_ERROR;
        } catch (RuntimeException error) {
            outboxMetricsRecorder.lockError();
            if (!properties.isFailOpen()) {
                log.atWarn()
                        .addKeyValue("event", "content_outbox_lock_acquire_failed")
                        .addKeyValue("lockKey", properties.getKey())
                        .log("content_outbox_lock_acquire_failed", error);
                return ExecutionOutcome.SKIPPED_LOCK_ERROR;
            }

            outboxMetricsRecorder.lockFailOpen();
            log.atWarn()
                    .addKeyValue("event", "content_outbox_lock_fail_open")
                    .addKeyValue("lockKey", properties.getKey())
                    .log("content_outbox_lock_fail_open", error);
            task.run();
            return ExecutionOutcome.EXECUTED_FAIL_OPEN;
        } finally {
            if (lockHandle != null && lockHandle.acquired()) {
                releaseLockQuietly(lockHandle);
            }
        }
    }

    private void releaseLockQuietly(ContentOutboxProcessorLockClient.LockHandle lockHandle) {
        try {
            lockHandle.close();
        } catch (RuntimeException error) {
            outboxMetricsRecorder.lockError();
            log.atWarn()
                    .addKeyValue("event", "content_outbox_lock_release_failed")
                    .addKeyValue("lockKey", properties.getKey())
                    .log("content_outbox_lock_release_failed", error);
        }
    }
}
