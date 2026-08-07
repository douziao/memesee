package com.memesee.user.config;

import com.memesee.platform.web.RequestCorrelation;
import com.memesee.platform.web.RequestCorrelationContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestIdFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);

    public static final String REQUEST_ID_ATTRIBUTE = RequestCorrelation.REQUEST_ID_ATTRIBUTE;
    public static final String TRACE_ID_ATTRIBUTE = RequestCorrelation.TRACE_ID_ATTRIBUTE;
    public static final String REQUEST_ID_HEADER = RequestCorrelation.REQUEST_ID_HEADER;
    public static final String TRACEPARENT_HEADER = RequestCorrelation.TRACEPARENT_HEADER;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long startedAtNanos = System.nanoTime();
        RequestCorrelationContext correlationContext = resolveCorrelationContext(request);

        request.setAttribute(REQUEST_ID_ATTRIBUTE, correlationContext.requestId());
        response.setHeader(REQUEST_ID_HEADER, correlationContext.requestId());
        MDC.put(RequestCorrelation.REQUEST_ID_MDC_KEY, correlationContext.requestId());

        try {
            if (correlationContext.traceId() != null) {
                request.setAttribute(TRACE_ID_ATTRIBUTE, correlationContext.traceId());
                response.setHeader(TRACEPARENT_HEADER, correlationContext.traceparent());
                MDC.put(RequestCorrelation.TRACE_ID_MDC_KEY, correlationContext.traceId());
            }
            filterChain.doFilter(request, response);
        } finally {
            logRequestCompletion(request, response, correlationContext, startedAtNanos);
            MDC.remove(RequestCorrelation.REQUEST_ID_MDC_KEY);
            MDC.remove(RequestCorrelation.TRACE_ID_MDC_KEY);
        }
    }

    private RequestCorrelationContext resolveCorrelationContext(HttpServletRequest request) {
        return RequestCorrelation.resolveContext(
                request.getHeader(REQUEST_ID_HEADER),
                request.getHeader(TRACEPARENT_HEADER)
        );
    }

    private void logRequestCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            RequestCorrelationContext correlationContext,
            long startedAtNanos
    ) {
        long durationMs = (System.nanoTime() - startedAtNanos) / 1_000_000L;
        var builder = log.atInfo();
        for (var entry : RequestCorrelation.httpRequestCompletionFields(
                request.getMethod(),
                request.getRequestURI(),
                response.getStatus(),
                durationMs,
                correlationContext
        ).entrySet()) {
            builder = builder.addKeyValue(entry.getKey(), entry.getValue());
        }
        builder.log(RequestCorrelation.HTTP_REQUEST_COMPLETED_EVENT);
    }
}
