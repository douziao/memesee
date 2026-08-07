package com.memesee.content.mainpost.application;

import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.interaction.application.MainPostInteractionCollaborationApplicationService;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import com.memesee.content.mainpost.domain.MainPost;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class MainPostViewerInteractionResolver {

    private final AuthContextResolver authContextResolver;
    private final MainPostInteractionCollaborationApplicationService mainPostInteractionCollaborationApplicationService;

    public MainPostViewerInteractionResolver(
            AuthContextResolver authContextResolver,
            MainPostInteractionCollaborationApplicationService mainPostInteractionCollaborationApplicationService
    ) {
        this.authContextResolver = authContextResolver;
        this.mainPostInteractionCollaborationApplicationService = mainPostInteractionCollaborationApplicationService;
    }

    public AuthContext resolveOptional(String authorizationHeader) {
        return authContextResolver.resolveOptional(authorizationHeader);
    }

    public ViewerInteractionState resolve(Collection<MainPost> mainPosts, String authorizationHeader) {
        return resolve(mainPosts, resolveOptional(authorizationHeader));
    }

    public ViewerInteractionState resolve(Collection<MainPost> mainPosts, AuthContext authContext) {
        if (!authContext.isAuthenticated() || mainPosts == null || mainPosts.isEmpty()) {
            return ViewerInteractionState.empty();
        }
        MainPostInteractionCollaborationApplicationService.MainPostViewerInteractionState viewerInteractionState =
                resolveByIds(mainPosts.stream().map(MainPost::getId).toList(), authContext);
        return new ViewerInteractionState(viewerInteractionState.likedIds(), viewerInteractionState.favoritedIds());
    }

    public List<MainPostSummaryResponse> applyToSummaryItems(
            List<MainPostSummaryResponse> items,
            AuthContext authContext
    ) {
        if (!authContext.isAuthenticated() || items == null || items.isEmpty()) {
            return items == null ? List.of() : items;
        }
        MainPostInteractionCollaborationApplicationService.MainPostViewerInteractionState interactionState = resolveByIds(
                items.stream().map(MainPostSummaryResponse::id).toList(),
                authContext
        );
        return items.stream()
                .map(item -> new MainPostSummaryResponse(
                        item.id(),
                        item.communitySlug(),
                        item.communityName(),
                        item.title(),
                        item.contentPreview(),
                        item.postMode(),
                        item.authorUsername(),
                        item.createdAt(),
                        item.updatedAt(),
                        item.latestActivityAt(),
                        item.heatScore(),
                        item.viewCount(),
                        item.subPostCount(),
                        item.likeCount(),
                        item.favoriteCount(),
                        interactionState.isLiked(item.id()),
                        interactionState.isFavorited(item.id()),
                        item.mediaAssets(),
                        item.previewImageUrls(),
                        item.tags()
                ))
                .toList();
    }

    private MainPostInteractionCollaborationApplicationService.MainPostViewerInteractionState resolveByIds(
            List<Long> mainPostIds,
            AuthContext authContext
    ) {
        if (!authContext.isAuthenticated() || mainPostIds == null || mainPostIds.isEmpty()) {
            return MainPostInteractionCollaborationApplicationService.MainPostViewerInteractionState.empty();
        }
        return mainPostInteractionCollaborationApplicationService.loadMainPostViewerInteractionState(
                mainPostIds,
                authContext.username()
        );
    }

    record ViewerInteractionState(Set<Long> likedIds, Set<Long> favoritedIds) {
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
