package com.memesee.content.interaction.dto;

public record FavoriteStatusResponse(
        Long targetId,
        long favoriteCount,
        boolean favorited
) {
}
