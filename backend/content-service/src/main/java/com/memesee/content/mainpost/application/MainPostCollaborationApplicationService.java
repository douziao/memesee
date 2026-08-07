package com.memesee.content.mainpost.application;

import com.memesee.content.mainpost.domain.MainPost;

public interface MainPostCollaborationApplicationService {

    MainPost requireActiveMainPost(Long mainPostId);
}
