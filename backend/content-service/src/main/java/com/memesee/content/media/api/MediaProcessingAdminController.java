package com.memesee.content.media.api;

import com.memesee.content.common.admin.InternalAdminRequestLimits;
import com.memesee.content.common.admin.InternalAdminAuditRecorder;
import com.memesee.content.common.admin.InternalAdminAuditRecorder.InternalAdminAuditEvent;
import com.memesee.content.common.auth.InternalServiceTokenGuard;
import com.memesee.content.media.application.MediaVariantRetryUseCase;
import com.memesee.content.media.dto.MediaProcessingRetryResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/media-assets")
public class MediaProcessingAdminController {

    private final MediaVariantRetryUseCase mediaVariantRetryUseCase;
    private final InternalServiceTokenGuard internalServiceTokenGuard;
    private final InternalAdminAuditRecorder internalAdminAuditRecorder;

    public MediaProcessingAdminController(
            MediaVariantRetryUseCase mediaVariantRetryUseCase,
            InternalServiceTokenGuard internalServiceTokenGuard,
            InternalAdminAuditRecorder internalAdminAuditRecorder
    ) {
        this.mediaVariantRetryUseCase = mediaVariantRetryUseCase;
        this.internalServiceTokenGuard = internalServiceTokenGuard;
        this.internalAdminAuditRecorder = internalAdminAuditRecorder;
    }

    @PostMapping("/{assetId}/variants/retry")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public MediaProcessingRetryResponse retryOne(
            @RequestHeader(name = InternalServiceTokenGuard.INTERNAL_SERVICE_TOKEN_HEADER, required = false)
            String providedServiceToken,
            @RequestHeader(name = InternalAdminAuditRecorder.INTERNAL_OPERATOR_HEADER, required = false)
            String operator,
            @RequestHeader(name = InternalAdminAuditRecorder.REQUEST_ID_HEADER, required = false)
            String requestId,
            @RequestHeader(name = InternalAdminAuditRecorder.USER_AGENT_HEADER, required = false)
            String userAgent,
            @PathVariable Long assetId
    ) {
        long startedNanos = System.nanoTime();
        try {
            internalServiceTokenGuard.require(providedServiceToken);
            mediaVariantRetryUseCase.retryMediaVariantProcessing(assetId);
            recordAudit("media-assets.variants.retry-one", "success", operator, requestId, userAgent, null, assetId, 1, startedNanos);
            return new MediaProcessingRetryResponse(List.of(assetId), 1);
        } catch (RuntimeException exception) {
            recordAudit("media-assets.variants.retry-one", "failed", operator, requestId, userAgent, null, assetId, null, startedNanos);
            throw exception;
        }
    }

    @PostMapping("/variants/retry-failed")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public MediaProcessingRetryResponse retryFailed(
            @RequestHeader(name = InternalServiceTokenGuard.INTERNAL_SERVICE_TOKEN_HEADER, required = false)
            String providedServiceToken,
            @RequestHeader(name = InternalAdminAuditRecorder.INTERNAL_OPERATOR_HEADER, required = false)
            String operator,
            @RequestHeader(name = InternalAdminAuditRecorder.REQUEST_ID_HEADER, required = false)
            String requestId,
            @RequestHeader(name = InternalAdminAuditRecorder.USER_AGENT_HEADER, required = false)
            String userAgent,
            @RequestParam(required = false, defaultValue = "20") Integer limit
    ) {
        long startedNanos = System.nanoTime();
        Integer safeLimit = null;
        try {
            internalServiceTokenGuard.require(providedServiceToken);
            safeLimit = InternalAdminRequestLimits.requirePositiveIntAtMost(
                    "limit",
                    limit,
                    InternalAdminRequestLimits.DEFAULT_MEDIA_RETRY_LIMIT,
                    InternalAdminRequestLimits.MAX_MEDIA_RETRY_LIMIT
            );
            List<Long> assetIds = mediaVariantRetryUseCase.retryFailedMediaVariantProcessing(safeLimit);
            recordAudit(
                    "media-assets.variants.retry-failed",
                    "success",
                    operator,
                    requestId,
                    userAgent,
                    safeLimit,
                    null,
                    assetIds.size(),
                    startedNanos
            );
            return new MediaProcessingRetryResponse(assetIds, assetIds.size());
        } catch (RuntimeException exception) {
            recordAudit(
                    "media-assets.variants.retry-failed",
                    "failed",
                    operator,
                    requestId,
                    userAgent,
                    safeLimit,
                    null,
                    null,
                    startedNanos
            );
            throw exception;
        }
    }

    private void recordAudit(
            String operation,
            String outcome,
            String operator,
            String requestId,
            String userAgent,
            Integer limit,
            Long targetId,
            Integer resultCount,
            long startedNanos
    ) {
        internalAdminAuditRecorder.record(new InternalAdminAuditEvent(
                operation,
                outcome,
                operator,
                requestId,
                userAgent,
                null,
                limit,
                targetId,
                resultCount,
                System.nanoTime() - startedNanos
        ));
    }
}
