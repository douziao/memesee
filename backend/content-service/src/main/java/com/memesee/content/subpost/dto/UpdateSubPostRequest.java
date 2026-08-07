package com.memesee.content.subpost.dto;

import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateSubPostRequest(
        @Size(max = 2000)
        String content,
        @Size(max = 20)
        List<Long> mediaAssetIds
) {
}
