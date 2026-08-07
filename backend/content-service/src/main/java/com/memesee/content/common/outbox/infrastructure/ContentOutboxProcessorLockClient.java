package com.memesee.content.common.outbox.infrastructure;

import java.time.Duration;

interface ContentOutboxProcessorLockClient {

    LockHandle tryLock(String key, Duration waitTime, Duration leaseTime) throws InterruptedException;

    interface LockHandle extends AutoCloseable {

        boolean acquired();

        @Override
        void close();
    }
}
