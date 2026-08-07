package com.memesee.content.interaction.api;


import com.memesee.content.interaction.dto.FavoriteStatusResponse;
import com.memesee.content.interaction.dto.LikeStatusResponse;
import com.memesee.content.interaction.dto.MyInteractionListResponse;
import com.memesee.content.interaction.application.InteractionCommandApplicationService;
import com.memesee.content.interaction.application.InteractionQueryApplicationService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class InteractionController {

    private final InteractionQueryApplicationService interactionQueryApplicationService;
    private final InteractionCommandApplicationService interactionCommandApplicationService;

    public InteractionController(
            InteractionQueryApplicationService interactionQueryApplicationService,
            InteractionCommandApplicationService interactionCommandApplicationService
    ) {
        this.interactionQueryApplicationService = interactionQueryApplicationService;
        this.interactionCommandApplicationService = interactionCommandApplicationService;
    }

    @GetMapping("/me/interactions")
    public MyInteractionListResponse listMyInteractions(
            @RequestParam(required = false) Integer limit,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionQueryApplicationService.listMyInteractions(authorizationHeader, limit);
    }

    @PostMapping("/main-posts/{mainPostId}/likes")
    public LikeStatusResponse likeMainPost(
            @PathVariable Long mainPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionCommandApplicationService.likeMainPost(mainPostId, authorizationHeader);
    }

    @DeleteMapping("/main-posts/{mainPostId}/likes")
    public LikeStatusResponse unlikeMainPost(
            @PathVariable Long mainPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionCommandApplicationService.unlikeMainPost(mainPostId, authorizationHeader);
    }

    @PostMapping("/main-posts/{mainPostId}/favorites")
    public FavoriteStatusResponse favoriteMainPost(
            @PathVariable Long mainPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionCommandApplicationService.favoriteMainPost(mainPostId, authorizationHeader);
    }

    @DeleteMapping("/main-posts/{mainPostId}/favorites")
    public FavoriteStatusResponse unfavoriteMainPost(
            @PathVariable Long mainPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionCommandApplicationService.unfavoriteMainPost(mainPostId, authorizationHeader);
    }

    @PostMapping("/sub-posts/{subPostId}/likes")
    public LikeStatusResponse likeSubPost(
            @PathVariable Long subPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionCommandApplicationService.likeSubPost(subPostId, authorizationHeader);
    }

    @DeleteMapping("/sub-posts/{subPostId}/likes")
    public LikeStatusResponse unlikeSubPost(
            @PathVariable Long subPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionCommandApplicationService.unlikeSubPost(subPostId, authorizationHeader);
    }

    @PostMapping("/sub-posts/{subPostId}/favorites")
    public FavoriteStatusResponse favoriteSubPost(
            @PathVariable Long subPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionCommandApplicationService.favoriteSubPost(subPostId, authorizationHeader);
    }

    @DeleteMapping("/sub-posts/{subPostId}/favorites")
    public FavoriteStatusResponse unfavoriteSubPost(
            @PathVariable Long subPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return interactionCommandApplicationService.unfavoriteSubPost(subPostId, authorizationHeader);
    }
}
