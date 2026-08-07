package com.memesee.content.media.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.media.processing.queue")
public class MediaProcessingQueueProperties {

    private String exchange = "memesee.media";
    private String name = "memesee.media.variant-processing";
    private String routingKey = "media.variant.process";
    private String deadLetterExchange = "memesee.media.dlx";
    private String deadLetterName = "memesee.media.variant-processing.dlq";
    private String deadLetterRoutingKey = "media.variant.process.dead";
    private int maxAttempts = 3;
    private long initialIntervalMs = 1000L;
    private double multiplier = 2.0d;
    private long maxIntervalMs = 10000L;

    public String getExchange() {
        return exchange;
    }

    public void setExchange(String exchange) {
        this.exchange = exchange;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRoutingKey() {
        return routingKey;
    }

    public void setRoutingKey(String routingKey) {
        this.routingKey = routingKey;
    }

    public String getDeadLetterExchange() {
        return deadLetterExchange;
    }

    public void setDeadLetterExchange(String deadLetterExchange) {
        this.deadLetterExchange = deadLetterExchange;
    }

    public String getDeadLetterName() {
        return deadLetterName;
    }

    public void setDeadLetterName(String deadLetterName) {
        this.deadLetterName = deadLetterName;
    }

    public String getDeadLetterRoutingKey() {
        return deadLetterRoutingKey;
    }

    public void setDeadLetterRoutingKey(String deadLetterRoutingKey) {
        this.deadLetterRoutingKey = deadLetterRoutingKey;
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public long getInitialIntervalMs() {
        return initialIntervalMs;
    }

    public void setInitialIntervalMs(long initialIntervalMs) {
        this.initialIntervalMs = initialIntervalMs;
    }

    public double getMultiplier() {
        return multiplier;
    }

    public void setMultiplier(double multiplier) {
        this.multiplier = multiplier;
    }

    public long getMaxIntervalMs() {
        return maxIntervalMs;
    }

    public void setMaxIntervalMs(long maxIntervalMs) {
        this.maxIntervalMs = maxIntervalMs;
    }
}
