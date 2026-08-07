package com.memesee.content.interaction.application;

import java.util.List;
import java.util.Map;
import java.util.Set;

public interface SubPostInteractionCollaborationApplicationService {

    Map<Long, Long> loadSubPostFavoriteCounts(List<Long> subPostIds);

    SubPostViewerInteractionState loadSubPostViewerInteractionState(List<Long> subPostIds, String username);

    record SubPostViewerInteractionState(Set<Long> likedIds, Set<Long> favoritedIds) {

        public static SubPostViewerInteractionState empty() {
            return new SubPostViewerInteractionState(Set.of(), Set.of());
        }

        public boolean isLiked(Long subPostId) {
            return likedIds.contains(subPostId);
        }

        public boolean isFavorited(Long subPostId) {
            return favoritedIds.contains(subPostId);
        }
    }
}
