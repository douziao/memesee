package com.memesee.content.search.api;

import com.memesee.content.common.admin.InternalAdminRequestLimits;
import com.memesee.content.common.admin.InternalAdminAuditRecorder;
import com.memesee.content.common.admin.InternalAdminAuditRecorder.InternalAdminAuditEvent;
import com.memesee.content.common.auth.InternalServiceTokenGuard;
import com.memesee.content.search.application.MainPostSearchRebuildResult;
import com.memesee.content.search.application.MainPostSearchRebuildService;
import com.memesee.content.search.dto.MainPostSearchRebuildResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/search/main-posts")
public class SearchIndexAdminController {

    private final MainPostSearchRebuildService rebuildService;
    private final InternalServiceTokenGuard internalServiceTokenGuard;
    private final InternalAdminAuditRecorder internalAdminAuditRecorder;

    public SearchIndexAdminController(
            MainPostSearchRebuildService rebuildService,
            InternalServiceTokenGuard internalServiceTokenGuard,
            InternalAdminAuditRecorder internalAdminAuditRecorder
    ) {
        this.rebuildService = rebuildService;
        this.internalServiceTokenGuard = internalServiceTokenGuard;
        this.internalAdminAuditRecorder = internalAdminAuditRecorder;
    }

    @PostMapping("/rebuild")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public MainPostSearchRebuildResponse rebuildMainPostSearchIndex(
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
            MainPostSearchRebuildResult result = rebuildService.rebuildAll(safeBatchSize);
            recordAudit(
                    "success",
                    operator,
                    requestId,
                    userAgent,
                    safeBatchSize,
                    (int) Math.min(Integer.MAX_VALUE, result.indexedItems()),
                    startedNanos
            );
            return new MainPostSearchRebuildResponse(result.indexedItems());
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
                "search.main-posts.rebuild",
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
