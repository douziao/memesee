package com.memesee.content.common.outbox.application;

public interface ContentOutboxEventHandler {

    boolean supports(String eventType);

    void handle(String payloadJson);
}
