package com.memesee.platform.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.OptionalLong;

public class VersionedStringCachePayloadCodec {

    static final String ENVELOPE_SCHEMA = "memesee:string-cache-envelope";

    private final ObjectMapper objectMapper;
    private final String serializationVersion;

    public VersionedStringCachePayloadCodec(ObjectMapper objectMapper, String serializationVersion) {
        this.objectMapper = objectMapper;
        this.serializationVersion = normalizeVersion(serializationVersion);
    }

    public String serialize(String value) {
        try {
            return objectMapper.writeValueAsString(new CachePayloadEnvelope(
                    ENVELOPE_SCHEMA,
                    serializationVersion,
                    System.currentTimeMillis(),
                    value
            ));
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("failed to serialize string cache payload", error);
        }
    }

    public Optional<String> deserialize(String payload) {
        if (payload == null || payload.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(payload);
            if (!isEnvelope(root)) {
                return decodeLegacyPayload(root, payload);
            }
            if (!serializationVersion.equals(root.path("version").asText())) {
                return Optional.empty();
            }
            JsonNode dataNode = root.get("data");
            if (dataNode == null || dataNode.isNull()) {
                return Optional.empty();
            }
            if (dataNode.isTextual()) {
                return Optional.ofNullable(dataNode.textValue());
            }
            return Optional.of(dataNode.toString());
        } catch (JsonProcessingException error) {
            return Optional.of(payload);
        }
    }

    public OptionalLong extractCachedAtEpochMillis(String payload) {
        if (payload == null || payload.isBlank()) {
            return OptionalLong.empty();
        }
        try {
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
        } catch (JsonProcessingException error) {
            return OptionalLong.empty();
        }
    }

    private boolean isEnvelope(JsonNode root) {
        return root != null
                && root.isObject()
                && ENVELOPE_SCHEMA.equals(root.path("schema").asText(null))
                && root.has("data");
    }

    private Optional<String> decodeLegacyPayload(JsonNode root, String fallbackRawPayload) {
        if (root == null || root.isMissingNode() || root.isNull()) {
            return Optional.empty();
        }
        if (root.isTextual()) {
            return Optional.ofNullable(root.textValue());
        }
        if (root.isNumber() || root.isBoolean()) {
            return Optional.of(root.asText());
        }
        return Optional.of(fallbackRawPayload);
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
            String data
    ) {
    }
}
