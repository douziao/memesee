package com.memesee.content.community.application;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class CommunityCatalogInitializer implements ApplicationRunner {

    private final CommunityApplicationService communityApplicationService;

    public CommunityCatalogInitializer(CommunityApplicationService communityApplicationService) {
        this.communityApplicationService = communityApplicationService;
    }

    @Override
    public void run(ApplicationArguments args) {
        communityApplicationService.ensureDefaultCommunities();
    }
}
