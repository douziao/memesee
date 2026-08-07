package com.memesee.platform.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class RequestCorrelation {

    public static final String REQUEST_ID_ATTRIBUTE = RequestCorrelation.class.getName() + ".requestId";
    public static final String TRACE_ID_ATTRIBUTE = RequestCorrelation.class.getName() + ".traceId";
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String TRACEPARENT_HEADER = "traceparent";
    public static final String REQUEST_ID_MDC_KEY = "requestId";
    public static final String TRACE_ID_MDC_KEY = "traceId";
    public static final String UNKNOWN_REQUEST_ID = "unknown";
    public static final String HTTP_REQUEST_COMPLETED_EVENT = "http_request_completed";
    public static final String EVENT_FIELD = "event";
    public static final String METHOD_FIELD = "method";
    public static final String PATH_FIELD = "path";
    public static final String STATUS_FIELD = "status";
    public static final String DURATION_MS_FIELD = "durationMs";

    private static final Pattern TRACEPARENT_PATTERN =
            Pattern.compile("^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$");

    private RequestCorrelation() {
    }

    public static String resolveRequestId(String incomingRequestId) {
        if (incomingRequestId == null || incomingRequestId.isBlank()) {
            return UUID.randomUUID().toString();
        }
        return incomingRequestId.trim();
    }

    public static RequestCorrelationContext resolveContext(String incomingRequestId, String incomingTraceparent) {
        String traceparent = resolveTraceparent(incomingTraceparent);
        return new RequestCorrelationContext(
                resolveRequestId(incomingRequestId),
                traceparent,
                resolveTraceId(traceparent)
        );
    }

    public static String resolveRequestId(Object requestAttribute, String requestHeader) {
        if (requestAttribute instanceof String value && !value.isBlank()) {
            return value.trim();
        }
        if (requestHeader == null || requestHeader.isBlank()) {
            return UNKNOWN_REQUEST_ID;
        }
        return requestHeader.trim();
    }

    public static String resolveTraceparent(String traceparentHeader) {
        Matcher matcher = matchTraceparent(traceparentHeader);
        if (matcher == null) {
            return null;
        }
        return traceparentHeader.trim();
    }

    public static String resolveTraceId(String traceparentHeader) {
        Matcher matcher = matchTraceparent(traceparentHeader);
        if (matcher == null) {
            return null;
        }
        return matcher.group(1);
    }

    private static Matcher matchTraceparent(String traceparentHeader) {
        if (traceparentHeader == null || traceparentHeader.isBlank()) {
            return null;
        }
        Matcher matcher = TRACEPARENT_PATTERN.matcher(traceparentHeader.trim());
        if (!matcher.matches()) {
            return null;
        }
        return matcher;
    }

    public static Map<String, Object> httpRequestCompletionFields(
            String method,
            String path,
            int status,
            long durationMs,
            RequestCorrelationContext correlationContext
    ) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put(EVENT_FIELD, HTTP_REQUEST_COMPLETED_EVENT);
        fields.put(METHOD_FIELD, method != null ? method : "UNKNOWN");
        fields.put(PATH_FIELD, path);
        fields.put(STATUS_FIELD, status);
        fields.put(DURATION_MS_FIELD, durationMs);
        fields.put(REQUEST_ID_MDC_KEY, correlationContext.requestId());
        if (correlationContext.traceId() != null) {
            fields.put(TRACE_ID_MDC_KEY, correlationContext.traceId());
        }
        if (correlationContext.traceparent() != null) {
            fields.put(TRACEPARENT_HEADER, correlationContext.traceparent());
        }
        return fields;
    }
}
