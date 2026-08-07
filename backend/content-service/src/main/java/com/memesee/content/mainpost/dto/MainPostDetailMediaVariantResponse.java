package com.memesee.content.mainpost.dto;

import com.memesee.content.media.dto.MediaAssetVariantResponse;

public record MainPostDetailMediaVariantResponse(
        String kind,
        String url,
        int width,
        int height
) {
    public static MainPostDetailMediaVariantResponse from(MediaAssetVariantResponse variant) {
        if (variant == null) {
            return null;
        }
        return new MainPostDetailMediaVariantResponse(
                variant.kind(),
                variant.url(),
                variant.width(),
                variant.height()
        );
    }
}
