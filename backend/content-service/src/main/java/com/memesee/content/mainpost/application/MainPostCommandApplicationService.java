package com.memesee.content.mainpost.application;

import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.common.observability.ContentCommandTelemetry;
import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.dto.CreateMainPostRequest;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.mainpost.dto.UpdateMainPostRequest;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.media.application.MainPostMediaCollaborationApplicationService;
import com.memesee.content.media.application.MainPostMediaCommandCollaborationApplicationService;
import com.memesee.content.sideeffect.application.ContentSideEffectPublisher;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MainPostCommandApplicationService implements MainPostCollaborationApplicationService {

    private static final int MAX_TAG_COUNT = 3;
    private static final int MAX_TAG_TOTAL_LENGTH = 12;
    private static final int MAX_TITLE_LENGTH = 30;

    private final MainPostRepository mainPostRepository;
    private final AuthContextResolver authContextResolver;
    private final MainPostMediaCommandCollaborationApplicationService mainPostMediaCommandCollaborationApplicationService;
    private final MainPostMediaCollaborationApplicationService mainPostMediaCollaborationApplicationService;
    private final MainPostApplicationSupport mainPostApplicationSupport;
    private final ContentSideEffectPublisher contentSideEffectPublisher;
    private final ContentCommandTelemetry contentCommandTelemetry;

    public MainPostCommandApplicationService(
            MainPostRepository mainPostRepository,
            AuthContextResolver authContextResolver,
            MainPostMediaCommandCollaborationApplicationService mainPostMediaCommandCollaborationApplicationService,
            MainPostMediaCollaborationApplicationService mainPostMediaCollaborationApplicationService,
            MainPostApplicationSupport mainPostApplicationSupport,
            ContentSideEffectPublisher contentSideEffectPublisher,
            ContentCommandTelemetry contentCommandTelemetry
    ) {
        this.mainPostRepository = mainPostRepository;
        this.authContextResolver = authContextResolver;
        this.mainPostMediaCommandCollaborationApplicationService = mainPostMediaCommandCollaborationApplicationService;
        this.mainPostMediaCollaborationApplicationService = mainPostMediaCollaborationApplicationService;
        this.mainPostApplicationSupport = mainPostApplicationSupport;
        this.contentSideEffectPublisher = contentSideEffectPublisher;
        this.contentCommandTelemetry = contentCommandTelemetry == null
                ? ContentCommandTelemetry.noop()
                : contentCommandTelemetry;
    }

    @Transactional
    public MainPostDetailResponse createMainPost(String authorizationHeader, CreateMainPostRequest request) {
        long startNanos = System.nanoTime();
        String outcome = "success";
        Long mainPostId = null;
        Long communityId = null;
        String postMode = normalizePostMode(request.postMode());
        try {
            AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
            Community community = mainPostApplicationSupport.requireCommunityBySlug(request.communitySlug());
            communityId = community.getId();
            MainPost mainPost = new MainPost(
                    community.getId(),
                    authContext.username(),
                    normalizeTitle(request.title()),
                    normalizeContent(request.content(), request.mediaAssetIds()),
                    normalizeTags(request.tags()),
                    postMode
            );
            mainPostRepository.save(mainPost);
            mainPostId = mainPost.getId();
            mainPostMediaCommandCollaborationApplicationService.syncMainPostMedia(
                    mainPost.getId(),
                    authContext.username(),
                    request.mediaAssetIds()
            );
            List<MediaAssetResponse> mediaAssets =
                    mainPostMediaCollaborationApplicationService.resolveMainPostMedia(List.of(mainPost))
                    .getOrDefault(mainPost.getId(), List.of());
            contentSideEffectPublisher.onMainPostCreated(mainPost);
            return mainPostApplicationSupport.toDetailResponse(mainPost, community, false, false, mediaAssets);
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception;
        } finally {
            recordCommand(
                    "create",
                    outcome,
                    mainPostId,
                    null,
                    communityId,
                    request.communitySlug(),
                    postMode,
                    countItems(request.mediaAssetIds()),
                    countItems(request.tags()),
                    startNanos
            );
        }
    }

    @Transactional
    public MainPostDetailResponse updateMainPost(
            Long mainPostId,
            String authorizationHeader,
            UpdateMainPostRequest request
    ) {
        long startNanos = System.nanoTime();
        String outcome = "success";
        Long communityId = null;
        String communitySlug = null;
        String postMode = normalizePostMode(request.postMode());
        try {
            AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
            MainPost mainPost = mainPostApplicationSupport.requireActiveMainPost(mainPostId);
            communityId = mainPost.getCommunityId();
            assertOwner(authContext, mainPost.getAuthorUsername());
            mainPost.updateContent(
                    normalizeTitle(request.title()),
                    normalizeContent(request.content(), request.mediaAssetIds()),
                    normalizeTags(request.tags()),
                    postMode
            );
            mainPostMediaCommandCollaborationApplicationService.syncMainPostMedia(
                    mainPost.getId(),
                    authContext.username(),
                    request.mediaAssetIds()
            );
            Community community = mainPostApplicationSupport.requireCommunityById(mainPost.getCommunityId());
            communitySlug = community.getSlug();
            List<MediaAssetResponse> mediaAssets =
                    mainPostMediaCollaborationApplicationService.resolveMainPostMedia(List.of(mainPost))
                    .getOrDefault(mainPost.getId(), List.of());
            contentSideEffectPublisher.onMainPostChanged(mainPost);
            return mainPostApplicationSupport.toDetailResponse(mainPost, community, false, false, mediaAssets);
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception;
        } finally {
            recordCommand(
                    "update",
                    outcome,
                    mainPostId,
                    null,
                    communityId,
                    communitySlug,
                    postMode,
                    countItems(request.mediaAssetIds()),
                    countItems(request.tags()),
                    startNanos
            );
        }
    }

    @Transactional
    public void deleteMainPost(Long mainPostId, String authorizationHeader) {
        long startNanos = System.nanoTime();
        String outcome = "success";
        Long communityId = null;
        try {
            AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
            MainPost mainPost = mainPostApplicationSupport.requireActiveMainPost(mainPostId);
            communityId = mainPost.getCommunityId();
            assertOwner(authContext, mainPost.getAuthorUsername());
            mainPost.markDeleted();
            mainPostMediaCommandCollaborationApplicationService.clearMainPostMedia(mainPost.getId());
            contentSideEffectPublisher.onMainPostDeleted(mainPost);
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception;
        } finally {
            recordCommand(
                    "delete",
                    outcome,
                    mainPostId,
                    null,
                    communityId,
                    null,
                    "unknown",
                    0,
                    0,
                    startNanos
            );
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MainPost requireActiveMainPost(Long mainPostId) {
        return mainPostApplicationSupport.requireActiveMainPost(mainPostId);
    }

    private void assertOwner(AuthContext authContext, String expectedUsername) {
        if (!authContext.isAuthenticated() || !expectedUsername.equals(authContext.username())) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    ApiErrorCode.FORBIDDEN,
                    "你无权操作这条内容。"
            );
        }
    }

    private String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "主帖标题不能为空。"
            );
        }
        String normalizedTitle = title.trim();
        if (normalizedTitle.length() > MAX_TITLE_LENGTH) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "主帖标题不能超过 30 个字符。"
            );
        }
        return normalizedTitle;
    }

    private String normalizeContent(String content, List<Long> mediaAssetIds) {
        String normalizedContent = content == null ? "" : content.trim();
        boolean hasMedia = mediaAssetIds != null && mediaAssetIds.stream()
                .anyMatch(assetId -> assetId != null && assetId > 0L);
        if (!hasMedia && normalizedContent.isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "主帖内容不能为空。"
            );
        }
        return normalizedContent;
    }


    private String normalizePostMode(String postMode) {
        return "rich".equals(postMode) ? "rich" : "long";
    }

    private List<String> normalizeTags(List<String> rawTags) {
        if (rawTags == null || rawTags.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> normalizedTags = new LinkedHashSet<>();
        for (String rawTag : rawTags) {
            if (rawTag == null) {
                continue;
            }
            String normalizedTag = rawTag.trim();
            if (normalizedTag.startsWith("#")) {
                normalizedTag = normalizedTag.substring(1);
            }
            normalizedTag = normalizedTag.trim();
            if (!normalizedTag.isEmpty()) {
                normalizedTags.add(normalizedTag);
            }
        }

        if (normalizedTags.size() > MAX_TAG_COUNT) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "TAG 最多 3 个。"
            );
        }

        int totalLength = normalizedTags.stream()
                .mapToInt(String::length)
                .sum();
        if (totalLength > MAX_TAG_TOTAL_LENGTH) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "TAG 总长度不能超过 12 个字符。"
            );
        }

        return List.copyOf(normalizedTags);
    }

    private void recordCommand(
            String operation,
            String outcome,
            Long mainPostId,
            Long parentSubPostId,
            Long communityId,
            String communitySlug,
            String postMode,
            int mediaAssetCount,
            int tagCount,
            long startNanos
    ) {
        contentCommandTelemetry.record(new ContentCommandTelemetry.CommandObservation(
                "main-post",
                operation,
                outcome,
                mainPostId,
                null,
                parentSubPostId,
                communityId,
                communitySlug,
                postMode,
                mediaAssetCount,
                tagCount,
                System.nanoTime() - startNanos
        ));
    }

    private int countItems(List<?> items) {
        return items == null ? 0 : items.size();
    }
}
