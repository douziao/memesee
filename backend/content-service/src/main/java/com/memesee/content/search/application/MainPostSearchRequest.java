package com.memesee.content.search.application;

public record MainPostSearchRequest(
        String keyword,
        String communitySlug,
        String sortMode,
        int offset,
        int limit
) {
}
