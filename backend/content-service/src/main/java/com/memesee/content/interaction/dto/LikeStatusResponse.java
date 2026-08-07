package com.memesee.content.interaction.dto;

public record LikeStatusResponse(
        Long targetId,
        long likeCount,
        boolean liked
) {
}
