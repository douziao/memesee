package com.memesee.content.mainpost.api;


import com.memesee.content.mainpost.dto.CreateMainPostRequest;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import com.memesee.content.mainpost.dto.UpdateMainPostRequest;
import com.memesee.content.feed.application.MainPostFeedQueryApplicationService;
import com.memesee.content.feed.dto.FeedPageResponse;
import com.memesee.content.mainpost.application.MainPostCommandApplicationService;
import com.memesee.content.mainpost.application.MainPostQueryApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class MainPostController {

    private final MainPostQueryApplicationService mainPostQueryApplicationService;
    private final MainPostFeedQueryApplicationService mainPostFeedQueryApplicationService;
    private final MainPostCommandApplicationService mainPostCommandApplicationService;

    public MainPostController(
            MainPostQueryApplicationService mainPostQueryApplicationService,
            MainPostFeedQueryApplicationService mainPostFeedQueryApplicationService,
            MainPostCommandApplicationService mainPostCommandApplicationService
    ) {
        this.mainPostQueryApplicationService = mainPostQueryApplicationService;
        this.mainPostFeedQueryApplicationService = mainPostFeedQueryApplicationService;
        this.mainPostCommandApplicationService = mainPostCommandApplicationService;
    }

    @GetMapping("/me/main-posts")
    public FeedPageResponse<MainPostSummaryResponse> listMyMainPosts(
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer size,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return mainPostFeedQueryApplicationService.listMyMainPosts(
                cursor,
                size,
                authorizationHeader
        );
    }

    @GetMapping("/main-posts/{mainPostId}")
    public MainPostDetailResponse getMainPost(
            @PathVariable Long mainPostId,
            @RequestParam(defaultValue = "true") boolean trackView,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return mainPostQueryApplicationService.getMainPost(mainPostId, authorizationHeader, trackView);
    }

    @PostMapping("/main-posts")
    public ResponseEntity<MainPostDetailResponse> createMainPost(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @Valid @RequestBody CreateMainPostRequest request
    ) {
        MainPostDetailResponse response = mainPostCommandApplicationService.createMainPost(authorizationHeader, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/main-posts/{mainPostId}")
    public MainPostDetailResponse updateMainPost(
            @PathVariable Long mainPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @Valid @RequestBody UpdateMainPostRequest request
    ) {
        return mainPostCommandApplicationService.updateMainPost(mainPostId, authorizationHeader, request);
    }

    @DeleteMapping("/main-posts/{mainPostId}")
    public ResponseEntity<Void> deleteMainPost(
            @PathVariable Long mainPostId,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        mainPostCommandApplicationService.deleteMainPost(mainPostId, authorizationHeader);
        return ResponseEntity.noContent().build();
    }
}
