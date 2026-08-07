package com.memesee.platform.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

public class StringValueRedisCacheSupport<T> {

    private static final Logger log = LoggerFactory.getLogger(StringValueRedisCacheSupport.class);

    private final StringRedisTemplate redisTemplate;
    private final CacheMetricsRecorder metricsRecorder;
    private final String cacheName;
    private final Function<String, T> deserializer;
    private final Function<T, String> serializer;
    private final VersionedStringCachePayloadCodec payloadCodec;
    private final PlatformLocalCache localCache;
    private final Map<String, Set<String>> localIndexKeys = new ConcurrentHashMap<>();

    public StringValueRedisCacheSupport(
            StringRedisTemplate redisTemplate,
            CacheMetricsRecorder metricsRecorder,
            String cacheName,
            Function<String, T> deserializer,
            Function<T, String> serializer
    ) {
        this(redisTemplate, metricsRecorder, cacheName, deserializer, serializer, PlatformLocalCache.disabled(), "v1");
    }

    public StringValueRedisCacheSupport(
            StringRedisTemplate redisTemplate,
            CacheMetricsRecorder metricsRecorder,
            String cacheName,
            Function<String, T> deserializer,
            Function<T, String> serializer,
            PlatformLocalCache localCache
    ) {
        this(redisTemplate, metricsRecorder, cacheName, deserializer, serializer, localCache, "v1");
    }

    public StringValueRedisCacheSupport(
            StringRedisTemplate redisTemplate,
            CacheMetricsRecorder metricsRecorder,
            String cacheName,
            Function<String, T> deserializer,
            Function<T, String> serializer,
            PlatformLocalCache localCache,
            String serializationVersion
    ) {
        this(
                redisTemplate,
                metricsRecorder,
                cacheName,
                deserializer,
                serializer,
                localCache,
                serializationVersion,
                new ObjectMapper().findAndRegisterModules()
        );
    }

    public StringValueRedisCacheSupport(
            StringRedisTemplate redisTemplate,
            CacheMetricsRecorder metricsRecorder,
            String cacheName,
            Function<String, T> deserializer,
            Function<T, String> serializer,
            PlatformLocalCache localCache,
            String serializationVersion,
            ObjectMapper objectMapper
    ) {
        this.redisTemplate = Objects.requireNonNull(redisTemplate, "redisTemplate must not be null");
        this.metricsRecorder = Objects.requireNonNull(metricsRecorder, "metricsRecorder must not be null");
        this.cacheName = Objects.requireNonNull(cacheName, "cacheName must not be null");
        this.deserializer = Objects.requireNonNull(deserializer, "deserializer must not be null");
        this.serializer = Objects.requireNonNull(serializer, "serializer must not be null");
        this.payloadCodec = new VersionedStringCachePayloadCodec(
                Objects.requireNonNull(objectMapper, "objectMapper must not be null"),
                serializationVersion
        );
        this.localCache = localCache == null ? PlatformLocalCache.disabled() : localCache;
    }

    public void recordLoaderHit() {
        metricsRecorder.loaderHit();
    }

    public void recordRequestMerge() {
        metricsRecorder.requestMerge();
    }

    public void recordRefresh() {
        metricsRecorder.refresh();
    }

    public void recordRefreshMerge() {
        metricsRecorder.refreshMerge();
    }

    public Optional<T> read(String redisKey, String legacyRedisKey) {
        return readSnapshot(redisKey, legacyRedisKey, null).value();
    }

    public PlatformCacheReadResult<T> readSnapshot(String redisKey, String legacyRedisKey, Duration freshnessTtl) {
        ReadOutcome<T> localValue = readLocal(redisKey, freshnessTtl);
        if (localValue.handled()) {
            return localValue.asResult();
        }
        try {
            String payload = readPayload(redisKey, legacyRedisKey);
            Optional<String> decodedPayload = payloadCodec.deserialize(payload);
            if (decodedPayload.isEmpty()) {
                metricsRecorder.miss();
                return PlatformCacheReadResult.miss();
            }
            T value = deserializer.apply(decodedPayload.get());
            if (value == null) {
                metricsRecorder.miss();
                return PlatformCacheReadResult.miss();
            }
            localCache.put(redisKey, payload);
            metricsRecorder.hit();
            metricsRecorder.l2Hit();
            return PlatformCacheReadResult.hit(Optional.of(value), isStale(payload, freshnessTtl));
        } catch (RuntimeException error) {
            metricsRecorder.error();
            metricsRecorder.fallback();
            log.warn("Failed to read cache {} key {}", cacheName, redisKey, error);
            return PlatformCacheReadResult.miss();
        }
    }

    public void write(String redisKey, T value, Duration ttl) {
        try {
            String payload = payloadCodec.serialize(serializer.apply(value));
            redisTemplate.opsForValue().set(redisKey, payload, ttl);
            localCache.put(redisKey, payload);
            metricsRecorder.write();
        } catch (RuntimeException error) {
            metricsRecorder.error();
            log.warn("Failed to write cache {} key {}", cacheName, redisKey, error);
        }
    }

