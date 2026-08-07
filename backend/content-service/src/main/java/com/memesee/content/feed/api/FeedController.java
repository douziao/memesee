package com.memesee.content.feed.api;

import com.memesee.content.feed.application.MainPostFeedQueryApplicationService;
import com.memesee.content.feed.dto.FeedMainPostSummaryResponse;
import com.memesee.content.feed.dto.FeedPageResponse;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import java.util.Objects;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feed")
public class FeedController {

    private final MainPostFeedQueryApplicationService feedQueryApplicationService;

    public FeedController(MainPostFeedQueryApplicationService feedQueryApplicationService) {
        this.feedQueryApplicationService = feedQueryApplicationService;
    }

    @GetMapping
    public FeedPageResponse<FeedMainPostSummaryResponse> listFeed(
            @RequestParam(required = false) String communitySlug,
            @RequestParam(name = "q", required = false) String keyword,
            @RequestParam(name = "sort", required = false) String sortMode,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer size,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        FeedPageResponse<MainPostSummaryResponse> response = feedQueryApplicationService.listFeed(
                communitySlug,
                keyword,
                sortMode,
                cursor,
                size,
                authorizationHeader
        );
        return new FeedPageResponse<>(
                response.posts().stream()
                        .map(FeedMainPostSummaryResponse::from)
                        .filter(Objects::nonNull)
                        .toList(),
                response.nextCursor(),
                response.hasMore()
        );
    }
}
