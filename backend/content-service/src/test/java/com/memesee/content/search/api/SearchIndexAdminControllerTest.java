package com.memesee.content.search.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.memesee.content.common.auth.InternalServiceTokenGuard;
import com.memesee.content.common.admin.InternalAdminAuditRecorder;
import com.memesee.content.search.application.MainPostSearchRebuildResult;
import com.memesee.content.search.application.MainPostSearchRebuildService;
import com.memesee.content.search.dto.MainPostSearchRebuildResponse;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class SearchIndexAdminControllerTest {

    private final RecordingMainPostSearchRebuildService rebuildService =
            new RecordingMainPostSearchRebuildService();
    private final SearchIndexAdminController controller = new SearchIndexAdminController(
            rebuildService,
            new InternalServiceTokenGuard("service-token"),
            InternalAdminAuditRecorder.noop()
    );

    @Test
    void rebuildMainPostSearchIndexRequiresInternalTokenAndReturnsResult() {
        rebuildService.result = new MainPostSearchRebuildResult(7);

        MainPostSearchRebuildResponse response =
                controller.rebuildMainPostSearchIndex(" service-token ", "release-bot", "request-1", "curl/8", 50);

        assertThat(response.indexedItems()).isEqualTo(7);
        assertThat(rebuildService.batchSizes).containsExactly(50);
    }

    @Test
    void rebuildMainPostSearchIndexUsesDefaultBatchSizeWhenMissing() {
        controller.rebuildMainPostSearchIndex("service-token", null, null, null, null);

        assertThat(rebuildService.batchSizes).containsExactly(200);
    }

    @Test
    void rebuildMainPostSearchIndexRejectsInvalidInternalTokenBeforeCallingService() {
        assertThatThrownBy(() -> controller.rebuildMainPostSearchIndex("wrong-token", null, null, null, 50))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.FORBIDDEN);
                });

        assertThat(rebuildService.batchSizes).isEmpty();
    }

    @Test
    void rebuildMainPostSearchIndexRejectsUnsafeBatchSizeBeforeCallingService() {
        assertThatThrownBy(() -> controller.rebuildMainPostSearchIndex("service-token", null, null, null, 1001))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        assertThatThrownBy(() -> controller.rebuildMainPostSearchIndex("service-token", null, null, null, -1))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        assertThat(rebuildService.batchSizes).isEmpty();
    }

    private static class RecordingMainPostSearchRebuildService extends MainPostSearchRebuildService {

        private final List<Integer> batchSizes = new ArrayList<>();
        private MainPostSearchRebuildResult result = new MainPostSearchRebuildResult(0);

        RecordingMainPostSearchRebuildService() {
            super(null, null, null, null);
        }

        @Override
        public MainPostSearchRebuildResult rebuildAll(Integer batchSize) {
            batchSizes.add(batchSize);
            return result;
        }
    }
}
