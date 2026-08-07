package com.memesee.platform.cache;

import java.util.Optional;

public record PlatformCacheReadResult<T>(boolean handled, Optional<T> value, boolean stale) {

    public PlatformCacheReadResult {
        value = value == null ? Optional.empty() : value;
    }

    public static <T> PlatformCacheReadResult<T> miss() {
        return new PlatformCacheReadResult<>(false, Optional.empty(), false);
    }

    public static <T> PlatformCacheReadResult<T> hit(Optional<T> value, boolean stale) {
        return new PlatformCacheReadResult<>(true, value, stale);
    }
}
