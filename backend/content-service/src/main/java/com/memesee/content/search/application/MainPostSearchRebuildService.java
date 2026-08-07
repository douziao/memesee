package com.memesee.content.search.application;

import com.memesee.content.community.application.CommunityCollaborationApplicationService;
import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MainPostSearchRebuildService {

    private static final int DEFAULT_BATCH_SIZE = 200;
    private static final int MAX_BATCH_SIZE = 1000;

    private final MainPostRepository mainPostRepository;
    private final CommunityCollaborationApplicationService communityCollaborationApplicationService;
    private final MainPostSearchDocumentFactory documentFactory;
    private final MainPostSearchIndexer searchIndexer;

    public MainPostSearchRebuildService(
            MainPostRepository mainPostRepository,
            CommunityCollaborationApplicationService communityCollaborationApplicationService,
            MainPostSearchDocumentFactory documentFactory,
            MainPostSearchIndexer searchIndexer
    ) {
        this.mainPostRepository = mainPostRepository;
        this.communityCollaborationApplicationService = communityCollaborationApplicationService;
        this.documentFactory = documentFactory;
        this.searchIndexer = searchIndexer;
    }

    @Transactional(readOnly = true)
    public MainPostSearchRebuildResult rebuildAll(Integer batchSize) {
        int safeBatchSize = normalizeBatchSize(batchSize);
        searchIndexer.clearAll();

        long indexedItems = 0L;
        int pageIndex = 0;
        while (true) {
            Page<MainPost> page = mainPostRepository.findByDeletedAtIsNullOrderByIdAsc(
                    PageRequest.of(pageIndex, safeBatchSize)
            );
            if (page.isEmpty()) {
                break;
            }
            List<MainPost> mainPosts = page.getContent();
            Map<Long, Community> communitiesById = communityCollaborationApplicationService.loadCommunities(
                    mainPosts.stream().map(MainPost::getCommunityId).toList()
            );
            List<MainPostSearchDocument> documents = mainPosts.stream()
                    .map(mainPost -> documentFactory.from(mainPost, communitiesById.get(mainPost.getCommunityId())))
                    .toList();
            searchIndexer.upsertAll(documents);
            indexedItems += documents.size();
            if (!page.hasNext()) {
                break;
            }
            pageIndex++;
        }

        return new MainPostSearchRebuildResult(indexedItems);
    }

    private int normalizeBatchSize(Integer batchSize) {
        if (batchSize == null || batchSize <= 0) {
            return DEFAULT_BATCH_SIZE;
        }
        return Math.min(batchSize, MAX_BATCH_SIZE);
    }
}
