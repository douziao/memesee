package com.memesee.content.common.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class InternalAdminRequestLimitsTest {

    @Test
    void usesDefaultWhenValueIsMissing() {
        int value = InternalAdminRequestLimits.requirePositiveIntAtMost("batchSize", null, 200, 1000);

        assertThat(value).isEqualTo(200);
    }

    @Test
    void allowsPositiveValueAtLimit() {
        int value = InternalAdminRequestLimits.requirePositiveIntAtMost("limit", 100, 20, 100);

        assertThat(value).isEqualTo(100);
    }

    @Test
    void rejectsNonPositiveValue() {
        assertThatThrownBy(() -> InternalAdminRequestLimits.requirePositiveIntAtMost("limit", 0, 20, 100))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                    assertThat(exception.getMessage()).contains("limit").contains("大于 0");
                });
    }

    @Test
    void rejectsValueAboveLimit() {
        assertThatThrownBy(() -> InternalAdminRequestLimits.requirePositiveIntAtMost("batchSize", 1001, 200, 1000))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                    assertThat(exception.getMessage()).contains("batchSize").contains("1000");
                });
    }
}
