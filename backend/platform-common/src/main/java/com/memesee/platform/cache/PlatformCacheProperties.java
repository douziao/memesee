package com.memesee.platform.cache;

import java.time.Duration;

public class PlatformCacheProperties {

    private static final Duration DEFAULT_TTL = Duration.ofSeconds(30);

    private static final Duration DEFAULT_NULL_VALUE_TTL = Duration.ofSeconds(10);

    private static final Duration DEFAULT_LOCAL_CACHE_TTL = Duration.ofSeconds(30);

    private static final long DEFAULT_LOCAL_CACHE_MAXIMUM_SIZE = 256L;

    private static final String DEFAULT_SERIALIZATION_VERSION = "v1";

    private boolean enabled = true;

    private Duration ttl = DEFAULT_TTL;

    private Duration nullValueTtl = DEFAULT_NULL_VALUE_TTL;

    private Duration freshnessTtl;

    private String keyPrefix;

    private String legacyKeyPrefix;

    private String serializationVersion = DEFAULT_SERIALIZATION_VERSION;

    private LocalCacheProperties localCache = LocalCacheProperties.disabled(
            DEFAULT_LOCAL_CACHE_MAXIMUM_SIZE,
            DEFAULT_LOCAL_CACHE_TTL
    );

    protected PlatformCacheProperties() {
    }

    protected PlatformCacheProperties(Duration ttl, String keyPrefix, String legacyKeyPrefix) {
        this.ttl = ttl;
        this.nullValueTtl = defaultBoundedTtl(ttl);
        this.keyPrefix = keyPrefix;
        this.legacyKeyPrefix = legacyKeyPrefix;
        this.localCache = LocalCacheProperties.disabled(
                DEFAULT_LOCAL_CACHE_MAXIMUM_SIZE,
                defaultBoundedTtl(ttl)
        );
    }

    private static Duration defaultBoundedTtl(Duration ttl) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            return DEFAULT_LOCAL_CACHE_TTL;
        }
        return ttl.compareTo(DEFAULT_LOCAL_CACHE_TTL) > 0 ? DEFAULT_LOCAL_CACHE_TTL : ttl;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Duration getTtl() {
        return ttl;
    }

    public void setTtl(Duration ttl) {
        this.ttl = ttl;
    }

    public Duration getNullValueTtl() {
        return nullValueTtl;
    }

    public void setNullValueTtl(Duration nullValueTtl) {
        this.nullValueTtl = nullValueTtl;
    }

    public Duration getFreshnessTtl() {
        return freshnessTtl;
    }

    public void setFreshnessTtl(Duration freshnessTtl) {
        this.freshnessTtl = freshnessTtl;
    }

    public String getKeyPrefix() {
        return keyPrefix;
    }

    public void setKeyPrefix(String keyPrefix) {
        this.keyPrefix = keyPrefix;
    }

    public String getLegacyKeyPrefix() {
        return legacyKeyPrefix;
    }

    public void setLegacyKeyPrefix(String legacyKeyPrefix) {
        this.legacyKeyPrefix = legacyKeyPrefix;
    }

    public String getSerializationVersion() {
        return serializationVersion;
    }

    public void setSerializationVersion(String serializationVersion) {
        this.serializationVersion = serializationVersion;
    }

    public LocalCacheProperties getLocalCache() {
        return localCache;
    }

    public void setLocalCache(LocalCacheProperties localCache) {
        this.localCache = localCache == null ? new LocalCacheProperties() : localCache;
    }

    public static class LocalCacheProperties {

        private boolean enabled = false;

        private long maximumSize = DEFAULT_LOCAL_CACHE_MAXIMUM_SIZE;

        private Duration ttl = DEFAULT_LOCAL_CACHE_TTL;

        public LocalCacheProperties() {
        }

        private LocalCacheProperties(boolean enabled, long maximumSize, Duration ttl) {
            this.enabled = enabled;
            this.maximumSize = maximumSize;
            this.ttl = ttl;
        }

        public static LocalCacheProperties disabled(long maximumSize, Duration ttl) {
            return new LocalCacheProperties(false, maximumSize, ttl);
        }

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public long getMaximumSize() {
            return maximumSize;
        }

        public void setMaximumSize(long maximumSize) {
            this.maximumSize = maximumSize;
        }

        public Duration getTtl() {
            return ttl;
        }

        public void setTtl(Duration ttl) {
            this.ttl = ttl;
        }
    }
}
