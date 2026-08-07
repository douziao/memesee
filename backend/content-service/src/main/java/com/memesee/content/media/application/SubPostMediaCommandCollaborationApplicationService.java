package com.memesee.content.media.application;

import java.util.List;

public interface SubPostMediaCommandCollaborationApplicationService {

    void syncSubPostMedia(Long subPostId, String ownerUsername, List<Long> mediaAssetIds);

    void clearSubPostMedia(Long subPostId);
}
