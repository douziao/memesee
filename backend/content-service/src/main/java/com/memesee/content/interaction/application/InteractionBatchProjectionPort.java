package com.memesee.content.interaction.application;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

public interface InteractionBatchProjectionPort {

    ViewerInteractionProjection loadMainPostViewerInteractionState(Collection<Long> mainPostIds, String username);

    Map<Long, Long> loadSubPostFavoriteCounts(Collection<Long> subPostIds);

    ViewerInteractionProjection loadSubPostViewerInteractionState(Collection<Long> subPostIds, String username);

    record ViewerInteractionProjection(Set<Long> likedIds, Set<Long> favoritedIds) {

        public static ViewerInteractionProjection empty() {
            return new ViewerInteractionProjection(Set.of(), Set.of());
        }
    }
}
