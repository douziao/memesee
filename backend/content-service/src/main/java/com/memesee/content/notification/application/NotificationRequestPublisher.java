package com.memesee.content.notification.application;

public interface NotificationRequestPublisher {

    void notifyMainPostLiked(String recipientUsername, String actorUsername, Long mainPostId, String mainPostTitle);

    void notifyMainPostFavorited(String recipientUsername, String actorUsername, Long mainPostId, String mainPostTitle);

    void notifySubPostCreated(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    );

    void notifySubPostReplied(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    );

    void notifySubPostLiked(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    );

    void notifySubPostFavorited(
            String recipientUsername,
            String actorUsername,
            Long mainPostId,
            String mainPostTitle,
            Long subPostId,
            String subPostPreview
    );
}
