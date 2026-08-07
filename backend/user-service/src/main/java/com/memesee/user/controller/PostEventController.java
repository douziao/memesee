package com.memesee.user.controller;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.user.service.UserPostEventApplicationService;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/events/posts")
public class PostEventController {

    static final String INTERNAL_SERVICE_TOKEN_HEADER = "X-Internal-Service-Token";

    private final UserPostEventApplicationService userPostEventApplicationService;
    private final String serviceToken;

    public PostEventController(
            UserPostEventApplicationService userPostEventApplicationService,
            @Value("${app.security.internal.service-token}") String serviceToken
    ) {
        this.userPostEventApplicationService = userPostEventApplicationService;
        this.serviceToken = normalizeToken(serviceToken);
    }

    @PostMapping("/created")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void postCreated(
            @RequestHeader(name = INTERNAL_SERVICE_TOKEN_HEADER, required = false) String providedServiceToken,
            @RequestBody PostCreatedEventRequest request
    ) {
        requireInternalServiceToken(providedServiceToken);
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "mainPostId 不能为空。");
        }
        userPostEventApplicationService.recordMainPostCreated(
                request.mainPostId(),
                request.authorUsername(),
                request.communitySlug(),
                request.occurredAt()
        );
    }

    @PostMapping("/deleted")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void postDeleted(
            @RequestHeader(name = INTERNAL_SERVICE_TOKEN_HEADER, required = false) String providedServiceToken,
            @RequestBody PostDeletedEventRequest request
    ) {
        requireInternalServiceToken(providedServiceToken);
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "mainPostId 不能为空。");
        }
        userPostEventApplicationService.recordMainPostDeleted(
                request.mainPostId(),
                request.authorUsername(),
                request.communitySlug(),
                request.occurredAt()
        );
    }

    private void requireInternalServiceToken(String providedServiceToken) {
        if (serviceToken == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, ApiErrorCode.FORBIDDEN, "内部服务凭证未配置。");
        }
        if (!serviceToken.equals(normalizeToken(providedServiceToken))) {
            throw new ApiException(HttpStatus.FORBIDDEN, ApiErrorCode.FORBIDDEN, "内部服务凭证无效。");
        }
    }

    private String normalizeToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        return token.trim();
    }

    private record PostCreatedEventRequest(
            Long mainPostId,
            String authorUsername,
            String communitySlug,
            Instant occurredAt
    ) {
    }

    private record PostDeletedEventRequest(
            Long mainPostId,
            String authorUsername,
            String communitySlug,
            Instant occurredAt
    ) {
    }
}
