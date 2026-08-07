package com.memesee.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 50) String username,
        @NotBlank @Size(min = 6, max = 64) String password,
        @NotBlank @Size(min = 4, max = 64) String inviteCode
) {
}

