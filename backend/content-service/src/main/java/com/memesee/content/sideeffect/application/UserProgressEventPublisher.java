package com.memesee.content.sideeffect.application;

import java.time.Instant;

public interface UserProgressEventPublisher {

    void onMainPostCreated(Long mainPostId, String authorUsername, String communitySlug, Instant occurredAt);

    void onMainPostDeleted(Long mainPostId, String authorUsername, String communitySlug, Instant occurredAt);
}
