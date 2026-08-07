package com.memesee.platform.cache;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class CacheKeyEncoder {

    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();

    private CacheKeyEncoder() {
    }

    public static String encodeNullable(String value) {
        if (value == null || value.isBlank()) {
            return "_";
        }
        return URL_ENCODER.encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
