package com.memesee.content.mainpost.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;
import java.util.Objects;

@Converter
public class MainPostTagsJsonConverter implements AttributeConverter<List<String>, String> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        try {
            List<String> safeAttribute = attribute == null ? List.of() : List.copyOf(attribute);
            return OBJECT_MAPPER.writeValueAsString(safeAttribute);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Failed to serialize main post tags.", ex);
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return List.of();
        }
        try {
            List<String> parsed = OBJECT_MAPPER.readValue(dbData, STRING_LIST_TYPE);
            if (parsed == null || parsed.isEmpty()) {
                return List.of();
            }
            return parsed.stream()
                    .filter(Objects::nonNull)
                    .toList();
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Failed to deserialize main post tags.", ex);
        }
    }
}
