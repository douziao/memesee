package com.memesee.content.common.outbox.infrastructure;

import com.memesee.content.common.outbox.application.ContentOutboxProcessorExecutionGuard;

class NoOpContentOutboxProcessorExecutionGuard implements ContentOutboxProcessorExecutionGuard {

    @Override
    public ExecutionOutcome execute(Runnable task) {
        task.run();
        return ExecutionOutcome.EXECUTED;
    }
}
