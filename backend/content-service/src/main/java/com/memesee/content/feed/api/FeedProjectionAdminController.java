package com.memesee.content.feed.api;

import com.memesee.content.common.admin.InternalAdminRequestLimits;
import com.memesee.content.common.admin.InternalAdminAuditRecorder;
import com.memesee.content.common.admin.InternalAdminAuditRecorder.InternalAdminAuditEvent;
import com.memesee.content.common.auth.InternalServiceTokenGuard;
import com.memesee.content.feed.application.FeedProjectionRebuildResult;
import com.memesee.content.feed.application.MainPostFeedProjectionRebuildService;
import com.memesee.content.feed.dto.FeedProjectionRebuildResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/feed/main-posts")
public class FeedProjectionAdminController {

    private final MainPostFeedProjectionRebuildService rebuildService;
    private final InternalServiceTokenGuard internalServiceTokenGuard;
    private final InternalAdminAuditRecorder internalAdminAuditRecorder;

    public FeedProjectionAdminController(
            MainPostFeedProjectionRebuildService rebuildService,
            InternalServiceTokenGuard internalServiceTokenGuard,
            InternalAdminAuditRecorder internalAdminAuditRecorder
    ) {
        this.rebuildService = rebuildService;
        this.internalServiceTokenGuard = internalServiceTokenGuard;
        this.internalAdminAuditRecorder = internalAdminAuditRecorder;
    }

    @PostMapping("/rebuild")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public FeedProjectionRebuildResponse rebuildMainPostFeedProjection(
            @RequestHeader(name = InternalServiceTokenGuard.INTERNAL_SERVICE_TOKEN_HEADER, required = false)
            String providedServiceToken,
            @RequestHeader(name = InternalAdminAuditRecorder.INTERNAL_OPERATOR_HEADER, required = false)
            String operator,
            @RequestHeader(name = InternalAdminAuditRecorder.REQUEST_ID_HEADER, required = false)
            String requestId,
            @RequestHeader(name = InternalAdminAuditRecorder.USER_AGENT_HEADER, required = false)
            String userAgent,
            @RequestParam(required = false) Integer batchSize
    ) {
        long startedNanos = System.nanoTime();
        Integer safeBatchSize = null;
        try {
            internalServiceTokenGuard.require(providedServiceToken);
            safeBatchSize = InternalAdminRequestLimits.requirePositiveIntAtMost(
                    "batchSize",
                    batchSize,
                    InternalAdminRequestLimits.DEFAULT_REBUILD_BATCH_SIZE,
                    InternalAdminRequestLimits.MAX_REBUILD_BATCH_SIZE
            );
            FeedProjectionRebuildResult result = rebuildService.rebuildAll(safeBatchSize);
            recordAudit(
                    "success",
                    operator,
                    requestId,
                    userAgent,
                    safeBatchSize,
                    (int) Math.min(Integer.MAX_VALUE, result.rebuiltItems()),
                    startedNanos
            );
            return new FeedProjectionRebuildResponse(result.deletedItems(), result.rebuiltItems());
        } catch (RuntimeException exception) {
            recordAudit("failed", operator, requestId, userAgent, safeBatchSize, null, startedNanos);
            throw exception;
        }
    }

    private void recordAudit(
            String outcome,
            String operator,
            String requestId,
            String userAgent,
            Integer batchSize,
            Integer resultCount,
            long startedNanos
    ) {
        internalAdminAuditRecorder.record(new InternalAdminAuditEvent(
                "feed.main-posts.rebuild",
                outcome,
                operator,
                requestId,
                userAgent,
                batchSize,
                null,
                null,
                resultCount,
                System.nanoTime() - startedNanos
        ));
    }
}
