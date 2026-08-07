package com.memesee.content.media.dto;

import java.util.List;

public record MediaAssetResponse(
        Long id,
        String publicId,
        String kind,
        String url,
        String thumbUrl,
        String smallUrl,
        String mediumUrl,
        String displayUrl,
        String originalUrl,
        String contentType,
        String originalFilename,
        long sizeBytes,
        int width,
        int height,
        String processingStatus,
        String blurDataUrl,
        List<MediaAssetVariantResponse> variants
) {
}
