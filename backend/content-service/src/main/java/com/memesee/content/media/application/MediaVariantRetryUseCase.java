package com.memesee.content.media.application;

import java.util.List;

public interface MediaVariantRetryUseCase {

    void retryMediaVariantProcessing(Long assetId);

    List<Long> retryFailedMediaVariantProcessing(int limit);
}
