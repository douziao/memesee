package com.memesee.content.subpost.application;

import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.common.observability.ContentCommandTelemetry;
import com.memesee.content.mainpost.application.MainPostCollaborationApplicationService;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.media.application.SubPostMediaCollaborationApplicationService;
import com.memesee.content.media.application.SubPostMediaCommandCollaborationApplicationService;
import com.memesee.content.sideeffect.application.ContentSideEffectPublisher;
import com.memesee.content.subpost.dto.CreateSubPostRequest;
import com.memesee.content.subpost.dto.SubPostResponse;
import com.memesee.content.subpost.dto.UpdateSubPostRequest;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubPostCommandApplicationService implements SubPostCollaborationApplicationService {

    private final SubPostRepository subPostRepository;
    private final MainPostCollaborationApplicationService mainPostCollaborationApplicationService;
    private final AuthContextResolver authContextResolver;
    private final SubPostMediaCommandCollaborationApplicationService subPostMediaCommandCollaborationApplicationService;
    private final SubPostMediaCollaborationApplicationService subPostMediaCollaborationApplicationService;
    private final SubPostApplicationSupport subPostApplicationSupport;
    private final ContentSideEffectPublisher contentSideEffectPublisher;
    private final ContentCommandTelemetry contentCommandTelemetry;

    public SubPostCommandApplicationService(
            SubPostRepository subPostRepository,
            MainPostCollaborationApplicationService mainPostCollaborationApplicationService,
            AuthContextResolver authContextResolver,
            SubPostMediaCommandCollaborationApplicationService subPostMediaCommandCollaborationApplicationService,
            SubPostMediaCollaborationApplicationService subPostMediaCollaborationApplicationService,
            SubPostApplicationSupport subPostApplicationSupport,
            ContentSideEffectPublisher contentSideEffectPublisher,
            ContentCommandTelemetry contentCommandTelemetry
    ) {
        this.subPostRepository = subPostRepository;
        this.mainPostCollaborationApplicationService = mainPostCollaborationApplicationService;
        this.authContextResolver = authContextResolver;
        this.subPostMediaCommandCollaborationApplicationService = subPostMediaCommandCollaborationApplicationService;
        this.subPostMediaCollaborationApplicationService = subPostMediaCollaborationApplicationService;
        this.subPostApplicationSupport = subPostApplicationSupport;
        this.contentSideEffectPublisher = contentSideEffectPublisher;
        this.contentCommandTelemetry = contentCommandTelemetry == null
                ? ContentCommandTelemetry.noop()
                : contentCommandTelemetry;
    }

    @Transactional
    public SubPostResponse createSubPost(
            Long mainPostId,
            String authorizationHeader,
            CreateSubPostRequest request
    ) {
        long startNanos = System.nanoTime();
        String outcome = "success";
        Long subPostId = null;
        Long parentSubPostId = request.parentSubPostId();
        try {
            AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
            MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(mainPostId);
            parentSubPostId = normalizeParentSubPostId(mainPostId, request.parentSubPostId());

            SubPost subPost = new SubPost(
                    mainPost.getId(),
                    parentSubPostId,
                    authContext.username(),
                    subPostApplicationSupport.normalizeContent(request.content(), request.mediaAssetIds())
            );
            subPostRepository.save(subPost);
            subPostId = subPost.getId();
            subPostMediaCommandCollaborationApplicationService.syncSubPostMedia(
                    subPost.getId(),
                    authContext.username(),
                    request.mediaAssetIds()
            );
            mainPost.increaseSubPostCount();
            mainPost.touchActivityAt(subPost.getCreatedAt());
            String parentSubPostAuthorUsername = null;

            if (parentSubPostId != null) {
                SubPost parentSubPost = subPostApplicationSupport.requireActiveSubPost(parentSubPostId);
                parentSubPost.increaseChildSubPostCount();
                parentSubPostAuthorUsername = parentSubPost.getAuthorUsername();
            }
            contentSideEffectPublisher.onSubPostCreated(
                    mainPost,
                    subPost,
                    authContext.username(),
                    parentSubPostAuthorUsername
            );
            List<MediaAssetResponse> mediaAssets =
                    subPostMediaCollaborationApplicationService.resolveSubPostMedia(List.of(subPost))
                    .getOrDefault(subPost.getId(), List.of());
            return subPostApplicationSupport.toResponse(subPost, 0L, false, false, mediaAssets);
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception;
        } finally {
            recordCommand(
                    "create",
                    outcome,
                    mainPostId,
                    subPostId,
                    parentSubPostId,
                    countItems(request.mediaAssetIds()),
                    startNanos
            );
        }
    }

    @Transactional
    public SubPostResponse updateSubPost(
            Long subPostId,
            String authorizationHeader,
            UpdateSubPostRequest request
    ) {
        long startNanos = System.nanoTime();
        String outcome = "success";
        Long mainPostId = null;
        Long parentSubPostId = null;
        try {
            AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
            SubPost subPost = subPostApplicationSupport.requireActiveSubPost(subPostId);
            mainPostId = subPost.getMainPostId();
            parentSubPostId = subPost.getParentSubPostId();
            assertOwner(authContext, subPost.getAuthorUsername());
            subPost.updateContent(subPostApplicationSupport.normalizeContent(request.content(), request.mediaAssetIds()));
            MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(subPost.getMainPostId());
            contentSideEffectPublisher.onSubPostChanged(mainPost);
            subPostMediaCommandCollaborationApplicationService.syncSubPostMedia(
                    subPost.getId(),
                    authContext.username(),
                    request.mediaAssetIds()
            );
            List<MediaAssetResponse> mediaAssets =
                    subPostMediaCollaborationApplicationService.resolveSubPostMedia(List.of(subPost))
                    .getOrDefault(subPost.getId(), List.of());
            Map<Long, Long> favoriteCounts = subPostApplicationSupport.loadFavoriteCounts(List.of(subPost.getId()));
            SubPostApplicationSupport.ViewerInteractionState viewerInteractionState =
                    subPostApplicationSupport.loadViewerInteractionState(List.of(subPost.getId()), authContext.username());
            return subPostApplicationSupport.toResponse(
                    subPost,
                    favoriteCounts.getOrDefault(subPost.getId(), 0L),
                    viewerInteractionState.isLiked(subPost.getId()),
                    viewerInteractionState.isFavorited(subPost.getId()),
                    mediaAssets
            );
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception;
        } finally {
            recordCommand(
                    "update",
                    outcome,
                    mainPostId,
                    subPostId,
                    parentSubPostId,
                    countItems(request.mediaAssetIds()),
                    startNanos
            );
        }
    }

    @Transactional
    public void deleteSubPost(Long subPostId, String authorizationHeader) {
        long startNanos = System.nanoTime();
        String outcome = "success";
        Long mainPostId = null;
        Long parentSubPostId = null;
        try {
            AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
            SubPost subPost = subPostApplicationSupport.requireActiveSubPost(subPostId);
            mainPostId = subPost.getMainPostId();
            parentSubPostId = subPost.getParentSubPostId();
            assertOwner(authContext, subPost.getAuthorUsername());
            subPost.markDeleted();
            subPostMediaCommandCollaborationApplicationService.clearSubPostMedia(subPost.getId());

            MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(subPost.getMainPostId());
            mainPost.decreaseSubPostCount();
            mainPost.recalculateLatestActivityAt(
                    subPostRepository.findFirstByMainPostIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(mainPost.getId())
                            .map(SubPost::getCreatedAt)
                            .orElse(null)
            );
            contentSideEffectPublisher.onSubPostDeleted(mainPost, subPost);

            if (subPost.getParentSubPostId() != null) {
                subPostRepository.findByIdAndDeletedAtIsNull(subPost.getParentSubPostId())
                        .ifPresent(SubPost::decreaseChildSubPostCount);
            }
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception;
        } finally {
            recordCommand(
                    "delete",
                    outcome,
                    mainPostId,
                    subPostId,
                    parentSubPostId,
                    0,
                    startNanos
            );
        }
    }

    @Override
    @Transactional(readOnly = true)
    public SubPost requireActiveSubPost(Long subPostId) {
        return subPostApplicationSupport.requireActiveSubPost(subPostId);
    }

    private Long normalizeParentSubPostId(Long mainPostId, Long parentSubPostId) {
        if (parentSubPostId == null) {
            return null;
        }
        SubPost parentSubPost = subPostApplicationSupport.requireActiveSubPost(parentSubPostId);
        if (!mainPostId.equals(parentSubPost.getMainPostId())) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    ApiErrorCode.CONFLICT,
                    "父子帖不属于当前主帖。"
            );
        }
        return parentSubPost.getId();
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

    private void recordCommand(
            String operation,
            String outcome,
            Long mainPostId,
            Long subPostId,
            Long parentSubPostId,
            int mediaAssetCount,
            long startNanos
    ) {
        contentCommandTelemetry.record(new ContentCommandTelemetry.CommandObservation(
                "sub-post",
                operation,
                outcome,
                mainPostId,
                subPostId,
                parentSubPostId,
                null,
                null,
                "reply",
                mediaAssetCount,
                0,
                System.nanoTime() - startNanos
        ));
    }

    private int countItems(List<?> items) {
        return items == null ? 0 : items.size();
    }
}
