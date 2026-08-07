package com.memesee.content.media.dto;

public record MediaAssetVariantResponse(
        String kind,
        String url,
        String contentType,
        long sizeBytes,
        int width,
        int height
) {
}
