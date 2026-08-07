package com.memesee.content.media.application;

import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.subpost.domain.SubPost;
import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface SubPostMediaCollaborationApplicationService {

    Map<Long, List<MediaAssetResponse>> resolveSubPostMedia(Collection<SubPost> subPosts);

    Map<Long, List<MediaAssetResponse>> resolveSubPostMediaByIds(Collection<Long> subPostIds);
}
