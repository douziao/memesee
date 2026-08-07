package com.memesee.content.feed.dto;

import java.util.List;

public record FeedPageResponse<T>(
        List<T> posts,
        String nextCursor,
        boolean hasMore
) {
}
