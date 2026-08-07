package com.memesee.content.common.outbox.infrastructure;

import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;

class RedissonContentOutboxProcessorLockClient implements ContentOutboxProcessorLockClient {

    private final RedissonClient redissonClient;

    RedissonContentOutboxProcessorLockClient(RedissonClient redissonClient) {
        this.redissonClient = Objects.requireNonNull(redissonClient, "redissonClient must not be null");
    }

    @Override
    public LockHandle tryLock(String key, Duration waitTime, Duration leaseTime) throws InterruptedException {
        RLock lock = redissonClient.getLock(key);
        boolean acquired = lock.tryLock(waitTime.toMillis(), leaseTime.toMillis(), TimeUnit.MILLISECONDS);
        if (!acquired) {
            return new BusyLockHandle();
        }
        return new RedissonLockHandle(lock);
    }

    private static final class BusyLockHandle implements LockHandle {

        @Override
        public boolean acquired() {
            return false;
        }

        @Override
        public void close() {
        }
    }

    private static final class RedissonLockHandle implements LockHandle {

        private final RLock lock;

        private RedissonLockHandle(RLock lock) {
            this.lock = lock;
        }

        @Override
        public boolean acquired() {
            return true;
        }

        @Override
        public void close() {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }
}
