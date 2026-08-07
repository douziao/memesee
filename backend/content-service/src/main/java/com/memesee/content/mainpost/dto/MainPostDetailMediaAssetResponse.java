package com.memesee.content.mainpost.dto;

import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.media.dto.MediaAssetVariantResponse;
import java.util.List;

public record MainPostDetailMediaAssetResponse(
        Long id,
        String publicId,
        String kind,
        String url,
        String thumbUrl,
        String smallUrl,
        String mediumUrl,
        String displayUrl,
        String originalUrl,
        int width,
        int height,
        String processingStatus,
        String blurDataUrl,
        List<MainPostDetailMediaVariantResponse> variants
) {
    public static MainPostDetailMediaAssetResponse from(MediaAssetResponse asset) {
        if (asset == null) {
            return null;
        }
        return new MainPostDetailMediaAssetResponse(
                asset.id(),
                asset.publicId(),
                asset.kind(),
                asset.url(),
                asset.thumbUrl(),
                asset.smallUrl(),
                asset.mediumUrl(),
                asset.displayUrl(),
                asset.originalUrl(),
                asset.width(),
                asset.height(),
                asset.processingStatus(),
                asset.blurDataUrl(),
                mapVariants(asset.variants())
        );
    }

    private static List<MainPostDetailMediaVariantResponse> mapVariants(
            List<MediaAssetVariantResponse> variants
    ) {
        if (variants == null || variants.isEmpty()) {
            return List.of();
        }
        return variants.stream()
                .filter(variant -> variant != null)
                .map(MainPostDetailMediaVariantResponse::from)
                .toList();
    }
}
