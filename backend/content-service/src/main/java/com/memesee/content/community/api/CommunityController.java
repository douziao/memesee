package com.memesee.content.community.api;


import com.memesee.content.community.dto.CommunityResponse;
import com.memesee.content.community.application.CommunityApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/communities")
public class CommunityController {

    private final CommunityApplicationService communityApplicationService;

    public CommunityController(CommunityApplicationService communityApplicationService) {
        this.communityApplicationService = communityApplicationService;
    }

    @GetMapping
    public List<CommunityResponse> listCommunities() {
        return communityApplicationService.listCommunities();
    }

    @GetMapping("/{communitySlug}")
    public CommunityResponse getCommunity(@PathVariable String communitySlug) {
        return communityApplicationService.getCommunity(communitySlug);
    }
}
