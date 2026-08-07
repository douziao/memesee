package com.memesee.content.subpost.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.application.MainPostApplicationSupport;
import com.memesee.content.mainpost.application.MainPostCollaborationApplicationService;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.media.application.SubPostMediaCollaborationApplicationService;
import com.memesee.content.subpost.dto.MySubPostItemResponse;
import com.memesee.content.subpost.dto.SubPostPageResponse;
import com.memesee.content.subpost.dto.SubPostResponse;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Base64;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubPostQueryApplicationService {

    private static final int DEFAULT_MY_SUB_POST_LIMIT = 120;
    private static final int MAX_MY_SUB_POST_LIMIT = 1000;
    private static final int MAIN_POST_PREVIEW_LIMIT = 120;
    private static final int DEFAULT_THREAD_PAGE_LIMIT = 30;
    private static final int MAX_THREAD_PAGE_LIMIT = 100;

    private final MainPostCollaborationApplicationService mainPostCollaborationApplicationService;
    private final MainPostApplicationSupport mainPostApplicationSupport;
    private final MainPostRepository mainPostRepository;
    private final AuthContextResolver authContextResolver;
    private final SubPostMediaCollaborationApplicationService subPostMediaCollaborationApplicationService;
    private final SubPostThreadProjectionPort subPostThreadProjectionPort;
    private final SubPostApplicationSupport subPostApplicationSupport;
    private final SubPostRepository subPostRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public SubPostQueryApplicationService(
            MainPostCollaborationApplicationService mainPostCollaborationApplicationService,
            MainPostApplicationSupport mainPostApplicationSupport,
            MainPostRepository mainPostRepository,
            AuthContextResolver authContextResolver,
            SubPostMediaCollaborationApplicationService subPostMediaCollaborationApplicationService,
            SubPostThreadProjectionPort subPostThreadProjectionPort,
            SubPostApplicationSupport subPostApplicationSupport,
            SubPostRepository subPostRepository,
            ObjectMapper objectMapper
    ) {
        this.mainPostCollaborationApplicationService = mainPostCollaborationApplicationService;
        this.mainPostApplicationSupport = mainPostApplicationSupport;
        this.mainPostRepository = mainPostRepository;
        this.authContextResolver = authContextResolver;
        this.subPostMediaCollaborationApplicationService = subPostMediaCollaborationApplicationService;
        this.subPostThreadProjectionPort = subPostThreadProjectionPort;
        this.subPostApplicationSupport = subPostApplicationSupport;
        this.subPostRepository = subPostRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public SubPostPageResponse listSubPostPage(
            Long mainPostId,
            String cursor,
            Integer limit,
            String authorizationHeader
    ) {
        mainPostCollaborationApplicationService.requireActiveMainPost(mainPostId);
        AuthContext authContext = authContextResolver.resolveOptional(authorizationHeader);
        int safeLimit = normalizeThreadPageLimit(limit);
        SubPostThreadCursor threadCursor = decodeCursor(cursor);
        List<SubPostThreadProjectionPort.SubPostThreadProjection> pageItems =
                subPostThreadProjectionPort.loadThreadPage(
                        mainPostId,
                        threadCursor == null ? null : threadCursor.createdAt(),
                        threadCursor == null ? null : threadCursor.subPostId(),
                        safeLimit + 1
                );
        boolean hasMore = pageItems.size() > safeLimit;
        List<SubPostThreadProjectionPort.SubPostThreadProjection> visibleItems =
                hasMore ? pageItems.subList(0, safeLimit) : pageItems;
        List<SubPostResponse> subPosts = buildThreadResponses(visibleItems, authContext);
        String nextCursor = hasMore && !visibleItems.isEmpty()
                ? encodeCursor(visibleItems.get(visibleItems.size() - 1))
                : "";
        return new SubPostPageResponse(subPosts, nextCursor, hasMore);
    }

    @Transactional(readOnly = true)
    public List<MySubPostItemResponse> listMySubPosts(String authorizationHeader, Integer limit) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        List<SubPost> subPosts = subPostRepository.findByAuthorUsernameAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                authContext.username(),
                PageRequest.of(0, normalizeMySubPostLimit(limit))
        );
        if (subPosts.isEmpty()) {
            return List.of();
        }
        Map<Long, MainPost> mainPostsById = mainPostRepository.findAllByIdInAndDeletedAtIsNull(
                        subPosts.stream().map(SubPost::getMainPostId).toList()
                )
                .stream()
                .collect(Collectors.toMap(MainPost::getId, Function.identity()));
        Map<Long, Community> communitiesById = mainPostApplicationSupport.loadCommunities(
                mainPostsById.values().stream().map(MainPost::getCommunityId).toList()
        );
        Map<Long, Long> favoriteCounts = subPostApplicationSupport.loadFavoriteCounts(
                subPosts.stream().map(SubPost::getId).toList()
        );
        Map<Long, List<MediaAssetResponse>> mediaBySubPostId =
                subPostMediaCollaborationApplicationService.resolveSubPostMediaByIds(
                        subPosts.stream().map(SubPost::getId).toList()
                );
        return subPosts.stream()
                .filter(subPost -> mainPostsById.containsKey(subPost.getMainPostId()))
                .map(subPost -> toMySubPostItem(
                        subPost,
                        mainPostsById,
                        communitiesById,
                        favoriteCounts,
                        mediaBySubPostId
                ))
                .toList();
    }


    private List<SubPostResponse> buildThreadResponses(
            List<SubPostThreadProjectionPort.SubPostThreadProjection> subPosts,
            AuthContext authContext
    ) {
        if (subPosts == null || subPosts.isEmpty()) {
            return List.of();
        }
        Map<Long, List<MediaAssetResponse>> mediaBySubPostId =
                subPostMediaCollaborationApplicationService.resolveSubPostMediaByIds(
                subPosts.stream().map(SubPostThreadProjectionPort.SubPostThreadProjection::id).toList()
        );
        Map<Long, Long> favoriteCounts =
                subPostApplicationSupport.loadFavoriteCounts(
                        subPosts.stream().map(SubPostThreadProjectionPort.SubPostThreadProjection::id).toList()
                );
        SubPostApplicationSupport.ViewerInteractionState viewerInteractionState =
                authContext != null && authContext.isAuthenticated()
                        ? subPostApplicationSupport.loadViewerInteractionState(
                                subPosts.stream().map(SubPostThreadProjectionPort.SubPostThreadProjection::id).toList(),
                                authContext.username()
                        )
                        : SubPostApplicationSupport.ViewerInteractionState.empty();
        return subPosts.stream()
                .map(subPost -> subPostApplicationSupport.toResponse(
                        subPost,
                        favoriteCounts.getOrDefault(subPost.id(), 0L),
                        viewerInteractionState.isLiked(subPost.id()),
                        viewerInteractionState.isFavorited(subPost.id()),
                        mediaBySubPostId.getOrDefault(subPost.id(), List.of())
                ))
                .toList();
    }

    private MySubPostItemResponse toMySubPostItem(
            SubPost subPost,
            Map<Long, MainPost> mainPostsById,
            Map<Long, Community> communitiesById,
            Map<Long, Long> favoriteCounts,
            Map<Long, List<MediaAssetResponse>> mediaBySubPostId
    ) {
        MainPost mainPost = mainPostsById.get(subPost.getMainPostId());
        Community community = mainPost == null ? null : communitiesById.get(mainPost.getCommunityId());
        return new MySubPostItemResponse(
                subPost.getId(),
                subPost.getMainPostId(),
                mainPost == null ? "" : mainPost.getTitle(),
                community == null ? "" : community.getSlug(),
                community == null ? "" : community.getName(),
                mainPost == null ? "" : summarizeMainPost(mainPost.getContent()),
                mainPost == null ? "" : mainPost.getAuthorUsername(),
                mainPost == null ? null : mainPost.getCreatedAt(),
                mainPost == null ? null : mainPost.getLatestActivityAt(),
                mainPost == null ? 0L : mainPost.getViewCount(),
                mainPost == null ? 0L : mainPost.getSubPostCount(),
                mainPost == null ? 0L : mainPost.getLikeCount(),
                mainPost == null ? 0L : mainPost.getFavoriteCount(),
                subPost.getParentSubPostId(),
                subPost.getAuthorUsername(),
                subPost.getContent(),
                countImageMediaAssets(mediaBySubPostId.getOrDefault(subPost.getId(), List.of())),
                subPost.getCreatedAt(),
                subPost.getUpdatedAt(),
                subPost.getLikeCount(),
                subPost.getChildSubPostCount(),
                favoriteCounts.getOrDefault(subPost.getId(), 0L)
        );
    }

    private long countImageMediaAssets(List<MediaAssetResponse> mediaAssets) {
        if (mediaAssets == null || mediaAssets.isEmpty()) {
            return 0;
        }
        return mediaAssets.stream()
                .filter(asset -> asset != null && "IMAGE".equalsIgnoreCase(String.valueOf(asset.kind()).trim()))
                .count();
    }

    private String summarizeMainPost(String content) {
        String normalizedContent = String.valueOf(content == null ? "" : content)
                .replaceAll("\\s+", " ")
                .trim();
        if (normalizedContent.isEmpty()) {
            return "";
        }
        if (normalizedContent.length() <= MAIN_POST_PREVIEW_LIMIT) {
            return normalizedContent;
        }
        return normalizedContent.substring(0, MAIN_POST_PREVIEW_LIMIT - 3) + "...";
    }

    private int normalizeMySubPostLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_MY_SUB_POST_LIMIT;
        }
        return Math.min(limit, MAX_MY_SUB_POST_LIMIT);
    }

    private int normalizeThreadPageLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_THREAD_PAGE_LIMIT;
        }
        return Math.min(limit, MAX_THREAD_PAGE_LIMIT);
    }

    private String encodeCursor(SubPostThreadProjectionPort.SubPostThreadProjection subPost) {
        try {
            SubPostThreadCursor cursor = new SubPostThreadCursor(subPost.id(), subPost.createdAt());
            String json = objectMapper.writeValueAsString(cursor);
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(json.getBytes(StandardCharsets.UTF_8));
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Failed to encode sub-post thread cursor.", error);
        }
    }

    private SubPostThreadCursor decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(cursor.trim());
            return objectMapper.readValue(new String(bytes, StandardCharsets.UTF_8), SubPostThreadCursor.class);
        } catch (Exception error) {
            return null;
        }
    }
}
