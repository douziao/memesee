package com.memesee.content.common.application;

import com.memesee.content.interaction.infrastructure.MyInteractionListCache;
import com.memesee.content.feed.infrastructure.MainPostFeedPageCache;
import com.memesee.content.notification.infrastructure.NotificationListCache;
import com.memesee.content.notification.infrastructure.NotificationUnreadCountCache;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class ContentCacheInvalidationCoordinator {

    private final MainPostFeedPageCache mainPostFeedPageCache;
    private final MyInteractionListCache myInteractionListCache;
    private final NotificationListCache notificationListCache;
    private final NotificationUnreadCountCache notificationUnreadCountCache;

    public ContentCacheInvalidationCoordinator(
            MainPostFeedPageCache mainPostFeedPageCache,
            MyInteractionListCache myInteractionListCache,
            NotificationListCache notificationListCache,
            NotificationUnreadCountCache notificationUnreadCountCache
    ) {
        this.mainPostFeedPageCache = mainPostFeedPageCache;
        this.myInteractionListCache = myInteractionListCache;
        this.notificationListCache = notificationListCache;
        this.notificationUnreadCountCache = notificationUnreadCountCache;
    }

    public void onMainPostChanged() {
        runAfterCommit(mainPostFeedPageCache::evictAllFeedPages);
    }

    public void onMainPostViewStatsFlushed() {
        runAfterCommit(mainPostFeedPageCache::evictAllFeedPages);
    }

    public void onSubPostChanged(Long mainPostId) {
        requireMainPostId(mainPostId);
        onMainPostChanged();
    }

    public void onMainPostInteractionChanged(String actorUsername) {
        String requiredActorUsername = requireUsername(actorUsername, "actorUsername");
        runAfterCommit(() -> {
            mainPostFeedPageCache.evictAllFeedPages();
            myInteractionListCache.evictInteractionLists(requiredActorUsername);
        });
    }

    public void onSubPostInteractionChanged(Long mainPostId, String actorUsername) {
        requireMainPostId(mainPostId);
        String requiredActorUsername = requireUsername(actorUsername, "actorUsername");
        runAfterCommit(() -> myInteractionListCache.evictInteractionLists(requiredActorUsername));
    }

    public void onInteractionReferencesUnavailable(Collection<String> usernames) {
        Set<String> requiredUsernames = normalizeUsernames(usernames);
        if (requiredUsernames.isEmpty()) {
            return;
        }
        runAfterCommit(() -> requiredUsernames.forEach(myInteractionListCache::evictInteractionLists));
    }

    public void onNotificationChanged(String recipientUsername) {
        String requiredRecipientUsername = requireUsername(recipientUsername, "recipientUsername");
        runAfterCommit(() -> {
            notificationListCache.evictNotificationLists(requiredRecipientUsername);
            notificationUnreadCountCache.evictUnreadCount(requiredRecipientUsername);
        });
    }

    private void runAfterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }

    private Long requireMainPostId(Long mainPostId) {
        if (mainPostId == null) {
            throw new IllegalArgumentException("mainPostId must not be null.");
        }
        return mainPostId;
    }

    private String requireUsername(String username, String fieldName) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException(fieldName + " must not be blank.");
        }
        return username.trim();
    }

    private Set<String> normalizeUsernames(Collection<String> usernames) {
        if (usernames == null || usernames.isEmpty()) {
            return Set.of();
        }
        Set<String> normalizedUsernames = new LinkedHashSet<>();
        for (String username : usernames) {
            if (username != null && !username.isBlank()) {
                normalizedUsernames.add(username.trim());
            }
        }
        return normalizedUsernames;
    }
}
