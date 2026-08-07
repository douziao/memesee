package com.memesee.content.media.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.memesee.content.common.auth.InternalServiceTokenGuard;
import com.memesee.content.common.admin.InternalAdminAuditRecorder;
import com.memesee.content.media.application.MediaVariantRetryUseCase;
import com.memesee.content.media.dto.MediaProcessingRetryResponse;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class MediaProcessingAdminControllerTest {

    private final RecordingMediaVariantRetryUseCase mediaVariantRetryUseCase = new RecordingMediaVariantRetryUseCase();
    private final MediaProcessingAdminController controller = new MediaProcessingAdminController(
            mediaVariantRetryUseCase,
            new InternalServiceTokenGuard("service-token"),
            InternalAdminAuditRecorder.noop()
    );

    @Test
    void retryOneRequiresInternalTokenAndReturnsAcceptedAssetId() {
        MediaProcessingRetryResponse response = controller.retryOne(" service-token ", "release-bot", "request-1", "curl/8", 42L);

        assertThat(response.assetIds()).containsExactly(42L);
        assertThat(response.count()).isEqualTo(1);
        assertThat(mediaVariantRetryUseCase.retriedAssetIds).containsExactly(42L);
    }

    @Test
    void retryOneRejectsInvalidInternalTokenBeforeCallingService() {
        assertThatThrownBy(() -> controller.retryOne("wrong-token", null, null, null, 42L))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.FORBIDDEN);
                });

        assertThat(mediaVariantRetryUseCase.retriedAssetIds).isEmpty();
    }

    @Test
    void retryOnePropagatesInvalidAssetIdAsBadRequest() {
        mediaVariantRetryUseCase.retryOneException =
                new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "媒体资产 ID 无效。");

        assertThatThrownBy(() -> controller.retryOne("service-token", null, null, null, 0L))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });
    }

    @Test
    void retryFailedUsesDefaultLimitAndReturnsSelectedAssetIds() {
        mediaVariantRetryUseCase.retryFailedAssetIds = List.of(7L, 8L);

        MediaProcessingRetryResponse response = controller.retryFailed("service-token", null, null, null, null);

        assertThat(response.assetIds()).containsExactly(7L, 8L);
        assertThat(response.count()).isEqualTo(2);
        assertThat(mediaVariantRetryUseCase.retryFailedLimits).containsExactly(20);
    }

    @Test
    void retryFailedRejectsUnsafeLimitBeforeCallingService() {
        assertThatThrownBy(() -> controller.retryFailed("service-token", null, null, null, 101))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        assertThatThrownBy(() -> controller.retryFailed("service-token", null, null, null, 0))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        assertThat(mediaVariantRetryUseCase.retryFailedLimits).isEmpty();
    }

    private static class RecordingMediaVariantRetryUseCase implements MediaVariantRetryUseCase {

        private final List<Long> retriedAssetIds = new ArrayList<>();
        private final List<Integer> retryFailedLimits = new ArrayList<>();
        private List<Long> retryFailedAssetIds = List.of();
        private ApiException retryOneException;

        @Override
        public void retryMediaVariantProcessing(Long assetId) {
            if (retryOneException != null) {
                throw retryOneException;
            }
            retriedAssetIds.add(assetId);
        }

        @Override
        public List<Long> retryFailedMediaVariantProcessing(int limit) {
            retryFailedLimits.add(limit);
            return retryFailedAssetIds;
        }
    }
}
