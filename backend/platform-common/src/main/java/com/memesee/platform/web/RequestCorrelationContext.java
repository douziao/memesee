package com.memesee.platform.web;

public record RequestCorrelationContext(
        String requestId,
        String traceparent,
        String traceId
) {
}
