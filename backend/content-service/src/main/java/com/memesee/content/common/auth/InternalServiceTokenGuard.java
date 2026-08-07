package com.memesee.content.common.auth;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class InternalServiceTokenGuard {

    public static final String INTERNAL_SERVICE_TOKEN_HEADER = "X-Internal-Service-Token";

    private final String serviceToken;

    public InternalServiceTokenGuard(@Value("${app.security.internal.service-token}") String serviceToken) {
        this.serviceToken = normalizeToken(serviceToken);
    }

    public void require(String providedServiceToken) {
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
}
