package com.memesee.content.mainpost.application;

import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.media.application.MainPostMediaCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MainPostQueryApplicationService {

    private final MainPostMediaCollaborationApplicationService mainPostMediaCollaborationApplicationService;
    private final MainPostApplicationSupport mainPostApplicationSupport;
    private final MainPostViewerInteractionResolver mainPostViewerInteractionResolver;
    private final MainPostViewCountBuffer mainPostViewCountBuffer;

    public MainPostQueryApplicationService(
            MainPostMediaCollaborationApplicationService mainPostMediaCollaborationApplicationService,
            MainPostApplicationSupport mainPostApplicationSupport,
            MainPostViewerInteractionResolver mainPostViewerInteractionResolver,
            MainPostViewCountBuffer mainPostViewCountBuffer
    ) {
        this.mainPostMediaCollaborationApplicationService = mainPostMediaCollaborationApplicationService;
        this.mainPostApplicationSupport = mainPostApplicationSupport;
        this.mainPostViewerInteractionResolver = mainPostViewerInteractionResolver;
        this.mainPostViewCountBuffer = mainPostViewCountBuffer;
    }

    @Transactional(readOnly = true)
    public MainPostDetailResponse getMainPost(Long mainPostId, String authorizationHeader) {
        return getMainPost(mainPostId, authorizationHeader, true);
    }

    @Transactional(readOnly = true)
    public MainPostDetailResponse getMainPost(Long mainPostId, String authorizationHeader, boolean trackView) {
        MainPost mainPost = mainPostApplicationSupport.requireActiveMainPost(mainPostId);
        Community community = mainPostApplicationSupport.requireCommunityById(mainPost.getCommunityId());
        if (trackView) {
            mainPostViewCountBuffer.recordView(mainPost.getId());
        }
        List<MediaAssetResponse> mediaAssets =
                mainPostMediaCollaborationApplicationService.resolveMainPostMedia(List.of(mainPost))
                        .getOrDefault(mainPost.getId(), List.of());
        MainPostViewerInteractionResolver.ViewerInteractionState interactionState =
                mainPostViewerInteractionResolver.resolve(List.of(mainPost), authorizationHeader);
        return mainPostApplicationSupport.toDetailResponse(
                mainPost,
                community,
                interactionState.isLiked(mainPost.getId()),
                interactionState.isFavorited(mainPost.getId()),
                mediaAssets
        );
    }
}
