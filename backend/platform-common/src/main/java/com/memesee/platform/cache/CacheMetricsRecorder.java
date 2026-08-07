package com.memesee.platform.cache;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

public class CacheMetricsRecorder {

    private static final String METRIC_NAME = "memesee.cache.operations";

    private final MeterRegistry meterRegistry;
    private final String cacheName;
    private final Map<String, Counter> counters = new ConcurrentHashMap<>();

    public CacheMetricsRecorder(MeterRegistry meterRegistry, String cacheName) {
        this.meterRegistry = Objects.requireNonNull(meterRegistry, "meterRegistry must not be null");
        this.cacheName = Objects.requireNonNull(cacheName, "cacheName must not be null");
    }

    public void hit() {
        record("hit");
    }

    public void l1Hit() {
        record("l1-hit");
    }

    public void l2Hit() {
        record("l2-hit");
    }

    public void loaderHit() {
        record("loader-hit");
    }

    public void requestMerge() {
        record("request-merge");
    }

    public void refresh() {
        record("refresh");
    }

    public void refreshMerge() {
        record("refresh-merge");
    }

    public void miss() {
        record("miss");
    }

    public void write() {
        record("write");
    }

    public void evict() {
        record("evict");
    }

    public void fallback() {
        record("fallback");
    }

    public void error() {
        record("error");
    }

    private void record(String operation) {
        counters.computeIfAbsent(operation, ignored -> Counter.builder(METRIC_NAME)
                        .tag("cache", cacheName)
                        .tag("operation", operation)
                        .register(meterRegistry))
                .increment();
    }
}
