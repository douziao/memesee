package com.memesee.content.common.outbox.domain;

public enum ContentOutboxEventStatus {
    PENDING,
    PROCESSING,
    PROCESSED,
    FAILED
}
