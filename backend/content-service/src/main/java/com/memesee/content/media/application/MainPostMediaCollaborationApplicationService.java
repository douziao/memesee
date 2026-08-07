package com.memesee.content.media.application;

import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.media.dto.MediaAssetResponse;
import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface MainPostMediaCollaborationApplicationService {

    Map<Long, List<MediaAssetResponse>> resolveMainPostMedia(Collection<MainPost> mainPosts);

    Map<Long, List<MediaAssetResponse>> resolveMainPostMediaByIds(Collection<Long> mainPostIds);
}
