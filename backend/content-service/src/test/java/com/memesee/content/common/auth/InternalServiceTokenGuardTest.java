package com.memesee.content.common.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class InternalServiceTokenGuardTest {

    @Test
    void allowsMatchingTokenAfterTrimmingConfiguredAndProvidedValues() {
        InternalServiceTokenGuard guard = new InternalServiceTokenGuard(" service-token ");

        assertThatCode(() -> guard.require(" service-token "))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsWhenServiceTokenIsMissing() {
        InternalServiceTokenGuard guard = new InternalServiceTokenGuard(" ");

        assertThatThrownBy(() -> guard.require("service-token"))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.FORBIDDEN);
                    assertThat(exception.getMessage()).contains("未配置");
                });
    }

    @Test
    void rejectsMissingOrMismatchedProvidedToken() {
        InternalServiceTokenGuard guard = new InternalServiceTokenGuard("service-token");

        assertThatThrownBy(() -> guard.require(null))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.FORBIDDEN);
                    assertThat(exception.getMessage()).contains("无效");
                });
        assertThatThrownBy(() -> guard.require("wrong-token"))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.FORBIDDEN);
                    assertThat(exception.getMessage()).contains("无效");
                });
    }
}
