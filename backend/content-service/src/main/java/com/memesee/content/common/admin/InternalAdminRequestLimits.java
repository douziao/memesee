package com.memesee.content.common.admin;

import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import org.springframework.http.HttpStatus;

public final class InternalAdminRequestLimits {

    public static final int DEFAULT_REBUILD_BATCH_SIZE = 200;
    public static final int MAX_REBUILD_BATCH_SIZE = 1000;
    public static final int DEFAULT_MEDIA_RETRY_LIMIT = 20;
    public static final int MAX_MEDIA_RETRY_LIMIT = 100;

    private InternalAdminRequestLimits() {
    }

    public static int requirePositiveIntAtMost(
            String parameterName,
            Integer value,
            int defaultValue,
            int maxValue
    ) {
        if (value == null) {
            return defaultValue;
        }
        if (value <= 0) {
            throw invalid(parameterName, "必须大于 0。");
        }
        if (value > maxValue) {
            throw invalid(parameterName, "不能超过 " + maxValue + "。");
        }
        return value;
    }

    private static ApiException invalid(String parameterName, String detail) {
        return new ApiException(
                HttpStatus.BAD_REQUEST,
                ApiErrorCode.INVALID_REQUEST,
                "内部维护参数 " + parameterName + " 无效：" + detail
        );
    }
}
