package com.memesee.content.feed.application;

import java.math.BigDecimal;
import java.time.Instant;

public record MainPostFeedCursor(
        String sortMode,
        Long mainPostId,
        Instant latestActivityAt,
        Instant createdAt,
        BigDecimal heatScore,
        Long viewCount,
        Integer searchOffset
) {
}
