package com.memesee.content.common.outbox.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.outbox.processor")
public class ContentOutboxProcessorProperties {

    private boolean enabled;
    private int batchSize = 20;
    private long fixedDelayMs = 5000L;
    private FailedRetryProperties failedRetry = new FailedRetryProperties();
    private DistributedLockProperties distributedLock = new DistributedLockProperties();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getBatchSize() {
        return batchSize;
    }

    public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
    }

    public long getFixedDelayMs() {
        return fixedDelayMs;
    }

    public void setFixedDelayMs(long fixedDelayMs) {
        this.fixedDelayMs = fixedDelayMs;
    }

    public FailedRetryProperties getFailedRetry() {
        return failedRetry;
    }

    public void setFailedRetry(FailedRetryProperties failedRetry) {
        this.failedRetry = failedRetry == null ? new FailedRetryProperties() : failedRetry;
    }

    public DistributedLockProperties getDistributedLock() {
        return distributedLock;
    }

    public void setDistributedLock(DistributedLockProperties distributedLock) {
        this.distributedLock = distributedLock == null ? new DistributedLockProperties() : distributedLock;
    }

    public static class FailedRetryProperties {

        private boolean enabled = true;
        private int batchSize = 20;
        private int maxAttempts = 5;
        private Duration delay = Duration.ofSeconds(10);

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public int getBatchSize() {
            return batchSize;
        }

        public void setBatchSize(int batchSize) {
            this.batchSize = batchSize;
        }

        public int getMaxAttempts() {
            return maxAttempts;
        }

        public void setMaxAttempts(int maxAttempts) {
            this.maxAttempts = maxAttempts;
        }

        public Duration getDelay() {
            return delay;
        }

        public void setDelay(Duration delay) {
            this.delay = delay == null ? Duration.ZERO : delay;
        }
    }

    public static class DistributedLockProperties {

        private boolean enabled;
        private String key = "memesee:lock:content:outbox:processor";
        private Duration waitTime = Duration.ZERO;
        private Duration leaseTime = Duration.ofSeconds(30);
        private boolean failOpen;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getKey() {
            return key;
        }

        public void setKey(String key) {
            this.key = key;
        }

        public Duration getWaitTime() {
            return waitTime;
        }

        public void setWaitTime(Duration waitTime) {
            this.waitTime = waitTime == null ? Duration.ZERO : waitTime;
        }

        public Duration getLeaseTime() {
            return leaseTime;
        }

        public void setLeaseTime(Duration leaseTime) {
            this.leaseTime = leaseTime == null ? Duration.ofSeconds(30) : leaseTime;
        }

        public boolean isFailOpen() {
            return failOpen;
        }

        public void setFailOpen(boolean failOpen) {
            this.failOpen = failOpen;
        }
    }
}
