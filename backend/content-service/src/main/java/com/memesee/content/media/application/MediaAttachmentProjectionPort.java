package com.memesee.content.media.application;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface MediaAttachmentProjectionPort {

    Map<Long, List<MediaAttachmentProjection>> loadMainPostMedia(Collection<Long> mainPostIds);

    Map<Long, List<MediaAttachmentProjection>> loadSubPostMedia(Collection<Long> subPostIds);

    record MediaAttachmentProjection(
            Long assetId,
            String publicId,
            String kind,
            String bucketName,
            String objectKey,
            String contentType,
            String originalFilename,
            long sizeBytes,
            String processingStatus,
            String blurDataUrl
    ) {
    }
}
