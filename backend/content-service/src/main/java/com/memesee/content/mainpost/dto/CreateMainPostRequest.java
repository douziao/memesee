package com.memesee.content.mainpost.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateMainPostRequest(
        @NotBlank
        @Pattern(regexp = "^[a-z0-9-]{2,50}$", message = "communitySlug format is invalid.")
        String communitySlug,
        @NotBlank
        @Size(min = 2, max = 30, message = "主帖标题长度为 2-30 个字符。")
        String title,
        @Size(max = 5000)
        String content,
        @Pattern(regexp = "^(long|rich)$", message = "postMode must be long or rich.")
        String postMode,
        @Size(max = 20)
        List<Long> mediaAssetIds,
        List<String> tags
) {
}
