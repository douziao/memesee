package com.memesee.platform.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.OptionalLong;

public class VersionedJsonCachePayloadCodec {

    static final String ENVELOPE_SCHEMA = "memesee:json-cache-envelope";

    private final ObjectMapper objectMapper;
    private final String serializationVersion;

    public VersionedJsonCachePayloadCodec(ObjectMapper objectMapper, String serializationVersion) {
        this.objectMapper = objectMapper;
        this.serializationVersion = normalizeVersion(serializationVersion);
    }

    public String serialize(Object value) throws JsonProcessingException {
        return objectMapper.writeValueAsString(new CachePayloadEnvelope(
                ENVELOPE_SCHEMA,
                serializationVersion,
                System.currentTimeMillis(),
                value
        ));
    }

    public <T> Optional<T> deserialize(String payload, Class<T> targetType) throws JsonProcessingException {
        if (payload == null || payload.isBlank()) {
            return Optional.empty();
        }
        JsonNode root = objectMapper.readTree(payload);
        if (!isEnvelope(root)) {
            return Optional.ofNullable(objectMapper.readValue(payload, targetType));
        }
        if (!serializationVersion.equals(root.path("version").asText())) {
            return Optional.empty();
        }
        JsonNode dataNode = root.get("data");
        if (dataNode == null || dataNode.isNull()) {
            return Optional.empty();
        }
        return Optional.ofNullable(objectMapper.treeToValue(dataNode, targetType));
    }

    public <T> Optional<T> deserialize(String payload, TypeReference<T> targetType) throws JsonProcessingException {
        if (payload == null || payload.isBlank()) {
            return Optional.empty();
        }
        JsonNode root = objectMapper.readTree(payload);
        if (!isEnvelope(root)) {
            return Optional.ofNullable(objectMapper.readValue(payload, targetType));
        }
        if (!serializationVersion.equals(root.path("version").asText())) {
            return Optional.empty();
        }
        JsonNode dataNode = root.get("data");
        if (dataNode == null || dataNode.isNull()) {
            return Optional.empty();
        }
        return Optional.ofNullable(objectMapper.convertValue(dataNode, targetType));
    }

    public boolean isExplicitNull(String payload) throws JsonProcessingException {
        if (payload == null || payload.isBlank()) {
            return false;
        }
        JsonNode root = objectMapper.readTree(payload);
        if (!isEnvelope(root)) {
            return false;
        }
        if (!serializationVersion.equals(root.path("version").asText())) {
            return false;
        }
        JsonNode dataNode = root.get("data");
        return dataNode == null || dataNode.isNull();
    }

    public OptionalLong extractCachedAtEpochMillis(String payload) throws JsonProcessingException {
        if (payload == null || payload.isBlank()) {
            return OptionalLong.empty();
        }
        JsonNode root = objectMapper.readTree(payload);
        if (!isEnvelope(root)) {
            return OptionalLong.empty();
        }
        if (!serializationVersion.equals(root.path("version").asText())) {
            return OptionalLong.empty();
        }
        JsonNode cachedAtNode = root.get("cachedAtEpochMillis");
        if (cachedAtNode == null || !cachedAtNode.canConvertToLong()) {
            return OptionalLong.empty();
        }
        return OptionalLong.of(cachedAtNode.longValue());
    }

    private boolean isEnvelope(JsonNode root) {
        return root != null
                && root.isObject()
                && ENVELOPE_SCHEMA.equals(root.path("schema").asText(null))
                && root.has("data");
    }

    private String normalizeVersion(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return "v1";
        }
        return candidate;
    }

    private record CachePayloadEnvelope(
            String schema,
            String version,
            long cachedAtEpochMillis,
            Object data
    ) {
    }
}
