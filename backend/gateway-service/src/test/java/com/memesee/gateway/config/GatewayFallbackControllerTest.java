package com.memesee.gateway.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.memesee.platform.web.RequestCorrelation;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

class GatewayFallbackControllerTest {

    private final GatewayFallbackController controller = new GatewayFallbackController();

    @Test
    void returnsTraceableServiceUnavailableFallback() {
        String traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00";
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest
                .get(GatewayFallbackController.FALLBACK_PATH)
                .header(RequestCorrelation.REQUEST_ID_HEADER, "request-123")
                .header(RequestCorrelation.TRACEPARENT_HEADER, traceparent));

        var response = controller.fallback(exchange).block();

        assertThat(response).isNotNull();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getFirst(RequestCorrelation.REQUEST_ID_HEADER)).isEqualTo("request-123");
        assertThat(response.getHeaders().getFirst(RequestCorrelation.TRACEPARENT_HEADER)).isEqualTo(traceparent);
        assertThat(response.getBody())
                .containsEntry(RequestCorrelation.EVENT_FIELD, GatewayFallbackController.EVENT)
                .containsEntry(RequestCorrelation.REQUEST_ID_MDC_KEY, "request-123")
                .containsEntry(RequestCorrelation.TRACE_ID_MDC_KEY, "4bf92f3577b34da6a3ce929d0e0e4736");
    }

    @Test
    void generatesFallbackRequestIdWhenMissing() {
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest
                .get(GatewayFallbackController.FALLBACK_PATH));

        var response = controller.fallback(exchange).block();

        assertThat(response).isNotNull();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getFirst(RequestCorrelation.REQUEST_ID_HEADER))
                .isEqualTo(RequestCorrelation.UNKNOWN_REQUEST_ID);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry(RequestCorrelation.REQUEST_ID_MDC_KEY, RequestCorrelation.UNKNOWN_REQUEST_ID);
    }
}
