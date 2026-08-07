package com.memesee.content.common.outbox.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import org.springframework.util.StringUtils;

@Entity
@Table(name = "content_outbox_events")
public class ContentOutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String aggregateType;

    @Column(nullable = false, length = 120)
    private String aggregateId;

    @Column(nullable = false, length = 120)
    private String eventType;

    @Column(nullable = false, columnDefinition = "longtext")
    private String payloadJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContentOutboxEventStatus status;

    @Column(nullable = false)
    private int attemptCount;

    @Column(nullable = false)
    private Instant availableAt;

    @Column
    private Instant processedAt;

    @Column(length = 1000)
    private String lastError;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected ContentOutboxEvent() {
    }

    private ContentOutboxEvent(
            String aggregateType,
            String aggregateId,
            String eventType,
            String payloadJson
    ) {
        this.aggregateType = aggregateType;
        this.aggregateId = aggregateId;
        this.eventType = eventType;
        this.payloadJson = payloadJson;
        this.status = ContentOutboxEventStatus.PENDING;
        this.attemptCount = 0;
    }

    public static ContentOutboxEvent pending(
            String aggregateType,
            String aggregateId,
            String eventType,
            String payloadJson
    ) {
        return new ContentOutboxEvent(aggregateType, aggregateId, eventType, payloadJson);
    }

    public void markProcessing() {
        status = ContentOutboxEventStatus.PROCESSING;
        attemptCount++;
        lastError = null;
        processedAt = null;
    }

    public void markProcessed() {
        status = ContentOutboxEventStatus.PROCESSED;
        processedAt = Instant.now();
        lastError = null;
    }

    public void markFailed(String errorMessage) {
        status = ContentOutboxEventStatus.FAILED;
        processedAt = null;
        lastError = truncate(errorMessage, 1000);
    }

    public void markPendingForRetry(Instant nextAvailableAt) {
        status = ContentOutboxEventStatus.PENDING;
        availableAt = nextAvailableAt == null ? Instant.now() : nextAvailableAt;
        processedAt = null;
        lastError = null;
    }

    @PrePersist
    void onCreate() {
        if (availableAt == null) {
            availableAt = Instant.now();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getAggregateType() {
        return aggregateType;
    }

    public String getAggregateId() {
        return aggregateId;
    }

    public String getEventType() {
        return eventType;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public ContentOutboxEventStatus getStatus() {
        return status;
    }

    public int getAttemptCount() {
        return attemptCount;
    }

    public Instant getAvailableAt() {
        return availableAt;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public String getLastError() {
        return lastError;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    private String truncate(String value, int maxLength) {
        if (!StringUtils.hasText(value)) {
            return "Unknown outbox processing error.";
        }
        String normalizedValue = value.trim();
        if (normalizedValue.length() <= maxLength) {
            return normalizedValue;
        }
        return normalizedValue.substring(0, maxLength - 3) + "...";
    }
}
