package com.memesee.content.common.outbox.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.common.observability.OutboxMetricsRecorder;
import com.memesee.content.common.outbox.domain.ContentOutboxEvent;
import com.memesee.content.common.outbox.infrastructure.ContentOutboxEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContentOutboxService {

    private final ContentOutboxEventRepository contentOutboxEventRepository;
    private final ObjectMapper objectMapper;
    private final OutboxMetricsRecorder outboxMetricsRecorder;

    public ContentOutboxService(
            ContentOutboxEventRepository contentOutboxEventRepository,
            ObjectMapper objectMapper,
            OutboxMetricsRecorder outboxMetricsRecorder
    ) {
        this.contentOutboxEventRepository = contentOutboxEventRepository;
        this.objectMapper = objectMapper;
        this.outboxMetricsRecorder = outboxMetricsRecorder;
    }

    @Transactional
    public void append(String aggregateType, String aggregateId, String eventType, Object payload) {
        ContentOutboxEvent outboxEvent = ContentOutboxEvent.pending(
                requireText(aggregateType, "aggregateType"),
                requireText(aggregateId, "aggregateId"),
                requireText(eventType, "eventType"),
                serializePayload(payload)
        );
        contentOutboxEventRepository.save(outboxEvent);
        outboxMetricsRecorder.appended();
        outboxMetricsRecorder.refreshBacklog();
    }

    private String serializePayload(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("Failed to serialize outbox payload.", error);
        }
    }

    private String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " must not be blank.");
        }
        return value.trim();
    }
}
