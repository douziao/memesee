package com.memesee.content.subpost.application;

import java.time.Instant;
import java.util.List;

public interface SubPostThreadProjectionPort {

    List<SubPostThreadProjection> loadThreadPage(
            Long mainPostId,
            Instant cursorCreatedAt,
            Long cursorSubPostId,
            int limit
    );

    record SubPostThreadProjection(
            Long id,
            Long mainPostId,
            Long parentSubPostId,
            String parentSubPostAuthorUsername,
            String authorUsername,
            String content,
            long likeCount,
            long childSubPostCount,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
