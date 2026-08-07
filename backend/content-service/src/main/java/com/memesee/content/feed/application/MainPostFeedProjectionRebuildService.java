package com.memesee.content.feed.application;

import com.memesee.content.feed.infrastructure.MainPostFeedItem;
import com.memesee.content.feed.infrastructure.MainPostFeedItemRepository;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.application.MainPostMediaCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MainPostFeedProjectionRebuildService {

    private static final int DEFAULT_BATCH_SIZE = 200;
    private static final int MAX_BATCH_SIZE = 1000;

    private final MainPostRepository mainPostRepository;
    private final MainPostFeedItemRepository mainPostFeedItemRepository;
    private final MainPostFeedItemAssembler mainPostFeedItemAssembler;
    private final MainPostMediaCollaborationApplicationService mediaCollaborationApplicationService;

    public MainPostFeedProjectionRebuildService(
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
    public FeedProjectionRebuildResult rebuildAll(Integer batchSize) {
        int safeBatchSize = normalizeBatchSize(batchSize);
        long deletedItems = mainPostFeedItemRepository.count();
        mainPostFeedItemRepository.deleteAllInBatch();

        long rebuiltItems = 0L;
        int pageIndex = 0;
        while (true) {
            Page<MainPost> page = mainPostRepository.findByDeletedAtIsNullOrderByIdAsc(
                    PageRequest.of(pageIndex, safeBatchSize)
            );
            if (page.isEmpty()) {
                break;
            }
            List<MainPost> mainPosts = page.getContent();
            Map<Long, List<MediaAssetResponse>> mediaByMainPostId =
                    mediaCollaborationApplicationService.resolveMainPostMedia(mainPosts);
            List<MainPostFeedItem> feedItems = mainPosts.stream()
                    .map(mainPost -> mainPostFeedItemAssembler.assemble(
                            mainPost,
                            mediaByMainPostId.getOrDefault(mainPost.getId(), List.of())
                    ))
                    .toList();
            mainPostFeedItemRepository.saveAll(feedItems);
            rebuiltItems += feedItems.size();
            if (!page.hasNext()) {
                break;
            }
            pageIndex++;
        }

        return new FeedProjectionRebuildResult(deletedItems, rebuiltItems);
    }

    private int normalizeBatchSize(Integer batchSize) {
        if (batchSize == null || batchSize <= 0) {
            return DEFAULT_BATCH_SIZE;
        }
        return Math.min(batchSize, MAX_BATCH_SIZE);
    }
}
