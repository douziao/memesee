package com.memesee.content.sideeffect.application;

import java.time.Instant;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "app.user-service.events",
        name = "enabled",
        havingValue = "false"
)
public class NoOpUserProgressEventPublisher implements UserProgressEventPublisher {

    @Override
    public void onMainPostCreated(Long mainPostId, String authorUsername, String communitySlug, Instant occurredAt) {
    }

    @Override
    public void onMainPostDeleted(Long mainPostId, String authorUsername, String communitySlug, Instant occurredAt) {
    }
}
