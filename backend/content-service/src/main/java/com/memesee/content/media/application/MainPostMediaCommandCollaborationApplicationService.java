package com.memesee.content.media.application;

import java.util.List;

public interface MainPostMediaCommandCollaborationApplicationService {

    void syncMainPostMedia(Long mainPostId, String ownerUsername, List<Long> mediaAssetIds);

    void clearMainPostMedia(Long mainPostId);
}
