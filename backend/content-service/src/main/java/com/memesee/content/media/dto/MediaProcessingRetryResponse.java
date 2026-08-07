package com.memesee.content.media.dto;

import java.util.List;

public record MediaProcessingRetryResponse(
        List<Long> assetIds,
        int count
) {
}
