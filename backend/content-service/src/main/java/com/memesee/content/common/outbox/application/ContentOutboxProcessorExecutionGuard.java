package com.memesee.content.common.outbox.application;

public interface ContentOutboxProcessorExecutionGuard {

    ExecutionOutcome execute(Runnable task);

    enum ExecutionOutcome {
        EXECUTED,
        EXECUTED_FAIL_OPEN,
        SKIPPED_LOCK_BUSY,
        SKIPPED_LOCK_ERROR
    }
}
