package com.memesee.content.feed.application;

import com.memesee.content.community.application.CommunityCollaborationApplicationService;
import com.memesee.content.community.domain.Community;
import org.springframework.stereotype.Component;

@Component
public class MainPostFeedProjectionSupport {

    private final CommunityCollaborationApplicationService communityCollaborationApplicationService;

    public MainPostFeedProjectionSupport(
            CommunityCollaborationApplicationService communityCollaborationApplicationService
    ) {
        this.communityCollaborationApplicationService = communityCollaborationApplicationService;
    }

    public Community requireCommunityById(Long communityId) {
        return communityCollaborationApplicationService.requireCommunityById(communityId);
    }
}
