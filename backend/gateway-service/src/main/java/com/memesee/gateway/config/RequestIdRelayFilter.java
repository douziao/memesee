package com.memesee.gateway.config;

import com.memesee.platform.web.RequestCorrelation;
import com.memesee.platform.web.RequestCorrelationContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class RequestIdRelayFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(RequestIdRelayFilter.class);

    public static final String REQUEST_ID_HEADER = RequestCorrelation.REQUEST_ID_HEADER;
    public static final String TRACEPARENT_HEADER = RequestCorrelation.TRACEPARENT_HEADER;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        long startedAtNanos = System.nanoTime();
        HttpHeaders headers = exchange.getRequest().getHeaders();
        RequestCorrelationContext correlationContext = resolveCorrelationContext(headers);

        ServerHttpRequest mutatedRequest = exchange.getRequest()
                .mutate()
                .headers(currentHeaders -> {
                    currentHeaders.set(REQUEST_ID_HEADER, correlationContext.requestId());
                    if (correlationContext.traceparent() != null) {
                        currentHeaders.set(TRACEPARENT_HEADER, correlationContext.traceparent());
                    } else {
                        currentHeaders.remove(TRACEPARENT_HEADER);
                    }
                })
                .build();

        ServerWebExchange mutatedExchange = exchange.mutate().request(mutatedRequest).build();
        mutatedExchange.getResponse().beforeCommit(() -> {
            mutatedExchange.getResponse().getHeaders().set(REQUEST_ID_HEADER, correlationContext.requestId());
            if (correlationContext.traceparent() != null) {
                mutatedExchange.getResponse().getHeaders().set(TRACEPARENT_HEADER, correlationContext.traceparent());
            } else {
                mutatedExchange.getResponse().getHeaders().remove(TRACEPARENT_HEADER);
            }
            return Mono.empty();
        });
        return chain.filter(mutatedExchange)
                .doFinally(signalType -> logRequestCompletion(mutatedExchange, correlationContext, startedAtNanos));
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    private RequestCorrelationContext resolveCorrelationContext(HttpHeaders headers) {
        return RequestCorrelation.resolveContext(
                headers.getFirst(REQUEST_ID_HEADER),
                headers.getFirst(TRACEPARENT_HEADER)
        );
    }

    private void logRequestCompletion(
            ServerWebExchange exchange,
            RequestCorrelationContext correlationContext,
            long startedAtNanos
    ) {
        String path = exchange.getRequest().getURI().getPath();
        int status = 0;
        if (exchange.getResponse().getStatusCode() != null) {
            status = exchange.getResponse().getStatusCode().value();
        }

        long durationMs = (System.nanoTime() - startedAtNanos) / 1_000_000L;
        MDC.put(RequestCorrelation.REQUEST_ID_MDC_KEY, correlationContext.requestId());
        if (correlationContext.traceId() != null) {
            MDC.put(RequestCorrelation.TRACE_ID_MDC_KEY, correlationContext.traceId());
        }
        try {
            var builder = log.atInfo();
            for (var entry : RequestCorrelation.httpRequestCompletionFields(
                    exchange.getRequest().getMethod() != null ? exchange.getRequest().getMethod().name() : null,
                    path,
                    status,
                    durationMs,
                    correlationContext
            ).entrySet()) {
                builder = builder.addKeyValue(entry.getKey(), entry.getValue());
            }
            builder.log(RequestCorrelation.HTTP_REQUEST_COMPLETED_EVENT);
        } finally {
            MDC.remove(RequestCorrelation.REQUEST_ID_MDC_KEY);
            MDC.remove(RequestCorrelation.TRACE_ID_MDC_KEY);
        }
    }
}
