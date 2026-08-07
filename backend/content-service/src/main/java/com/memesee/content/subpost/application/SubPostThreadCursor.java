package com.memesee.content.subpost.application;

import java.time.Instant;

public record SubPostThreadCursor(
        Long subPostId,
        Instant createdAt
) {
}
