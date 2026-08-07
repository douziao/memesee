package com.memesee.content.subpost.application;

import com.memesee.content.subpost.domain.SubPost;

public interface SubPostCollaborationApplicationService {

    SubPost requireActiveSubPost(Long subPostId);
}
