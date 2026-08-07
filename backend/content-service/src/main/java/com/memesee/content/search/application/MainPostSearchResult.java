package com.memesee.content.search.application;

import java.util.List;

public record MainPostSearchResult(
        List<Long> mainPostIds,
        long totalHits
) {
}
