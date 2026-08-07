package com.memesee.content.mainpost.application;

import com.memesee.content.common.application.ContentCacheInvalidationCoordinator;
import com.memesee.content.feed.infrastructure.MainPostFeedItemRepository;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class MainPostViewCountBuffer {

    private static final Logger log = LoggerFactory.getLogger(MainPostViewCountBuffer.class);
    private static final String VIEW_DELTA_KEY = "content:main-post:view-deltas";

    private final StringRedisTemplate redisTemplate;
    private final MainPostRepository mainPostRepository;
    private final MainPostFeedItemRepository mainPostFeedItemRepository;
    private final ContentCacheInvalidationCoordinator cacheInvalidationCoordinator;
    private final TransactionTemplate transactionTemplate;

    public MainPostViewCountBuffer(
            StringRedisTemplate redisTemplate,
            MainPostRepository mainPostRepository,
            MainPostFeedItemRepository mainPostFeedItemRepository,
            ContentCacheInvalidationCoordinator cacheInvalidationCoordinator,
            PlatformTransactionManager transactionManager
    ) {
        this.redisTemplate = redisTemplate;
        this.mainPostRepository = mainPostRepository;
        this.mainPostFeedItemRepository = mainPostFeedItemRepository;
        this.cacheInvalidationCoordinator = cacheInvalidationCoordinator;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public void recordView(Long mainPostId) {
        if (mainPostId == null || mainPostId <= 0L) {
            return;
        }
        try {
            redisTemplate.opsForHash().increment(VIEW_DELTA_KEY, String.valueOf(mainPostId), 1L);
        } catch (RuntimeException error) {
            log.warn("main_post_view_count_buffer_record_failed mainPostId={}", mainPostId, error);
        }
    }

    @Scheduled(fixedDelayString = "${app.main-post.view-count-buffer.flush-delay-ms:3000}")
    public void flushBufferedViews() {
        Map<Object, Object> entries;
        try {
            entries = redisTemplate.opsForHash().entries(VIEW_DELTA_KEY);
        } catch (RuntimeException error) {
            log.warn("main_post_view_count_buffer_read_failed", error);
            return;
        }
        if (entries == null || entries.isEmpty()) {
            return;
        }
        boolean flushedAny = false;
        for (Map.Entry<Object, Object> entry : entries.entrySet()) {
            flushedAny = flushOne(entry.getKey(), entry.getValue()) || flushedAny;
        }
        if (flushedAny) {
            evictFeedPageCacheAfterViewFlush();
        }
    }

    private boolean flushOne(Object rawMainPostId, Object rawDelta) {
        Long mainPostId = parseLong(rawMainPostId);
        Long parsedDelta = parseLong(rawDelta);
        long delta = parsedDelta == null ? 0L : Math.max(0L, parsedDelta);
        if (mainPostId == null || mainPostId <= 0L || delta <= 0L) {
            return false;
        }
        try {
            Boolean updated = transactionTemplate.execute(status -> {
                int mainPostUpdates = mainPostRepository.incrementViewStats(mainPostId, delta);
                int feedItemUpdates = mainPostFeedItemRepository.incrementViewStats(mainPostId, delta);
                return mainPostUpdates > 0 || feedItemUpdates > 0;
            });
            Long remaining = redisTemplate.opsForHash().increment(VIEW_DELTA_KEY, String.valueOf(mainPostId), -delta);
            if (remaining != null && remaining <= 0L) {
                redisTemplate.opsForHash().delete(VIEW_DELTA_KEY, String.valueOf(mainPostId));
            }
            return Boolean.TRUE.equals(updated);
        } catch (RuntimeException error) {
            log.warn(
                    "main_post_view_count_buffer_flush_failed mainPostId={} delta={}",
                    mainPostId,
                    delta,
                    error
            );
            return false;
        }
    }

    private void evictFeedPageCacheAfterViewFlush() {
        try {
            cacheInvalidationCoordinator.onMainPostViewStatsFlushed();
        } catch (RuntimeException error) {
            log.warn("main_post_cache_invalidation_after_view_flush_failed", error);
        }
    }

    private Long parseLong(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException error) {
            return null;
        }
    }
}
