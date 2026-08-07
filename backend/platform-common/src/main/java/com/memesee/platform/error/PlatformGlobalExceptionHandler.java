package com.memesee.platform.error;

import com.memesee.platform.logging.PlatformLogging;
import com.memesee.platform.web.RequestCorrelation;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;

public abstract class PlatformGlobalExceptionHandler {

    private final Logger log = LoggerFactory.getLogger(getClass());

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        logFailure(ex.getStatus(), ex.getCode(), request, ex.getStatus().is5xxServerError() ? ex : null);
        return buildResponse(ex.getStatus(), ex.getCode(), ex.getMessage(), request, ex.getDetails());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex,
            HttpServletRequest request
    ) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> fieldErrors.put(error.getField(), error.getDefaultMessage()));
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                ApiErrorCode.VALIDATION_FAILED,
                validationFailedMessage(),
                request,
                fieldErrors
        );
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex,
            HttpServletRequest request
    ) {
        logFailure(HttpStatus.METHOD_NOT_ALLOWED, ApiErrorCode.METHOD_NOT_ALLOWED, request, null);
        return buildResponse(
                HttpStatus.METHOD_NOT_ALLOWED,
                ApiErrorCode.METHOD_NOT_ALLOWED,
                methodNotSupportedMessage(),
                request,
                Map.of()
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpectedException(Exception ex, HttpServletRequest request) {
        logFailure(HttpStatus.INTERNAL_SERVER_ERROR, ApiErrorCode.INTERNAL_ERROR, request, ex);
        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                ApiErrorCode.INTERNAL_ERROR,
                internalErrorMessage(),
                request,
                Map.of()
        );
    }

    protected String validationFailedMessage() {
        return "请求参数校验失败。";
    }

    protected String methodNotSupportedMessage() {
        return "请求方法不被支持。";
    }

    protected String internalErrorMessage() {
        return "服务器内部错误。";
    }

    protected String unexpectedExceptionLogMessage() {
        return "Unhandled " + serviceName() + " exception";
    }

    protected abstract String serviceName();

    private void logFailure(
            HttpStatus status,
            ApiErrorCode code,
            HttpServletRequest request,
            Exception ex
    ) {
        String requestId = resolveRequestId(request);
        String traceId = resolveTraceId(request);
        MDC.put(PlatformLogging.ERROR_CODE_MDC_KEY, code.name());
        try {
            var builder = status.is5xxServerError()
                    ? log.atError().setCause(ex)
                    : log.atWarn();
            builder = builder
                    .addKeyValue(RequestCorrelation.EVENT_FIELD, PlatformLogging.HTTP_REQUEST_FAILED_EVENT)
                    .addKeyValue(RequestCorrelation.METHOD_FIELD, request.getMethod())
                    .addKeyValue(RequestCorrelation.PATH_FIELD, request.getRequestURI())
                    .addKeyValue(RequestCorrelation.STATUS_FIELD, status.value())
                    .addKeyValue(PlatformLogging.ERROR_CODE_MDC_KEY, code.name())
                    .addKeyValue(RequestCorrelation.REQUEST_ID_MDC_KEY, requestId);
            if (traceId != null) {
                builder = builder.addKeyValue(RequestCorrelation.TRACE_ID_MDC_KEY, traceId);
            }
            builder.log(status.is5xxServerError() ? unexpectedExceptionLogMessage() : PlatformLogging.HTTP_REQUEST_FAILED_EVENT);
        } finally {
            MDC.remove(PlatformLogging.ERROR_CODE_MDC_KEY);
        }
    }

    private ResponseEntity<ApiErrorResponse> buildResponse(
            HttpStatus status,
            ApiErrorCode code,
            String message,
            HttpServletRequest request,
            Map<String, String> details
    ) {
        ApiErrorResponse body = new ApiErrorResponse(
                code.name(),
                message,
                resolveRequestId(request),
                Instant.now(),
                details
        );
        return ResponseEntity.status(status).body(body);
    }

    private String resolveRequestId(HttpServletRequest request) {
        return RequestCorrelation.resolveRequestId(
                request.getAttribute(RequestCorrelation.REQUEST_ID_ATTRIBUTE),
                request.getHeader(RequestCorrelation.REQUEST_ID_HEADER)
        );
    }

    private String resolveTraceId(HttpServletRequest request) {
        Object traceId = request.getAttribute(RequestCorrelation.TRACE_ID_ATTRIBUTE);
        if (traceId instanceof String value && !value.isBlank()) {
            return value.trim();
        }
        return null;
    }
}
