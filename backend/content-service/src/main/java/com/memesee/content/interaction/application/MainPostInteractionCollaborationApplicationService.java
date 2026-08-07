package com.memesee.content.interaction.application;

import java.util.List;
import java.util.Set;

public interface MainPostInteractionCollaborationApplicationService {

    MainPostViewerInteractionState loadMainPostViewerInteractionState(List<Long> mainPostIds, String username);

    record MainPostViewerInteractionState(Set<Long> likedIds, Set<Long> favoritedIds) {

        public static MainPostViewerInteractionState empty() {
            return new MainPostViewerInteractionState(Set.of(), Set.of());
        }

        public boolean isLiked(Long mainPostId) {
            return likedIds.contains(mainPostId);
        }

        public boolean isFavorited(Long mainPostId) {
            return favoritedIds.contains(mainPostId);
        }
    }
}
