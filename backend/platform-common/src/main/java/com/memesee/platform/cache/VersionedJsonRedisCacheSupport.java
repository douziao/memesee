package com.memesee.platform.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

public class VersionedJsonRedisCacheSupport {

    private static final Logger log = LoggerFactory.getLogger(VersionedJsonRedisCacheSupport.class);

    private final StringRedisTemplate redisTemplate;
    private final VersionedJsonCachePayloadCodec payloadCodec;
    private final CacheMetricsRecorder metricsRecorder;
    private final String cacheName;
    private final PlatformLocalCache localCache;
    private final Map<String, Set<String>> localIndexKeys = new ConcurrentHashMap<>();

    public VersionedJsonRedisCacheSupport(
            StringRedisTemplate redisTemplate,
            VersionedJsonCachePayloadCodec payloadCodec,
            CacheMetricsRecorder metricsRecorder,
            String cacheName
    ) {
        this(redisTemplate, payloadCodec, metricsRecorder, cacheName, PlatformLocalCache.disabled());
    }

    public VersionedJsonRedisCacheSupport(
            StringRedisTemplate redisTemplate,
            VersionedJsonCachePayloadCodec payloadCodec,
            CacheMetricsRecorder metricsRecorder,
            String cacheName,
            PlatformLocalCache localCache
    ) {
        this.redisTemplate = redisTemplate;
        this.payloadCodec = payloadCodec;
        this.metricsRecorder = metricsRecorder;
        this.cacheName = cacheName;
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

    public <T> Optional<T> read(String redisKey, String legacyRedisKey, Class<T> targetType) {
        return readSnapshot(redisKey, legacyRedisKey, targetType, null).value();
    }

    public <T> Optional<T> read(String redisKey, String legacyRedisKey, TypeReference<T> targetType) {
        return readSnapshot(redisKey, legacyRedisKey, targetType, null).value();
    }

    public <T> PlatformCacheReadResult<T> readSnapshot(
            String redisKey,
            String legacyRedisKey,
            Class<T> targetType,
            Duration freshnessTtl
    ) {
        return readSnapshotInternal(redisKey, legacyRedisKey, freshnessTtl,
                payload -> payloadCodec.deserialize(payload, targetType));
    }

    public <T> PlatformCacheReadResult<T> readSnapshot(
            String redisKey,
            String legacyRedisKey,
            TypeReference<T> targetType,
            Duration freshnessTtl
    ) {
        return readSnapshotInternal(redisKey, legacyRedisKey, freshnessTtl,
                payload -> payloadCodec.deserialize(payload, targetType));
    }

    public void write(String redisKey, Object value, Duration ttl) {
        try {
            String payload = payloadCodec.serialize(value);
            redisTemplate.opsForValue().set(redisKey, payload, ttl);
            localCache.put(redisKey, payload);
            metricsRecorder.write();
        } catch (RuntimeException | JsonProcessingException error) {
            metricsRecorder.error();
            log.warn("Failed to write cache {} key {}", cacheName, redisKey, error);
        }
    }

    public void writeNull(String redisKey, Duration ttl) {
        write(redisKey, null, ttl);
    }

    public void writeIndexed(String redisKey, String indexKey, Object value, Duration ttl) {
        try {
            String payload = payloadCodec.serialize(value);
            redisTemplate.opsForValue().set(redisKey, payload, ttl);
            redisTemplate.opsForSet().add(indexKey, redisKey);
            redisTemplate.expire(indexKey, ttl);
            localCache.put(redisKey, payload);
            trackIndexedLocalKey(indexKey, redisKey);
            metricsRecorder.write();
        } catch (RuntimeException | JsonProcessingException error) {
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

    private <T> PlatformCacheReadResult<T> readSnapshotInternal(
            String redisKey,
            String legacyRedisKey,
            Duration freshnessTtl,
            ThrowingDeserializer<T> deserializer
    ) {
        ReadOutcome<T> localValue = readLocal(redisKey, deserializer, freshnessTtl);
        if (localValue.handled()) {
            return localValue.asResult();
        }
        try {
            String payload = readPayload(redisKey, legacyRedisKey);
            if (payloadCodec.isExplicitNull(payload)) {
                localCache.put(redisKey, payload);
                metricsRecorder.hit();
                metricsRecorder.l2Hit();
                return PlatformCacheReadResult.hit(Optional.empty(), isStale(payload, freshnessTtl));
            }
            Optional<T> value = deserializer.deserialize(payload);
            if (value.isEmpty()) {
                metricsRecorder.miss();
                return PlatformCacheReadResult.miss();
            }
            localCache.put(redisKey, payload);
            metricsRecorder.hit();
            metricsRecorder.l2Hit();
            return PlatformCacheReadResult.hit(value, isStale(payload, freshnessTtl));
        } catch (RuntimeException | JsonProcessingException error) {
            metricsRecorder.error();
            metricsRecorder.fallback();
            log.warn("Failed to read cache {} key {}", cacheName, redisKey, error);
            return PlatformCacheReadResult.miss();
        }
    }

    private <T> ReadOutcome<T> readLocal(
            String redisKey,
            ThrowingDeserializer<T> deserializer,
            Duration freshnessTtl
    ) {
        Optional<String> cachedPayload = localCache.get(redisKey);
        if (cachedPayload.isEmpty()) {
            return ReadOutcome.absent();
        }
        try {
            if (payloadCodec.isExplicitNull(cachedPayload.get())) {
                metricsRecorder.hit();
                metricsRecorder.l1Hit();
                return ReadOutcome.cachedNull(isStale(cachedPayload.get(), freshnessTtl));
            }
            Optional<T> value = deserializer.deserialize(cachedPayload.get());
            if (value.isPresent()) {
                metricsRecorder.hit();
                metricsRecorder.l1Hit();
                return ReadOutcome.value(value, isStale(cachedPayload.get(), freshnessTtl));
            }
        } catch (RuntimeException | JsonProcessingException ignored) {
            // L1 is best effort; invalid local entries should not block falling back to Redis.
        }
        localCache.evict(redisKey);
        return ReadOutcome.absent();
    }

    private boolean isStale(String payload, Duration freshnessTtl) throws JsonProcessingException {
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

    @FunctionalInterface
    private interface ThrowingDeserializer<T> {

        Optional<T> deserialize(String payload) throws JsonProcessingException;
    }

    private record ReadOutcome<T>(boolean handled, Optional<T> value, boolean stale) {

        private static <T> ReadOutcome<T> absent() {
            return new ReadOutcome<>(false, Optional.empty(), false);
        }

        private static <T> ReadOutcome<T> cachedNull(boolean stale) {
            return new ReadOutcome<>(true, Optional.empty(), stale);
        }

        private static <T> ReadOutcome<T> value(Optional<T> value, boolean stale) {
            return new ReadOutcome<>(true, value, stale);
        }

        private PlatformCacheReadResult<T> asResult() {
            return handled ? PlatformCacheReadResult.hit(value, stale) : PlatformCacheReadResult.miss();
        }
    }
}
