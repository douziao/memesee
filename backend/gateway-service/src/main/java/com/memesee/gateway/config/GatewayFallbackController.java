package com.memesee.gateway.config;

import com.memesee.platform.web.RequestCorrelation;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
public class GatewayFallbackController {

    public static final String FALLBACK_PATH = "/__gateway/fallback";
    public static final String EVENT = "gateway_downstream_unavailable";

    @RequestMapping(FALLBACK_PATH)
    public Mono<ResponseEntity<Map<String, Object>>> fallback(ServerWebExchange exchange) {
        String requestId = RequestCorrelation.resolveRequestId(
                null,
                exchange.getRequest().getHeaders().getFirst(RequestCorrelation.REQUEST_ID_HEADER)
        );
        String traceparent = RequestCorrelation.resolveTraceparent(
                exchange.getRequest().getHeaders().getFirst(RequestCorrelation.TRACEPARENT_HEADER)
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put(RequestCorrelation.EVENT_FIELD, EVENT);
        body.put("message", "Downstream service is temporarily unavailable.");
        body.put(RequestCorrelation.REQUEST_ID_MDC_KEY, requestId);
        String traceId = RequestCorrelation.resolveTraceId(traceparent);
        if (traceId != null) {
            body.put(RequestCorrelation.TRACE_ID_MDC_KEY, traceId);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set(RequestCorrelation.REQUEST_ID_HEADER, requestId);
        if (traceparent != null) {
            headers.set(RequestCorrelation.TRACEPARENT_HEADER, traceparent);
        }
        return Mono.just(new ResponseEntity<>(body, headers, HttpStatus.SERVICE_UNAVAILABLE));
    }
}
