package com.memesee.content.interaction.application;

public interface InteractionTargetCountProjectionPort {

    long loadMainPostLikeCount(Long mainPostId);

    long loadMainPostFavoriteCount(Long mainPostId);

    long loadSubPostLikeCount(Long subPostId);

    long loadSubPostFavoriteCount(Long subPostId);
}
