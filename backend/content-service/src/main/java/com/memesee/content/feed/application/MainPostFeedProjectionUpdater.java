package com.memesee.content.feed.application;

import com.memesee.content.feed.infrastructure.MainPostFeedItemRepository;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.application.MainPostMediaCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MainPostFeedProjectionUpdater {

    private final MainPostRepository mainPostRepository;
    private final MainPostFeedItemRepository mainPostFeedItemRepository;
    private final MainPostFeedItemAssembler mainPostFeedItemAssembler;
    private final MainPostMediaCollaborationApplicationService mediaCollaborationApplicationService;

    public MainPostFeedProjectionUpdater(
            MainPostRepository mainPostRepository,
            MainPostFeedItemRepository mainPostFeedItemRepository,
            MainPostFeedItemAssembler mainPostFeedItemAssembler,
            MainPostMediaCollaborationApplicationService mediaCollaborationApplicationService
    ) {
        this.mainPostRepository = mainPostRepository;
        this.mainPostFeedItemRepository = mainPostFeedItemRepository;
        this.mainPostFeedItemAssembler = mainPostFeedItemAssembler;
        this.mediaCollaborationApplicationService = mediaCollaborationApplicationService;
    }

    @Transactional
    public void refreshMainPost(Long mainPostId) {
        if (mainPostId == null || mainPostId <= 0L) {
            return;
        }
        MainPost mainPost = mainPostRepository.findById(mainPostId).orElse(null);
        if (mainPost == null) {
            mainPostFeedItemRepository.deleteById(mainPostId);
            return;
        }
        if (mainPost.getDeletedAt() != null) {
            mainPostFeedItemRepository.deleteById(mainPostId);
            return;
        }
        List<MediaAssetResponse> mediaAssets =
                mediaCollaborationApplicationService.resolveMainPostMedia(List.of(mainPost))
                        .getOrDefault(mainPost.getId(), List.of());
        mainPostFeedItemRepository.save(mainPostFeedItemAssembler.assemble(mainPost, mediaAssets));
    }
}
