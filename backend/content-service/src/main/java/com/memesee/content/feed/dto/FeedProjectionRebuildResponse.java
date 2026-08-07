package com.memesee.content.feed.dto;

public record FeedProjectionRebuildResponse(
        long deletedItems,
        long rebuiltItems
) {
}