    public void writeIndexed(String redisKey, String indexKey, T value, Duration ttl) {
        try {
            String payload = payloadCodec.serialize(serializer.apply(value));
            redisTemplate.opsForValue().set(redisKey, payload, ttl);
            redisTemplate.opsForSet().add(indexKey, redisKey);
            redisTemplate.expire(indexKey, ttl);
            localCache.put(redisKey, payload);
            trackIndexedLocalKey(indexKey, redisKey);
            metricsRecorder.write();
        } catch (RuntimeException error) {
            metricsRecorder.error();
            log.warn("Failed to write cache {} key {}", cacheName, redisKey, error);
        }
    }

    public void evict(String redisKey, String legacyRedisKey) {
        try {
            deleteIfPresent(redisKey);
            deleteIfPresent(legacyRedisKey);
            metricsRecorder.evict();
        } catch (RuntimeException error) {
            metricsRecorder.error();
            log.warn("Failed to evict cache {} key {}", cacheName, redisKey, error);
        } finally {
            localCache.evict(redisKey);
            localCache.evict(legacyRedisKey);
        }
    }

    public void evictIndexed(String indexKey, String legacyIndexKey) {
        Set<String> keys = new LinkedHashSet<>();
        keys.addAll(drainTrackedLocalKeys(indexKey));
        keys.addAll(drainTrackedLocalKeys(legacyIndexKey));
        try {
            keys.addAll(readMembers(indexKey));
            keys.addAll(readMembers(legacyIndexKey));
            if (!keys.isEmpty()) {
                redisTemplate.delete(keys);
            }
            deleteIfPresent(indexKey);
            deleteIfPresent(legacyIndexKey);
            metricsRecorder.evict();
        } catch (RuntimeException error) {
            metricsRecorder.error();
            log.warn("Failed to evict cache {} indexed keys", cacheName, error);
        } finally {
            localCache.evictAll(keys);
        }
    }

    private String readPayload(String redisKey, String legacyRedisKey) {
        String payload = readCurrentPayload(redisKey);
        if (payload != null) {
            return payload;
        }
        if (legacyRedisKey == null || legacyRedisKey.isBlank()) {
            return null;
        }
        return redisTemplate.opsForValue().get(legacyRedisKey);
    }

    private String readCurrentPayload(String redisKey) {
        if (redisKey == null || redisKey.isBlank()) {
            return null;
        }
        String payload = redisTemplate.opsForValue().get(redisKey);
        if (payload == null || payload.isBlank()) {
            return null;
        }
        return payload;
    }

    private ReadOutcome<T> readLocal(String redisKey, Duration freshnessTtl) {
        Optional<String> cachedPayload = localCache.get(redisKey);
        if (cachedPayload.isEmpty()) {
            return ReadOutcome.absent();
        }
        try {
            Optional<String> decodedPayload = payloadCodec.deserialize(cachedPayload.get());
            if (decodedPayload.isPresent()) {
                T value = deserializer.apply(decodedPayload.get());
                if (value != null) {
                    metricsRecorder.hit();
                    metricsRecorder.l1Hit();
                    return ReadOutcome.value(Optional.of(value), isStale(cachedPayload.get(), freshnessTtl));
                }
            }
        } catch (RuntimeException ignored) {
            // L1 is best effort; invalid local entries should not block falling back to Redis.
        }
        localCache.evict(redisKey);
        return ReadOutcome.absent();
    }

    private boolean isStale(String payload, Duration freshnessTtl) {
        if (payload == null || payload.isBlank() || freshnessTtl == null || freshnessTtl.isNegative() || freshnessTtl.isZero()) {
            return false;
        }
        return payloadCodec.extractCachedAtEpochMillis(payload)
                .stream()
                .anyMatch(cachedAt -> Instant.ofEpochMilli(cachedAt)
                        .plus(freshnessTtl)
                        .isBefore(Instant.now()));
    }

    private Set<String> readMembers(String indexKey) {
        if (indexKey == null || indexKey.isBlank()) {
            return Set.of();
        }
        SetOperations<String, String> setOperations = redisTemplate.opsForSet();
        Set<String> keys = setOperations.members(indexKey);
        return keys == null ? Set.of() : keys;
    }

    private void deleteIfPresent(String key) {
        if (key != null && !key.isBlank()) {
            redisTemplate.delete(key);
        }
    }

    private void trackIndexedLocalKey(String indexKey, String redisKey) {
        if (!localCache.isEnabled() || indexKey == null || indexKey.isBlank() || redisKey == null || redisKey.isBlank()) {
            return;
        }
        localIndexKeys.computeIfAbsent(indexKey, ignored -> Collections.newSetFromMap(new ConcurrentHashMap<>()))
                .add(redisKey);
    }

    private Set<String> drainTrackedLocalKeys(String indexKey) {
        if (indexKey == null || indexKey.isBlank()) {
            return Set.of();
        }
        Set<String> trackedKeys = localIndexKeys.remove(indexKey);
        return trackedKeys == null ? Set.of() : Set.copyOf(trackedKeys);
    }

    private record ReadOutcome<T>(boolean handled, Optional<T> value, boolean stale) {

        private static <T> ReadOutcome<T> absent() {
            return new ReadOutcome<>(false, Optional.empty(), false);
        }

        private static <T> ReadOutcome<T> value(Optional<T> value, boolean stale) {
            return new ReadOutcome<>(true, value, stale);
        }

        private PlatformCacheReadResult<T> asResult() {
            return handled ? PlatformCacheReadResult.hit(value, stale) : PlatformCacheReadResult.miss();
        }
    }
}
