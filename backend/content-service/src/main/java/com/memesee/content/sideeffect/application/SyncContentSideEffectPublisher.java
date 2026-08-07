package com.memesee.content.sideeffect.application;

import com.memesee.content.common.application.ContentCacheInvalidationCoordinator;
import com.memesee.content.community.domain.Community;
import com.memesee.content.feed.application.MainPostFeedProjectionUpdater;
import com.memesee.content.interaction.application.InteractionReferenceInvalidator;
import com.memesee.content.mainpost.application.MainPostApplicationSupport;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.notification.application.NotificationReferenceInvalidator;
import com.memesee.content.notification.application.NotificationRequestPublisher;
import com.memesee.content.subpost.domain.SubPost;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class SyncContentSideEffectPublisher implements ContentSideEffectPublisher {

    private final MainPostApplicationSupport mainPostApplicationSupport;
    private final ContentCacheInvalidationCoordinator cacheInvalidationCoordinator;
    private final NotificationRequestPublisher notificationRequestPublisher;
    private final NotificationReferenceInvalidator notificationReferenceInvalidator;
    private final InteractionReferenceInvalidator interactionReferenceInvalidator;
    private final UserProgressEventPublisher userProgressEventPublisher;
    private final MainPostFeedProjectionUpdater mainPostFeedProjectionUpdater;

    public SyncContentSideEffectPublisher(
            MainPostApplicationSupport mainPostApplicationSupport,
            ContentCacheInvalidationCoordinator cacheInvalidationCoordinator,
            NotificationRequestPublisher notificationRequestPublisher,
            NotificationReferenceInvalidator notificationReferenceInvalidator,
            InteractionReferenceInvalidator interactionReferenceInvalidator,
            UserProgressEventPublisher userProgressEventPublisher,
            MainPostFeedProjectionUpdater mainPostFeedProjectionUpdater
    ) {
        this.mainPostApplicationSupport = mainPostApplicationSupport;
        this.cacheInvalidationCoordinator = cacheInvalidationCoordinator;
        this.notificationRequestPublisher = notificationRequestPublisher;
        this.notificationReferenceInvalidator = notificationReferenceInvalidator;
        this.interactionReferenceInvalidator = interactionReferenceInvalidator;
        this.userProgressEventPublisher = userProgressEventPublisher;
        this.mainPostFeedProjectionUpdater = mainPostFeedProjectionUpdater;
    }

    @Override
    public void onMainPostCreated(MainPost mainPost) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        Community community = mainPostApplicationSupport.requireCommunityById(requiredMainPost.getCommunityId());
        onMainPostChanged(requiredMainPost);
        userProgressEventPublisher.onMainPostCreated(
                requiredMainPost.getId(),
                requiredMainPost.getAuthorUsername(),
                community.getSlug(),
                requiredMainPost.getCreatedAt()
        );
    }

    @Override
    public void onMainPostChanged(MainPost mainPost) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        mainPostFeedProjectionUpdater.refreshMainPost(requiredMainPost.getId());
        cacheInvalidationCoordinator.onMainPostChanged();
        mainPostApplicationSupport.requestSearchSync(requiredMainPost);
    }

    @Override
    public void onMainPostDeleted(MainPost mainPost) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        Community community = mainPostApplicationSupport.requireCommunityById(requiredMainPost.getCommunityId());
        mainPostFeedProjectionUpdater.refreshMainPost(requiredMainPost.getId());
        cacheInvalidationCoordinator.onMainPostChanged();
        notificationReferenceInvalidator.invalidateNotificationsReferencingMainPost(requiredMainPost.getId());
        interactionReferenceInvalidator.invalidateInteractionListsReferencingMainPost(requiredMainPost.getId());
        mainPostApplicationSupport.requestSearchDelete(requiredMainPost.getId());
        userProgressEventPublisher.onMainPostDeleted(
                requiredMainPost.getId(),
                requiredMainPost.getAuthorUsername(),
                community.getSlug(),
                requiredMainPost.getDeletedAt() == null ? Instant.now() : requiredMainPost.getDeletedAt()
        );
    }

    @Override
    public void onMainPostViewed(MainPost mainPost) {
        onMainPostChanged(mainPost);
    }

    @Override
    public void onMainPostLiked(MainPost mainPost, String actorUsername) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        String requiredActorUsername = requireActorUsername(actorUsername);
        publishMainPostInteractionChanged(requiredMainPost, requiredActorUsername);
        notificationRequestPublisher.notifyMainPostLiked(
                requiredMainPost.getAuthorUsername(),
                requiredActorUsername,
                requiredMainPost.getId(),
                requiredMainPost.getTitle()
        );
    }

    @Override
    public void onMainPostUnliked(MainPost mainPost, String actorUsername) {
        publishMainPostInteractionChanged(requireMainPost(mainPost), requireActorUsername(actorUsername));
    }

    @Override
    public void onMainPostFavorited(MainPost mainPost, String actorUsername) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        String requiredActorUsername = requireActorUsername(actorUsername);
        publishMainPostInteractionChanged(requiredMainPost, requiredActorUsername);
        notificationRequestPublisher.notifyMainPostFavorited(
                requiredMainPost.getAuthorUsername(),
                requiredActorUsername,
                requiredMainPost.getId(),
                requiredMainPost.getTitle()
        );
    }

    @Override
    public void onMainPostUnfavorited(MainPost mainPost, String actorUsername) {
        publishMainPostInteractionChanged(requireMainPost(mainPost), requireActorUsername(actorUsername));
    }

    @Override
    public void onSubPostCreated(
            MainPost mainPost,
            SubPost subPost,
            String actorUsername,
            String parentSubPostAuthorUsername
    ) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        SubPost requiredSubPost = requireSubPost(subPost);
        String requiredActorUsername = requireActorUsername(actorUsername);
        String subPostPreview = buildSubPostNotificationPreview(requiredSubPost);
        publishSubPostChanged(requiredMainPost);
        notificationRequestPublisher.notifySubPostCreated(
                requiredMainPost.getAuthorUsername(),
                requiredActorUsername,
                requiredMainPost.getId(),
                requiredMainPost.getTitle(),
                requiredSubPost.getId(),
                subPostPreview
        );

        String normalizedParentSubPostAuthor = normalizeOptionalUsername(parentSubPostAuthorUsername);
        if (normalizedParentSubPostAuthor != null
                && !normalizedParentSubPostAuthor.equals(requiredMainPost.getAuthorUsername())) {
            notificationRequestPublisher.notifySubPostReplied(
                    normalizedParentSubPostAuthor,
                    requiredActorUsername,
                    requiredMainPost.getId(),
                    requiredMainPost.getTitle(),
                    requiredSubPost.getId(),
                    subPostPreview
            );
        }
    }

    @Override
    public void onSubPostChanged(MainPost mainPost) {
        publishSubPostChanged(requireMainPost(mainPost));
    }

    @Override
    public void onSubPostDeleted(MainPost mainPost, SubPost subPost) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        SubPost requiredSubPost = requireSubPost(subPost);
        publishSubPostChanged(requiredMainPost);
        notificationReferenceInvalidator.invalidateNotificationsReferencingSubPost(requiredSubPost.getId());
        interactionReferenceInvalidator.invalidateInteractionListsReferencingSubPost(requiredSubPost.getId());
    }

    @Override
    public void onSubPostLiked(MainPost mainPost, SubPost subPost, String actorUsername) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        SubPost requiredSubPost = requireSubPost(subPost);
        String requiredActorUsername = requireActorUsername(actorUsername);
        publishSubPostInteractionChanged(requiredSubPost, requiredActorUsername);
        notificationRequestPublisher.notifySubPostLiked(
                requiredSubPost.getAuthorUsername(),
                requiredActorUsername,
                requiredMainPost.getId(),
                requiredMainPost.getTitle(),
                requiredSubPost.getId(),
                buildSubPostNotificationPreview(requiredSubPost)
        );
    }

    @Override
    public void onSubPostUnliked(SubPost subPost, String actorUsername) {
        publishSubPostInteractionChanged(requireSubPost(subPost), requireActorUsername(actorUsername));
    }

    @Override
    public void onSubPostFavorited(MainPost mainPost, SubPost subPost, String actorUsername) {
        MainPost requiredMainPost = requireMainPost(mainPost);
        SubPost requiredSubPost = requireSubPost(subPost);
        String requiredActorUsername = requireActorUsername(actorUsername);
        publishSubPostInteractionChanged(requiredSubPost, requiredActorUsername);
        notificationRequestPublisher.notifySubPostFavorited(
                requiredSubPost.getAuthorUsername(),
                requiredActorUsername,
                requiredMainPost.getId(),
                requiredMainPost.getTitle(),
                requiredSubPost.getId(),
                buildSubPostNotificationPreview(requiredSubPost)
        );
    }

    @Override
    public void onSubPostUnfavorited(SubPost subPost, String actorUsername) {
        publishSubPostInteractionChanged(requireSubPost(subPost), requireActorUsername(actorUsername));
    }

    private void publishMainPostInteractionChanged(MainPost mainPost, String actorUsername) {
        mainPostFeedProjectionUpdater.refreshMainPost(mainPost.getId());
        cacheInvalidationCoordinator.onMainPostInteractionChanged(actorUsername);
        mainPostApplicationSupport.requestSearchSync(mainPost);
    }

    private void publishSubPostChanged(MainPost mainPost) {
        mainPostFeedProjectionUpdater.refreshMainPost(mainPost.getId());
        cacheInvalidationCoordinator.onSubPostChanged(mainPost.getId());
        mainPostApplicationSupport.requestSearchSync(mainPost);
    }

    private void publishSubPostInteractionChanged(SubPost subPost, String actorUsername) {
        cacheInvalidationCoordinator.onSubPostInteractionChanged(subPost.getMainPostId(), actorUsername);
    }

    private String buildSubPostNotificationPreview(SubPost subPost) {
        String content = subPost.getContent() == null ? "" : subPost.getContent().trim();
        return content.isBlank() ? "\u56fe\u7247\u5b50\u5e16" : content;
    }

    private MainPost requireMainPost(MainPost mainPost) {
        if (mainPost == null) {
            throw new IllegalArgumentException("mainPost must not be null.");
        }
        return mainPost;
    }

    private SubPost requireSubPost(SubPost subPost) {
        if (subPost == null) {
            throw new IllegalArgumentException("subPost must not be null.");
        }
        return subPost;
    }

    private String requireActorUsername(String actorUsername) {
        String normalizedActorUsername = normalizeOptionalUsername(actorUsername);
        if (normalizedActorUsername == null) {
            throw new IllegalArgumentException("actorUsername must not be blank.");
        }
        return normalizedActorUsername;
    }

    private String normalizeOptionalUsername(String username) {
        if (username == null || username.isBlank()) {
            return null;
        }
        return username.trim();
    }
}
