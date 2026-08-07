package com.memesee.content.feed.application;

public record FeedProjectionRebuildResult(
        long deletedItems,
        long rebuiltItems
) {
}
