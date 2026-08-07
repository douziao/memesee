package com.memesee.content.interaction.application;

import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.interaction.dto.FavoriteStatusResponse;
import com.memesee.content.interaction.dto.LikeStatusResponse;
import com.memesee.content.interaction.domain.MainPostFavorite;
import com.memesee.content.interaction.domain.MainPostLike;
import com.memesee.content.interaction.domain.SubPostFavorite;
import com.memesee.content.interaction.domain.SubPostLike;
import com.memesee.content.interaction.infrastructure.MainPostFavoriteRepository;
import com.memesee.content.interaction.infrastructure.MainPostLikeRepository;
import com.memesee.content.interaction.infrastructure.SubPostFavoriteRepository;
import com.memesee.content.interaction.infrastructure.SubPostLikeRepository;
import com.memesee.content.mainpost.application.MainPostCollaborationApplicationService;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.sideeffect.application.ContentSideEffectPublisher;
import com.memesee.content.subpost.application.SubPostCollaborationApplicationService;
import com.memesee.content.subpost.domain.SubPost;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InteractionCommandApplicationService {

    private final MainPostLikeRepository mainPostLikeRepository;
    private final MainPostFavoriteRepository mainPostFavoriteRepository;
    private final SubPostLikeRepository subPostLikeRepository;
    private final SubPostFavoriteRepository subPostFavoriteRepository;
    private final InteractionTargetCountProjectionPort interactionTargetCountProjectionPort;
    private final MainPostCollaborationApplicationService mainPostCollaborationApplicationService;
    private final SubPostCollaborationApplicationService subPostCollaborationApplicationService;
    private final AuthContextResolver authContextResolver;
    private final ContentSideEffectPublisher contentSideEffectPublisher;

    public InteractionCommandApplicationService(
            MainPostLikeRepository mainPostLikeRepository,
            MainPostFavoriteRepository mainPostFavoriteRepository,
            SubPostLikeRepository subPostLikeRepository,
            SubPostFavoriteRepository subPostFavoriteRepository,
            InteractionTargetCountProjectionPort interactionTargetCountProjectionPort,
            MainPostCollaborationApplicationService mainPostCollaborationApplicationService,
            SubPostCollaborationApplicationService subPostCollaborationApplicationService,
            AuthContextResolver authContextResolver,
            ContentSideEffectPublisher contentSideEffectPublisher
    ) {
        this.mainPostLikeRepository = mainPostLikeRepository;
        this.mainPostFavoriteRepository = mainPostFavoriteRepository;
        this.subPostLikeRepository = subPostLikeRepository;
        this.subPostFavoriteRepository = subPostFavoriteRepository;
        this.interactionTargetCountProjectionPort = interactionTargetCountProjectionPort;
        this.mainPostCollaborationApplicationService = mainPostCollaborationApplicationService;
        this.subPostCollaborationApplicationService = subPostCollaborationApplicationService;
        this.authContextResolver = authContextResolver;
        this.contentSideEffectPublisher = contentSideEffectPublisher;
    }

    @Transactional
    public LikeStatusResponse likeMainPost(Long mainPostId, String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(mainPostId);
        boolean created = insertIfAbsent(() -> mainPostLikeRepository.saveAndFlush(
                new MainPostLike(mainPost.getId(), authContext.username())
        ));
        if (created) {
            mainPost.increaseLikeCount();
            contentSideEffectPublisher.onMainPostLiked(mainPost, authContext.username());
        }
        return new LikeStatusResponse(
                mainPost.getId(),
                interactionTargetCountProjectionPort.loadMainPostLikeCount(mainPost.getId()),
                true
        );
    }

    @Transactional
    public LikeStatusResponse unlikeMainPost(Long mainPostId, String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(mainPostId);
        long removed = mainPostLikeRepository.deleteByMainPostIdAndUsername(mainPost.getId(), authContext.username());
        if (removed > 0) {
            mainPostLikeRepository.flush();
            mainPost.decreaseLikeCount();
            contentSideEffectPublisher.onMainPostUnliked(mainPost, authContext.username());
        }
        return new LikeStatusResponse(
                mainPost.getId(),
                interactionTargetCountProjectionPort.loadMainPostLikeCount(mainPost.getId()),
                false
        );
    }

    @Transactional
    public FavoriteStatusResponse favoriteMainPost(Long mainPostId, String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(mainPostId);
        boolean created = insertIfAbsent(() -> mainPostFavoriteRepository.saveAndFlush(
                new MainPostFavorite(mainPost.getId(), authContext.username())
        ));
        if (created) {
            mainPost.increaseFavoriteCount();
            contentSideEffectPublisher.onMainPostFavorited(mainPost, authContext.username());
        }
        return new FavoriteStatusResponse(
                mainPost.getId(),
                interactionTargetCountProjectionPort.loadMainPostFavoriteCount(mainPost.getId()),
                true
        );
    }

    @Transactional
    public FavoriteStatusResponse unfavoriteMainPost(Long mainPostId, String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(mainPostId);
        long removed = mainPostFavoriteRepository.deleteByMainPostIdAndUsername(mainPost.getId(), authContext.username());
        if (removed > 0) {
            mainPostFavoriteRepository.flush();
            mainPost.decreaseFavoriteCount();
            contentSideEffectPublisher.onMainPostUnfavorited(mainPost, authContext.username());
        }
        return new FavoriteStatusResponse(
                mainPost.getId(),
                interactionTargetCountProjectionPort.loadMainPostFavoriteCount(mainPost.getId()),
                false
        );
    }

    @Transactional
    public LikeStatusResponse likeSubPost(Long subPostId, String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        SubPost subPost = subPostCollaborationApplicationService.requireActiveSubPost(subPostId);
        MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(subPost.getMainPostId());
        boolean created = insertIfAbsent(() -> subPostLikeRepository.saveAndFlush(
                new SubPostLike(subPost.getId(), authContext.username())
        ));
        if (created) {
            subPost.increaseLikeCount();
            contentSideEffectPublisher.onSubPostLiked(mainPost, subPost, authContext.username());
        }
        return new LikeStatusResponse(
                subPost.getId(),
                interactionTargetCountProjectionPort.loadSubPostLikeCount(subPost.getId()),
                true
        );
    }

    @Transactional
    public LikeStatusResponse unlikeSubPost(Long subPostId, String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        SubPost subPost = subPostCollaborationApplicationService.requireActiveSubPost(subPostId);
        long removed = subPostLikeRepository.deleteBySubPostIdAndUsername(subPost.getId(), authContext.username());
        if (removed > 0) {
            subPostLikeRepository.flush();
            subPost.decreaseLikeCount();
            contentSideEffectPublisher.onSubPostUnliked(subPost, authContext.username());
        }
        return new LikeStatusResponse(
                subPost.getId(),
                interactionTargetCountProjectionPort.loadSubPostLikeCount(subPost.getId()),
                false
        );
    }

    @Transactional
    public FavoriteStatusResponse favoriteSubPost(Long subPostId, String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        SubPost subPost = subPostCollaborationApplicationService.requireActiveSubPost(subPostId);
        MainPost mainPost = mainPostCollaborationApplicationService.requireActiveMainPost(subPost.getMainPostId());
        boolean created = insertIfAbsent(() -> subPostFavoriteRepository.saveAndFlush(
                new SubPostFavorite(subPost.getId(), authContext.username())
        ));
        if (created) {
            contentSideEffectPublisher.onSubPostFavorited(mainPost, subPost, authContext.username());
        }
        return new FavoriteStatusResponse(
                subPost.getId(),
                interactionTargetCountProjectionPort.loadSubPostFavoriteCount(subPost.getId()),
                true
        );
    }

    @Transactional
    public FavoriteStatusResponse unfavoriteSubPost(Long subPostId, String authorizationHeader) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        SubPost subPost = subPostCollaborationApplicationService.requireActiveSubPost(subPostId);
        long removed = subPostFavoriteRepository.deleteBySubPostIdAndUsername(subPost.getId(), authContext.username());
        if (removed > 0) {
            subPostFavoriteRepository.flush();
            contentSideEffectPublisher.onSubPostUnfavorited(subPost, authContext.username());
        }
        return new FavoriteStatusResponse(
                subPost.getId(),
                interactionTargetCountProjectionPort.loadSubPostFavoriteCount(subPost.getId()),
                false
        );
    }

    private boolean insertIfAbsent(Runnable inserter) {
        try {
            inserter.run();
            return true;
        } catch (DataIntegrityViolationException ex) {
            return false;
        }
    }
}
