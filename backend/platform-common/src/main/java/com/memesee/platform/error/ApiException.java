package com.memesee.platform.error;

import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final ApiErrorCode code;
    private final Map<String, String> details;

    public ApiException(HttpStatus status, ApiErrorCode code, String message) {
        this(status, code, message, Map.of());
    }

    public ApiException(HttpStatus status, ApiErrorCode code, String message, Throwable cause) {
        this(status, code, message, Map.of(), cause);
    }

    public ApiException(HttpStatus status, ApiErrorCode code, String message, Map<String, String> details) {
        this(status, code, message, details, null);
    }

    public ApiException(
            HttpStatus status,
            ApiErrorCode code,
            String message,
            Map<String, String> details,
            Throwable cause
    ) {
        super(message, cause);
        this.status = Objects.requireNonNull(status, "status must not be null");
        this.code = Objects.requireNonNull(code, "code must not be null");
        this.details = details == null || details.isEmpty() ? Map.of() : Map.copyOf(details);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public ApiErrorCode getCode() {
        return code;
    }

    public Map<String, String> getDetails() {
        return details;
    }
}
