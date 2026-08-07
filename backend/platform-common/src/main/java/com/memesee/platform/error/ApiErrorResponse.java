package com.memesee.platform.error;

import java.time.Instant;
import java.util.Map;

public record ApiErrorResponse(
        String code,
        String message,
        String requestId,
        Instant timestamp,
        Map<String, String> details
) {
}
