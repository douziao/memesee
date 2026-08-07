package com.memesee.content.interaction.application;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class InteractionCollaborationApplicationService
        implements MainPostInteractionCollaborationApplicationService, SubPostInteractionCollaborationApplicationService {

    private final InteractionBatchProjectionPort interactionBatchProjectionPort;

    public InteractionCollaborationApplicationService(InteractionBatchProjectionPort interactionBatchProjectionPort) {
        this.interactionBatchProjectionPort = interactionBatchProjectionPort;
    }

    @Override
    public MainPostViewerInteractionState loadMainPostViewerInteractionState(List<Long> mainPostIds, String username) {
        if (mainPostIds == null || mainPostIds.isEmpty() || username == null || username.isBlank()) {
            return MainPostViewerInteractionState.empty();
        }
        InteractionBatchProjectionPort.ViewerInteractionProjection viewerInteractionProjection =
                interactionBatchProjectionPort.loadMainPostViewerInteractionState(mainPostIds, username);
        return new MainPostViewerInteractionState(
                viewerInteractionProjection.likedIds(),
                viewerInteractionProjection.favoritedIds()
        );
    }

    @Override
    public Map<Long, Long> loadSubPostFavoriteCounts(List<Long> subPostIds) {
        Map<Long, Long> favoriteCounts = new LinkedHashMap<>();
        if (subPostIds == null || subPostIds.isEmpty()) {
            return favoriteCounts;
        }
        favoriteCounts.putAll(interactionBatchProjectionPort.loadSubPostFavoriteCounts(subPostIds));
        return favoriteCounts;
    }

    @Override
    public SubPostViewerInteractionState loadSubPostViewerInteractionState(List<Long> subPostIds, String username) {
        if (subPostIds == null || subPostIds.isEmpty() || username == null || username.isBlank()) {
            return SubPostViewerInteractionState.empty();
        }
        InteractionBatchProjectionPort.ViewerInteractionProjection viewerInteractionProjection =
                interactionBatchProjectionPort.loadSubPostViewerInteractionState(subPostIds, username);
        return new SubPostViewerInteractionState(
                viewerInteractionProjection.likedIds(),
                viewerInteractionProjection.favoritedIds()
        );
    }
}
