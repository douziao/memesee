package com.memesee.content.feed.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.memesee.content.common.auth.InternalServiceTokenGuard;
import com.memesee.content.common.admin.InternalAdminAuditRecorder;
import com.memesee.content.feed.application.FeedProjectionRebuildResult;
import com.memesee.content.feed.application.MainPostFeedProjectionRebuildService;
import com.memesee.content.feed.dto.FeedProjectionRebuildResponse;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class FeedProjectionAdminControllerTest {

    private final RecordingMainPostFeedProjectionRebuildService rebuildService =
            new RecordingMainPostFeedProjectionRebuildService();
    private final FeedProjectionAdminController controller = new FeedProjectionAdminController(
            rebuildService,
            new InternalServiceTokenGuard("service-token"),
            InternalAdminAuditRecorder.noop()
    );

    @Test
    void rebuildMainPostFeedProjectionRequiresInternalTokenAndReturnsResult() {
        rebuildService.result = new FeedProjectionRebuildResult(3, 7);

        FeedProjectionRebuildResponse response =
                controller.rebuildMainPostFeedProjection(" service-token ", "release-bot", "request-1", "curl/8", 50);

        assertThat(response.deletedItems()).isEqualTo(3);
        assertThat(response.rebuiltItems()).isEqualTo(7);
        assertThat(rebuildService.batchSizes).containsExactly(50);
    }

    @Test
    void rebuildMainPostFeedProjectionUsesDefaultBatchSizeWhenMissing() {
        controller.rebuildMainPostFeedProjection("service-token", null, null, null, null);

        assertThat(rebuildService.batchSizes).containsExactly(200);
    }

    @Test
    void rebuildMainPostFeedProjectionRejectsInvalidInternalTokenBeforeCallingService() {
        assertThatThrownBy(() -> controller.rebuildMainPostFeedProjection("wrong-token", null, null, null, 50))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.FORBIDDEN);
                });

        assertThat(rebuildService.batchSizes).isEmpty();
    }

    @Test
    void rebuildMainPostFeedProjectionRejectsUnsafeBatchSizeBeforeCallingService() {
        assertThatThrownBy(() -> controller.rebuildMainPostFeedProjection("service-token", null, null, null, 1001))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        assertThatThrownBy(() -> controller.rebuildMainPostFeedProjection("service-token", null, null, null, 0))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        assertThat(rebuildService.batchSizes).isEmpty();
    }

    @Test
    void rebuildMainPostFeedProjectionRecordsSuccessAndFailureAuditMetrics() {
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        RecordingMainPostFeedProjectionRebuildService auditedRebuildService =
                new RecordingMainPostFeedProjectionRebuildService();
        auditedRebuildService.result = new FeedProjectionRebuildResult(1, 2);
        FeedProjectionAdminController auditedController = new FeedProjectionAdminController(
                auditedRebuildService,
                new InternalServiceTokenGuard("service-token"),
                new InternalAdminAuditRecorder(meterRegistry)
        );

        auditedController.rebuildMainPostFeedProjection("service-token", "release-bot", "request-1", "curl/8", 10);
        assertThatThrownBy(() -> auditedController.rebuildMainPostFeedProjection(
                "wrong-token",
                "release-bot",
                "request-2",
                "curl/8",
                10
        )).isInstanceOf(ApiException.class);

        assertThat(meterRegistry.find("memesee.internal.admin.operation")
                .tag("operation", "feed.main-posts.rebuild")
                .tag("outcome", "success")
                .counter()
                .count())
                .isEqualTo(1.0);
        assertThat(meterRegistry.find("memesee.internal.admin.operation")
                .tag("operation", "feed.main-posts.rebuild")
                .tag("outcome", "failed")
                .counter()
                .count())
                .isEqualTo(1.0);
    }

    private static class RecordingMainPostFeedProjectionRebuildService
            extends MainPostFeedProjectionRebuildService {

        private final List<Integer> batchSizes = new ArrayList<>();
        private FeedProjectionRebuildResult result = new FeedProjectionRebuildResult(0, 0);

        RecordingMainPostFeedProjectionRebuildService() {
            super(null, null, null, null);
        }

        @Override
        public FeedProjectionRebuildResult rebuildAll(Integer batchSize) {
            batchSizes.add(batchSize);
            return result;
        }
    }
}
