package com.memesee.content.subpost.application;

import com.memesee.content.interaction.application.SubPostInteractionCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.subpost.dto.SubPostResponse;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class SubPostApplicationSupport {

    private final SubPostRepository subPostRepository;
    private final SubPostInteractionCollaborationApplicationService subPostInteractionCollaborationApplicationService;

    public SubPostApplicationSupport(
            SubPostRepository subPostRepository,
            SubPostInteractionCollaborationApplicationService subPostInteractionCollaborationApplicationService
    ) {
        this.subPostRepository = subPostRepository;
        this.subPostInteractionCollaborationApplicationService = subPostInteractionCollaborationApplicationService;
    }

    public SubPost requireActiveSubPost(Long subPostId) {
        return subPostRepository.findByIdAndDeletedAtIsNull(subPostId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        ApiErrorCode.RESOURCE_NOT_FOUND,
                        "子帖不存在。"
                ));
    }

    public String normalizeContent(String content) {
        return normalizeContent(content, List.of());
    }

    public String normalizeContent(String content, List<Long> mediaAssetIds) {
        String normalizedContent = content == null ? "" : content.trim();
        boolean hasMedia = mediaAssetIds != null && mediaAssetIds.stream()
                .anyMatch(assetId -> assetId != null && assetId > 0L);
        if (!hasMedia && normalizedContent.isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "子帖内容或图片不能为空。"
            );
        }
        return normalizedContent;
    }

    public Map<Long, Long> loadFavoriteCounts(List<Long> subPostIds) {
        return new HashMap<>(subPostInteractionCollaborationApplicationService.loadSubPostFavoriteCounts(subPostIds));
    }

    public ViewerInteractionState loadViewerInteractionState(List<Long> subPostIds, String username) {
        if (subPostIds == null || subPostIds.isEmpty() || username == null || username.isBlank()) {
            return ViewerInteractionState.empty();
        }
        SubPostInteractionCollaborationApplicationService.SubPostViewerInteractionState viewerInteractionState =
                subPostInteractionCollaborationApplicationService.loadSubPostViewerInteractionState(subPostIds, username);
        return new ViewerInteractionState(
                viewerInteractionState.likedIds(),
                viewerInteractionState.favoritedIds()
        );
    }

    public SubPostResponse toResponse(
            SubPost subPost,
            long favoriteCount,
            boolean likedByMe,
            boolean favoritedByMe,
            List<MediaAssetResponse> mediaAssets
    ) {
        return new SubPostResponse(
                subPost.getId(),
                subPost.getMainPostId(),
                subPost.getParentSubPostId(),
                null,
                subPost.getAuthorUsername(),
                subPost.getContent(),
                subPost.getCreatedAt(),
                subPost.getUpdatedAt(),
                subPost.getLikeCount(),
                subPost.getChildSubPostCount(),
                favoriteCount,
                likedByMe,
                favoritedByMe,
                mediaAssets
        );
    }

    public SubPostResponse toResponse(
            SubPostThreadProjectionPort.SubPostThreadProjection subPost,
            long favoriteCount,
            boolean likedByMe,
            boolean favoritedByMe,
            List<MediaAssetResponse> mediaAssets
    ) {
        return new SubPostResponse(
                subPost.id(),
                subPost.mainPostId(),
                subPost.parentSubPostId(),
                subPost.parentSubPostAuthorUsername(),
                subPost.authorUsername(),
                subPost.content(),
                subPost.createdAt(),
                subPost.updatedAt(),
                subPost.likeCount(),
                subPost.childSubPostCount(),
                favoriteCount,
                likedByMe,
                favoritedByMe,
                mediaAssets
        );
    }

    public record ViewerInteractionState(
            Set<Long> likedIds,
            Set<Long> favoritedIds
    ) {
        static ViewerInteractionState empty() {
            return new ViewerInteractionState(Set.of(), Set.of());
        }

        boolean isLiked(Long id) {
            return likedIds.contains(id);
        }

        boolean isFavorited(Long id) {
            return favoritedIds.contains(id);
        }
    }
}
