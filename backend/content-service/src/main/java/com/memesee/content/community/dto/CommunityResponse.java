package com.memesee.content.community.dto;

public record CommunityResponse(
        Long id,
        String slug,
        String name,
        String description,
        int sortOrder
) {
}
