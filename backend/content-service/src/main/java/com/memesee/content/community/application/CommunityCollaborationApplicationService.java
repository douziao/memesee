package com.memesee.content.community.application;

import com.memesee.content.community.domain.Community;
import java.util.Collection;
import java.util.Map;

public interface CommunityCollaborationApplicationService {

    Community requireCommunityBySlug(String communitySlug);

    Community requireCommunityById(Long communityId);

    Map<Long, Community> loadCommunities(Collection<Long> communityIds);
}
