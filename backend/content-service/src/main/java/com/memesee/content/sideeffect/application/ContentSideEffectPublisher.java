package com.memesee.content.sideeffect.application;

import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.subpost.domain.SubPost;

public interface ContentSideEffectPublisher {

    void onMainPostCreated(MainPost mainPost);

    void onMainPostChanged(MainPost mainPost);

    void onMainPostDeleted(MainPost mainPost);

    void onMainPostViewed(MainPost mainPost);

    void onMainPostLiked(MainPost mainPost, String actorUsername);

    void onMainPostUnliked(MainPost mainPost, String actorUsername);

    void onMainPostFavorited(MainPost mainPost, String actorUsername);

    void onMainPostUnfavorited(MainPost mainPost, String actorUsername);

    void onSubPostCreated(
            MainPost mainPost,
            SubPost subPost,
            String actorUsername,
            String parentSubPostAuthorUsername
    );

    void onSubPostChanged(MainPost mainPost);

    void onSubPostDeleted(MainPost mainPost, SubPost subPost);

    void onSubPostLiked(MainPost mainPost, SubPost subPost, String actorUsername);

    void onSubPostUnliked(SubPost subPost, String actorUsername);

    void onSubPostFavorited(MainPost mainPost, SubPost subPost, String actorUsername);

    void onSubPostUnfavorited(SubPost subPost, String actorUsername);
}
