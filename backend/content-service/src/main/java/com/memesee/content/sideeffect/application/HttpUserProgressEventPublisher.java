package com.memesee.content.sideeffect.application;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
@ConditionalOnProperty(
        prefix = "app.user-service.events",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class HttpUserProgressEventPublisher implements UserProgressEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(HttpUserProgressEventPublisher.class);
    private static final String INTERNAL_SERVICE_TOKEN_HEADER = "X-Internal-Service-Token";

    private final RestClient restClient;
    private final String serviceToken;

    public HttpUserProgressEventPublisher(
            RestClient.Builder restClientBuilder,
            @Value("${app.user-service.url:http://localhost:8081}") String userServiceUrl,
            @Value("${app.security.internal.service-token}") String serviceToken
    ) {
        this.restClient = restClientBuilder
                .baseUrl(userServiceUrl)
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
        this.serviceToken = normalizeServiceToken(serviceToken);
    }

    @Override
    public void onMainPostCreated(Long mainPostId, String authorUsername, String communitySlug, Instant occurredAt) {
        publish("/internal/events/posts/created", new MainPostEventRequest(
                mainPostId,
                authorUsername,
                communitySlug,
                occurredAt
        ));
    }

    @Override
    public void onMainPostDeleted(Long mainPostId, String authorUsername, String communitySlug, Instant occurredAt) {
        publish("/internal/events/posts/deleted", new MainPostEventRequest(
                mainPostId,
                authorUsername,
                communitySlug,
                occurredAt
        ));
    }

    private void publish(String path, MainPostEventRequest request) {
        if (!StringUtils.hasText(serviceToken)) {
            log.warn("user_progress_event_skipped reason=missing_service_token path={} mainPostId={}",
                    path,
                    request.mainPostId()
            );
            return;
        }
        try {
            restClient.post()
                    .uri(path)
                    .header(INTERNAL_SERVICE_TOKEN_HEADER, serviceToken)
                    .body(request)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException error) {
            log.warn("user_progress_event_publish_failed path={} mainPostId={}", path, request.mainPostId(), error);
        }
    }

    private String normalizeServiceToken(String rawToken) {
        if (!StringUtils.hasText(rawToken)) {
            return "";
        }
        return rawToken.trim();
    }

    private record MainPostEventRequest(
            Long mainPostId,
            String authorUsername,
            String communitySlug,
            Instant occurredAt
    ) {
    }
}
