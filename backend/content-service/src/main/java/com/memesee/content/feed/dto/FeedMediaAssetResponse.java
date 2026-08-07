package com.memesee.content.feed.dto;

import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.media.dto.MediaAssetVariantResponse;
import java.util.List;

public record FeedMediaAssetResponse(
        Long id,
        String publicId,
        String kind,
        String url,
        String thumbUrl,
        int thumbWidth,
        int thumbHeight,
        String smallUrl,
        int smallWidth,
        int smallHeight,
        int width,
        int height,
        String processingStatus,
        String blurDataUrl
) {
    public static FeedMediaAssetResponse from(MediaAssetResponse asset) {
        if (asset == null) {
            return null;
        }
        MediaAssetVariantResponse thumb = findVariant(asset.variants(), "THUMB");
        MediaAssetVariantResponse small = findVariant(asset.variants(), "SMALL");
        String thumbUrl = firstNonBlank(asset.thumbUrl(), asset.smallUrl(), asset.url());
        String smallUrl = firstNonBlank(asset.smallUrl(), thumbUrl);
        return new FeedMediaAssetResponse(
                asset.id(),
                asset.publicId(),
                asset.kind(),
                thumbUrl,
                thumbUrl,
                variantWidth(thumb),
                variantHeight(thumb),
                smallUrl,
                variantWidth(small),
                variantHeight(small),
                asset.width(),
                asset.height(),
                asset.processingStatus(),
                asset.blurDataUrl()
        );
    }

    private static MediaAssetVariantResponse findVariant(List<MediaAssetVariantResponse> variants, String kind) {
        if (variants == null || kind == null) {
            return null;
        }
        return variants.stream()
                .filter(variant -> variant != null && kind.equalsIgnoreCase(variant.kind()))
                .findFirst()
                .orElse(null);
    }

    private static int variantWidth(MediaAssetVariantResponse variant) {
        return variant == null ? 0 : variant.width();
    }

    private static int variantHeight(MediaAssetVariantResponse variant) {
        return variant == null ? 0 : variant.height();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
