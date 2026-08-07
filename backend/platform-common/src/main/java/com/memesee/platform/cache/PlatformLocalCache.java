package com.memesee.platform.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class PlatformLocalCache {

    private static final Duration DEFAULT_TTL = Duration.ofSeconds(30);

    private static final PlatformLocalCache DISABLED = new PlatformLocalCache(null);

    private final Cache<String, String> cache;

    private PlatformLocalCache(Cache<String, String> cache) {
        this.cache = cache;
    }

    public static PlatformLocalCache create(PlatformCacheProperties.LocalCacheProperties properties) {
        if (properties == null || !properties.isEnabled()) {
            return disabled();
        }
        Duration ttl = sanitizeTtl(properties.getTtl());
        long maximumSize = Math.max(1L, properties.getMaximumSize());
        return new PlatformLocalCache(Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .expireAfterWrite(ttl)
                .build());
    }

    public static PlatformLocalCache disabled() {
        return DISABLED;
    }

    public boolean isEnabled() {
        return cache != null;
    }

    public Optional<String> get(String key) {
        if (!isEnabled() || isBlank(key)) {
            return Optional.empty();
        }
        return Optional.ofNullable(cache.getIfPresent(key));
    }

    public void put(String key, String value) {
        if (!isEnabled() || isBlank(key) || isBlank(value)) {
            return;
        }
        cache.put(key, value);
    }

    public void evict(String key) {
        if (!isEnabled() || isBlank(key)) {
            return;
        }
        cache.invalidate(key);
    }

    public void evictAll(Collection<String> keys) {
        if (!isEnabled() || keys == null || keys.isEmpty()) {
            return;
        }
        List<String> validKeys = keys.stream()
                .filter(Objects::nonNull)
                .filter(key -> !key.isBlank())
                .toList();
        if (validKeys.isEmpty()) {
            return;
        }
        cache.invalidateAll(validKeys);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static Duration sanitizeTtl(Duration ttl) {
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            return DEFAULT_TTL;
        }
        return ttl;
    }
}
