package com.memesee.user.dto;

import jakarta.validation.constraints.NotBlank;

public record ActivityReportRequest(
        @NotBlank String type,
        String communitySlug,
        Long mainPostId,
        Long seconds,
        String targetUsername
) {
}

