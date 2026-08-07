package com.memesee.content.interaction.application;

import com.memesee.content.common.application.ContentCacheInvalidationCoordinator;
import com.memesee.content.interaction.infrastructure.MainPostFavoriteRepository;
import com.memesee.content.interaction.infrastructure.MainPostLikeRepository;
import com.memesee.content.interaction.infrastructure.SubPostFavoriteRepository;
import com.memesee.content.interaction.infrastructure.SubPostLikeRepository;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InteractionReferenceInvalidationService implements InteractionReferenceInvalidator {

    private final MainPostLikeRepository mainPostLikeRepository;
    private final MainPostFavoriteRepository mainPostFavoriteRepository;
    private final SubPostLikeRepository subPostLikeRepository;
    private final SubPostFavoriteRepository subPostFavoriteRepository;
    private final ContentCacheInvalidationCoordinator cacheInvalidationCoordinator;

    public InteractionReferenceInvalidationService(
            MainPostLikeRepository mainPostLikeRepository,
            MainPostFavoriteRepository mainPostFavoriteRepository,
            SubPostLikeRepository subPostLikeRepository,
            SubPostFavoriteRepository subPostFavoriteRepository,
            ContentCacheInvalidationCoordinator cacheInvalidationCoordinator
    ) {
        this.mainPostLikeRepository = mainPostLikeRepository;
        this.mainPostFavoriteRepository = mainPostFavoriteRepository;
        this.subPostLikeRepository = subPostLikeRepository;
        this.subPostFavoriteRepository = subPostFavoriteRepository;
        this.cacheInvalidationCoordinator = cacheInvalidationCoordinator;
    }

    @Override
    @Transactional(readOnly = true)
    public void invalidateInteractionListsReferencingMainPost(Long mainPostId) {
        Long requiredMainPostId = requireId(mainPostId, "mainPostId");
        Set<String> usernames = new LinkedHashSet<>();
        usernames.addAll(mainPostLikeRepository.findDistinctUsernamesByMainPostId(requiredMainPostId));
        usernames.addAll(mainPostFavoriteRepository.findDistinctUsernamesByMainPostId(requiredMainPostId));
        usernames.addAll(subPostLikeRepository.findDistinctUsernamesByMainPostId(requiredMainPostId));
        usernames.addAll(subPostFavoriteRepository.findDistinctUsernamesByMainPostId(requiredMainPostId));
        cacheInvalidationCoordinator.onInteractionReferencesUnavailable(usernames);
    }

    @Override
    @Transactional(readOnly = true)
    public void invalidateInteractionListsReferencingSubPost(Long subPostId) {
        Long requiredSubPostId = requireId(subPostId, "subPostId");
        Set<String> usernames = new LinkedHashSet<>();
        usernames.addAll(subPostLikeRepository.findDistinctUsernamesBySubPostId(requiredSubPostId));
        usernames.addAll(subPostFavoriteRepository.findDistinctUsernamesBySubPostId(requiredSubPostId));
        cacheInvalidationCoordinator.onInteractionReferencesUnavailable(usernames);
    }

    private Long requireId(Long id, String fieldName) {
        if (id == null) {
            throw new IllegalArgumentException(fieldName + " must not be null.");
        }
        return id;
    }
}
