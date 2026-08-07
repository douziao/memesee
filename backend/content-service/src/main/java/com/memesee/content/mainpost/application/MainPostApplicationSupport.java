package com.memesee.content.mainpost.application;

import com.memesee.content.community.application.CommunityCollaborationApplicationService;
import com.memesee.content.community.domain.Community;
import com.memesee.content.feed.application.MainPostReadModelAssembler;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.search.application.MainPostSearchSyncService;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class MainPostApplicationSupport {

    private final MainPostRepository mainPostRepository;
    private final CommunityCollaborationApplicationService communityCollaborationApplicationService;
    private final MainPostReadModelAssembler mainPostReadModelAssembler;
    private final MainPostSearchSyncService mainPostSearchSyncService;

    public MainPostApplicationSupport(
            MainPostRepository mainPostRepository,
            CommunityCollaborationApplicationService communityCollaborationApplicationService,
            MainPostReadModelAssembler mainPostReadModelAssembler,
            MainPostSearchSyncService mainPostSearchSyncService
    ) {
        this.mainPostRepository = mainPostRepository;
        this.communityCollaborationApplicationService = communityCollaborationApplicationService;
        this.mainPostReadModelAssembler = mainPostReadModelAssembler;
        this.mainPostSearchSyncService = mainPostSearchSyncService;
    }

    public MainPost requireActiveMainPost(Long mainPostId) {
        return mainPostRepository.findByIdAndDeletedAtIsNull(mainPostId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        ApiErrorCode.RESOURCE_NOT_FOUND,
                        "主帖不存在。"
                ));
    }

    public Community requireCommunityBySlug(String communitySlug) {
        return communityCollaborationApplicationService.requireCommunityBySlug(communitySlug);
    }

    public Community requireCommunityById(Long communityId) {
        return communityCollaborationApplicationService.requireCommunityById(communityId);
    }

    public Map<Long, Community> loadCommunities(Collection<Long> communityIds) {
        return communityCollaborationApplicationService.loadCommunities(communityIds);
    }

    public MainPostDetailResponse toDetailResponse(
            MainPost mainPost,
            Community community,
            boolean likedByMe,
            boolean favoritedByMe,
            List<MediaAssetResponse> mediaAssets
    ) {
        return mainPostReadModelAssembler.toDetail(
                mainPostReadModelAssembler.assemble(mainPost, community, likedByMe, favoritedByMe, mediaAssets)
        );
    }

    public void requestSearchSync(MainPost mainPost) {
        if (mainPost == null) {
            throw new IllegalArgumentException("mainPost must not be null.");
        }
        mainPostSearchSyncService.requestUpsert(mainPost, requireCommunityById(mainPost.getCommunityId()));
    }

    public void requestSearchDelete(Long mainPostId) {
        mainPostSearchSyncService.requestDelete(mainPostId);
    }

    public String normalizeCommunitySlug(String communitySlug) {
        if (communitySlug == null || communitySlug.isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "社区标识不能为空。"
            );
        }
        return communitySlug.trim().toLowerCase(Locale.ROOT);
    }

    public String normalizeOptionalCommunitySlug(String communitySlug) {
        if (communitySlug == null || communitySlug.isBlank()) {
            return null;
        }
        return normalizeCommunitySlug(communitySlug);
    }
}
