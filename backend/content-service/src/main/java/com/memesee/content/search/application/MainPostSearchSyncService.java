package com.memesee.content.search.application;

import com.memesee.content.common.outbox.application.ContentOutboxService;
import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.domain.MainPost;
import org.springframework.stereotype.Service;

@Service
public class MainPostSearchSyncService {

    static final String MAIN_POST_SEARCH_SYNC_EVENT_TYPE = "content.search.main-post-sync-requested";

    private final ContentOutboxService contentOutboxService;
    private final MainPostSearchDocumentFactory documentFactory;

    public MainPostSearchSyncService(
            ContentOutboxService contentOutboxService,
            MainPostSearchDocumentFactory documentFactory
    ) {
        this.contentOutboxService = contentOutboxService;
        this.documentFactory = documentFactory;
    }

    public void requestUpsert(MainPost mainPost, Community community) {
        if (mainPost == null) {
            throw new IllegalArgumentException("mainPost must not be null.");
        }
        if (mainPost.getDeletedAt() != null) {
            requestDelete(mainPost.getId());
            return;
        }
        if (community == null) {
            throw new IllegalArgumentException("community must not be null.");
        }
        contentOutboxService.append(
                "main-post",
                String.valueOf(mainPost.getId()),
                MAIN_POST_SEARCH_SYNC_EVENT_TYPE,
                new MainPostSearchSyncPayload(
                        MainPostSearchSyncAction.UPSERT,
                        mainPost.getId(),
                        documentFactory.from(mainPost, community)
                )
        );
    }

    public void requestDelete(Long mainPostId) {
        if (mainPostId == null) {
            throw new IllegalArgumentException("mainPostId must not be null.");
        }
        contentOutboxService.append(
                "main-post",
                String.valueOf(mainPostId),
                MAIN_POST_SEARCH_SYNC_EVENT_TYPE,
                new MainPostSearchSyncPayload(
                        MainPostSearchSyncAction.DELETE,
                        mainPostId,
                        null
                )
        );
    }
}
