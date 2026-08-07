package com.memesee.content.media.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.common.application.ContentReferenceAvailabilityService;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.common.auth.JwtService;
import com.memesee.content.feed.infrastructure.MainPostFeedItemRepository;
import com.memesee.content.feed.infrastructure.MainPostFeedPageCache;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.application.MediaAssetMetadataProjectionPort.MediaAssetMetadataProjection;
import com.memesee.content.media.domain.MainPostMediaLink;
import com.memesee.content.media.domain.MediaAsset;
import com.memesee.content.media.domain.MediaAssetKind;
import com.memesee.content.media.domain.MediaAssetProcessingStatus;
import com.memesee.content.media.domain.MediaAssetStatus;
import com.memesee.content.media.domain.MediaAssetVariant;
import com.memesee.content.media.domain.MediaAssetVariantKind;
import com.memesee.content.media.domain.SubPostMediaLink;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.media.infrastructure.MainPostMediaCache;
import com.memesee.content.media.infrastructure.MainPostMediaLinkRepository;
import com.memesee.content.media.infrastructure.MediaAssetMetadataCache;
import com.memesee.content.media.infrastructure.MediaAssetRepository;
import com.memesee.content.media.infrastructure.MediaAssetVariantRepository;
import com.memesee.content.media.infrastructure.MediaStorageProperties;
import com.memesee.content.media.infrastructure.MinioMediaStorageService;
import com.memesee.content.media.infrastructure.SubPostMediaCache;
import com.memesee.content.media.infrastructure.SubPostMediaLinkRepository;
import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import io.minio.MinioClient;
import java.util.Collection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@SuppressWarnings("unchecked")
class MediaAssetApplicationServiceTest {

    private final MediaAssetRepository mediaAssetRepository = mock(MediaAssetRepository.class);
    private final MediaAssetMetadataProjectionPort mediaAssetMetadataProjectionPort =
            mock(MediaAssetMetadataProjectionPort.class);
    private final MainPostMediaLinkRepository mainPostMediaLinkRepository = mock(MainPostMediaLinkRepository.class);
    private final SubPostMediaLinkRepository subPostMediaLinkRepository = mock(SubPostMediaLinkRepository.class);
    private final MediaAttachmentProjectionPort mediaAttachmentProjectionPort =
            mock(MediaAttachmentProjectionPort.class);
    private final MinioMediaStorageService minioMediaStorageService = minioMediaStorageService();
    private final MediaAssetVariantRepository mediaAssetVariantRepository = mock(MediaAssetVariantRepository.class);
    private final MainPostRepository mainPostRepository = mock(MainPostRepository.class);
    private final SubPostRepository subPostRepository = mock(SubPostRepository.class);
    private final AuthContextResolver authContextResolver =
            new AuthContextResolver(new JwtService("test-secret-with-at-least-thirty-two-characters"));
    private final MediaAssetMetadataCache mediaAssetMetadataCache = mock(MediaAssetMetadataCache.class);
    private final MainPostMediaCache mainPostMediaCache = mock(MainPostMediaCache.class);
    private final SubPostMediaCache subPostMediaCache = mock(SubPostMediaCache.class);
    private final MainPostFeedItemRepository mainPostFeedItemRepository = mock(MainPostFeedItemRepository.class);
    private final MainPostFeedPageCache mainPostFeedPageCache = mock(MainPostFeedPageCache.class);

    @Test
    @SuppressWarnings("unchecked")
    void resolveMainPostMediaLoadsVariantsInOneBatchForAllMissingAttachments() {
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(any())).thenReturn(List.of(
                mainPost(10L),
                mainPost(11L)
        ));
        when(mainPostMediaCache.getMediaSnapshot(any())).thenCallRealMethod();
        when(mainPostMediaCache.getMedia(10L)).thenReturn(Optional.empty());
        when(mainPostMediaCache.getMedia(11L)).thenReturn(Optional.empty());
        Map<Long, List<MediaAttachmentProjectionPort.MediaAttachmentProjection>> projectedMedia =
                new LinkedHashMap<>();
        projectedMedia.put(10L, List.of(
                attachment(1L, "posts/1/original.jpg"),
                attachment(2L, "posts/2/original.jpg")
        ));
        projectedMedia.put(11L, List.of(attachment(3L, "posts/3/original.jpg")));
        when(mediaAttachmentProjectionPort.loadMainPostMedia(List.of(10L, 11L))).thenReturn(projectedMedia);
        when(mediaAssetVariantRepository.findAllByMediaAssetIdIn(any())).thenReturn(List.of(
                variant(1L, MediaAssetVariantKind.ORIGINAL, "posts/1/original.jpg"),
                variant(1L, MediaAssetVariantKind.DISPLAY, "posts/1/display.webp"),
                variant(2L, MediaAssetVariantKind.ORIGINAL, "posts/2/original.jpg"),
                variant(2L, MediaAssetVariantKind.DISPLAY, "posts/2/display.webp"),
                variant(3L, MediaAssetVariantKind.ORIGINAL, "posts/3/original.jpg"),
                variant(3L, MediaAssetVariantKind.DISPLAY, "posts/3/display.webp")
        ));
        MediaAssetApplicationService service = newService();

        Map<Long, List<MediaAssetResponse>> mediaByPostId = service.resolveMainPostMediaByIds(List.of(10L, 11L));

        assertThat(mediaByPostId).containsOnlyKeys(10L, 11L);
        assertThat(mediaByPostId.get(10L)).extracting(MediaAssetResponse::id).containsExactly(1L, 2L);
        assertThat(mediaByPostId.get(11L)).extracting(MediaAssetResponse::id).containsExactly(3L);
        assertThat(mediaByPostId.get(10L).get(0).displayUrl())
                .startsWith("https://cdn.example.com/posts/1/display.webp?v=");

        ArgumentCaptor<Collection<Long>> assetIdsCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(mediaAssetVariantRepository).findAllByMediaAssetIdIn(assetIdsCaptor.capture());
        assertThat(assetIdsCaptor.getValue()).containsExactly(1L, 2L, 3L);
        verifyNoMoreInteractions(mediaAssetVariantRepository);
    }

    @Test
    void resolveMainPostMediaDropsCachedAttachmentsWhenMainPostIsNoLongerActive() {
        MediaAssetResponse cachedMedia = mediaResponse(7L, "https://cdn.example.com/stale-main-display.webp");
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(any())).thenReturn(List.of());
        when(mainPostMediaCache.getMediaSnapshot(any())).thenCallRealMethod();
        when(mainPostMediaCache.getMedia(42L)).thenReturn(Optional.of(List.of(cachedMedia)));
        MediaAssetApplicationService service = newService();

        Map<Long, List<MediaAssetResponse>> mediaByPostId = service.resolveMainPostMediaByIds(List.of(42L));

        assertThat(mediaByPostId).containsOnlyKeys(42L);
        assertThat(mediaByPostId.get(42L)).isEmpty();
        verify(mainPostMediaCache).evictMedia(42L);
        verify(mediaAttachmentProjectionPort, never()).loadMainPostMedia(any());
    }

    @Test
    void resolveSubPostMediaDropsCachedAttachmentsWhenSubPostParentMainPostIsNoLongerActive() {
        MediaAssetResponse cachedMedia = mediaResponse(8L, "https://cdn.example.com/stale-sub-display.webp");
        when(subPostRepository.findByIdIn(List.of(99L))).thenReturn(List.of(subPost(99L, 42L)));
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(any())).thenReturn(List.of());
        when(subPostMediaCache.getMediaSnapshot(any())).thenCallRealMethod();
        when(subPostMediaCache.getMedia(99L)).thenReturn(Optional.of(List.of(cachedMedia)));
        MediaAssetApplicationService service = newService();

        Map<Long, List<MediaAssetResponse>> mediaBySubPostId = service.resolveSubPostMediaByIds(List.of(99L));

        assertThat(mediaBySubPostId).containsOnlyKeys(99L);
        assertThat(mediaBySubPostId.get(99L)).isEmpty();
        verify(subPostMediaCache).evictMedia(99L);
        verify(mediaAttachmentProjectionPort, never()).loadSubPostMedia(any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void syncMainPostMediaDeduplicatesAssetIdsPreservesOrderAndRefreshesFeedMedia() {
        when(mediaAssetMetadataProjectionPort.loadOwnedActiveMediaAssets(
                eq("alice"),
                any()
        )).thenReturn(List.of(
                projection(3L, "alice"),
                projection(1L, "alice"),
                projection(2L, "alice")
        ));
        when(mediaAttachmentProjectionPort.loadMainPostMedia(List.of(42L))).thenReturn(Map.of(42L, List.of(
                attachment(3L, "posts/3/original.jpg"),
                attachment(1L, "posts/1/original.jpg"),
                attachment(2L, "posts/2/original.jpg")
        )));
        when(mediaAssetVariantRepository.findAllByMediaAssetIdIn(any())).thenReturn(List.of());
        MediaAssetApplicationService service = newService();

        service.syncMainPostMedia(42L, "alice", List.of(3L, 1L, 3L, 2L));

        ArgumentCaptor<Collection<Long>> requestedIdsCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(mediaAssetMetadataProjectionPort).loadOwnedActiveMediaAssets(
                eq("alice"),
                requestedIdsCaptor.capture()
        );
        assertThat(requestedIdsCaptor.getValue()).containsExactly(3L, 1L, 2L);

        ArgumentCaptor<List<MainPostMediaLink>> linksCaptor = ArgumentCaptor.forClass(List.class);
        verify(mainPostMediaLinkRepository).deleteAllByMainPostId(42L);
        verify(mainPostMediaLinkRepository).saveAll(linksCaptor.capture());
        assertThat(linksCaptor.getValue())
                .extracting(MainPostMediaLink::getMediaAssetId)
                .containsExactly(3L, 1L, 2L);
        assertThat(linksCaptor.getValue())
                .extracting(MainPostMediaLink::getSortOrder)
                .containsExactly(0, 1, 2);
        verify(mainPostMediaCache, atLeastOnce()).evictMedia(42L);
        verify(mainPostFeedItemRepository).updateMediaAssetsJson(eq(42L), any());
        verify(mainPostFeedPageCache).evictAllFeedPages();
    }

    @Test
    void syncMainPostMediaRejectsMissingOrForeignAssetsBeforeReplacingLinks() {
        when(mediaAssetMetadataProjectionPort.loadOwnedActiveMediaAssets(
                eq("alice"),
                any()
        )).thenReturn(List.of(projection(1L, "alice")));
        MediaAssetApplicationService service = newService();

        assertThatThrownBy(() -> service.syncMainPostMedia(42L, "alice", List.of(1L, 99L)))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        verify(mainPostMediaLinkRepository, never()).deleteAllByMainPostId(42L);
        verify(mainPostMediaLinkRepository, never()).saveAll(any());
        verify(mainPostMediaCache, never()).evictMedia(42L);
        verify(mainPostFeedItemRepository, never()).updateMediaAssetsJson(any(), any());
    }

    @Test
    void syncSubPostMediaEvictsAttachmentCacheOnlyAfterCommit() {
        when(mediaAssetMetadataProjectionPort.loadOwnedActiveMediaAssets(
                eq("alice"),
                any()
        )).thenReturn(List.of(projection(7L, "alice")));
        MediaAssetApplicationService service = newService();

        runWithManualTransactionSynchronization(() -> {
            service.syncSubPostMedia(99L, "alice", List.of(7L));

            ArgumentCaptor<List<SubPostMediaLink>> linksCaptor = ArgumentCaptor.forClass(List.class);
            verify(subPostMediaLinkRepository).deleteAllBySubPostId(99L);
            verify(subPostMediaLinkRepository).saveAll(linksCaptor.capture());
            assertThat(linksCaptor.getValue()).extracting(SubPostMediaLink::getMediaAssetId).containsExactly(7L);
            verify(subPostMediaCache, never()).evictMedia(99L);

            triggerAfterCommit();

            verify(subPostMediaCache).evictMedia(99L);
        });
    }

    @Test
    void syncSubPostMediaCachesEmptyAttachmentListOnlyAfterCommit() {
        MediaAssetApplicationService service = newService();

        runWithManualTransactionSynchronization(() -> {
            service.syncSubPostMedia(99L, "alice", List.of());

            verify(subPostMediaLinkRepository).deleteAllBySubPostId(99L);
            verify(subPostMediaCache, never()).putMedia(eq(99L), any());

            triggerAfterCommit();

            verify(subPostMediaCache).putMedia(99L, List.of());
        });
    }

    @Test
    void retryMediaVariantProcessingEvictsMetadataCacheOnlyAfterCommit() {
        MediaAsset asset = mediaAsset(7L);
        when(mediaAssetRepository.findByIdAndStatus(7L, MediaAssetStatus.ACTIVE)).thenReturn(Optional.of(asset));
        MediaAssetApplicationService service = newService();

        runWithManualTransactionSynchronization(() -> {
            service.retryMediaVariantProcessing(7L);

            assertThat(asset.getProcessingStatus()).isEqualTo(MediaAssetProcessingStatus.PROCESSING);
            verify(mediaAssetMetadataCache, never()).evictMediaAsset(7L);

            triggerAfterCommit();

            verify(mediaAssetMetadataCache).evictMediaAsset(7L);
        });
    }

    @Test
    void retryMediaVariantProcessingRejectsInvalidAssetId() {
        MediaAssetApplicationService service = newService();

        assertThatThrownBy(() -> service.retryMediaVariantProcessing(0L))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        verify(mediaAssetRepository, never()).findByIdAndStatus(any(), any());
        verify(mediaAssetMetadataCache, never()).evictMediaAsset(any());
    }

    @Test
    void retryFailedMediaVariantProcessingResetsFailedAssetsAndPublishesWithinSafeLimit() {
        MediaAsset asset7 = mediaAsset(7L);
        MediaAsset asset8 = mediaAsset(8L);
        MediaAsset asset9 = mediaAsset(9L);
        when(mediaAssetRepository.findTop100ByStatusAndProcessingStatusOrderByIdAsc(
                MediaAssetStatus.ACTIVE,
                MediaAssetProcessingStatus.FAILED
        )).thenReturn(List.of(asset7, asset8, asset9));
        RecordingMediaVariantProcessingPublisher publisher = new RecordingMediaVariantProcessingPublisher();
        MediaAssetApplicationService service = newService(Optional.of(publisher));

        List<Long> retriedAssetIds = service.retryFailedMediaVariantProcessing(2);

        assertThat(retriedAssetIds).containsExactly(7L, 8L);
        assertThat(asset7.getProcessingStatus()).isEqualTo(MediaAssetProcessingStatus.PROCESSING);
        assertThat(asset8.getProcessingStatus()).isEqualTo(MediaAssetProcessingStatus.PROCESSING);
        assertThat(asset9.getProcessingStatus()).isEqualTo(MediaAssetProcessingStatus.FAILED);
        assertThat(publisher.publishedAssetIds).containsExactly(7L, 8L);
        verify(mediaAssetMetadataCache).evictMediaAsset(7L);
        verify(mediaAssetMetadataCache).evictMediaAsset(8L);
        verify(mediaAssetMetadataCache, never()).evictMediaAsset(9L);
    }

    private MediaAssetApplicationService newService() {
        return newService(Optional.empty());
    }

    private MediaAssetApplicationService newService(Optional<MediaVariantProcessingPublisher> publisher) {
        return new MediaAssetApplicationService(
                mediaAssetRepository,
                mediaAssetMetadataProjectionPort,
                mainPostMediaLinkRepository,
                subPostMediaLinkRepository,
                mediaAttachmentProjectionPort,
                minioMediaStorageService,
                mediaAssetVariantRepository,
                new ContentReferenceAvailabilityService(mainPostRepository, subPostRepository),
                authContextResolver,
                mediaAssetMetadataCache,
                mainPostMediaCache,
                subPostMediaCache,
                mainPostFeedItemRepository,
                mainPostFeedPageCache,
                new ObjectMapper(),
                new TransactionTemplate(new NoOpTransactionManager()),
                publisher,
                new PlatformAsyncRefreshCoordinator()
        );
    }

    private MinioMediaStorageService minioMediaStorageService() {
        MediaStorageProperties properties = new MediaStorageProperties();
        properties.getMinio().setDirectDeliveryEnabled(true);
        properties.getMinio().setPublicBaseUrl("https://cdn.example.com");
        return new MinioMediaStorageService(
                MinioClient.builder()
                        .endpoint("http://127.0.0.1:9000")
                        .credentials("minioadmin", "minioadmin")
                        .build(),
                properties,
                20 * 1024 * 1024
        );
    }

    private MediaAttachmentProjectionPort.MediaAttachmentProjection attachment(Long assetId, String objectKey) {
        return new MediaAttachmentProjectionPort.MediaAttachmentProjection(
                assetId,
                "asset-" + assetId,
                "IMAGE",
                "bucket",
                objectKey,
                "image/jpeg",
                "image-" + assetId + ".jpg",
                1024L,
                "READY",
                ""
        );
    }

    private MediaAssetMetadataProjection projection(Long assetId, String ownerUsername) {
        return new MediaAssetMetadataProjection(
                assetId,
                "asset-" + assetId,
                ownerUsername,
                MediaAssetKind.IMAGE,
                "bucket",
                "posts/" + assetId + "/original.jpg",
                "image-" + assetId + ".jpg",
                "image/jpeg",
                1024L,
                "READY",
                ""
        );
    }

    private MediaAssetVariant variant(Long assetId, MediaAssetVariantKind kind, String objectKey) {
        return new MediaAssetVariant(
                assetId,
                kind,
                "bucket",
                objectKey,
                kind == MediaAssetVariantKind.ORIGINAL ? "image/jpeg" : "image/webp",
                kind == MediaAssetVariantKind.ORIGINAL ? 1024L : 512L,
                640,
                480
        );
    }

    private MediaAssetResponse mediaResponse(Long assetId, String displayUrl) {
        return new MediaAssetResponse(
                assetId,
                "asset-" + assetId,
                "IMAGE",
                displayUrl,
                displayUrl,
                displayUrl,
                displayUrl,
                displayUrl,
                displayUrl,
                "image/webp",
                "image-" + assetId + ".webp",
                512L,
                640,
                480,
                "READY",
                "",
                List.of()
        );
    }

    private MainPost mainPost(Long id) {
        MainPost mainPost = new MainPost(10L, "alice", "title", "content");
        writeField(mainPost, "id", id);
        return mainPost;
    }

    private SubPost subPost(Long id, Long mainPostId) {
        SubPost subPost = new SubPost(mainPostId, null, "alice", "content");
        writeField(subPost, "id", id);
        return subPost;
    }

    private MediaAsset mediaAsset(Long assetId) {
        MediaAsset asset = new MediaAsset(
                "alice",
                MediaAssetKind.IMAGE,
                "bucket",
                "posts/" + assetId + "/original.jpg",
                "image-" + assetId + ".jpg",
                "image/jpeg",
                1024L,
                MediaAssetStatus.ACTIVE,
                MediaAssetProcessingStatus.FAILED
        );
        writeField(asset, "id", assetId);
        return asset;
    }

    private void runWithManualTransactionSynchronization(Runnable action) {
        TransactionSynchronizationManager.initSynchronization();
        try {
            action.run();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private void triggerAfterCommit() {
        List<TransactionSynchronization> synchronizations = TransactionSynchronizationManager.getSynchronizations();
        synchronizations.forEach(TransactionSynchronization::afterCommit);
    }

    private static void writeField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError("Unable to set field " + fieldName, exception);
        }
    }

    private static class NoOpTransactionManager implements org.springframework.transaction.PlatformTransactionManager {
        @Override
        public org.springframework.transaction.TransactionStatus getTransaction(
                org.springframework.transaction.TransactionDefinition definition
        ) {
            return new org.springframework.transaction.support.SimpleTransactionStatus();
        }

        @Override
        public void commit(org.springframework.transaction.TransactionStatus status) {
        }

        @Override
        public void rollback(org.springframework.transaction.TransactionStatus status) {
        }
    }

    private static class RecordingMediaVariantProcessingPublisher implements MediaVariantProcessingPublisher {

        private final List<Long> publishedAssetIds = new ArrayList<>();

        @Override
        public void publish(Long assetId) {
            publishedAssetIds.add(assetId);
        }
    }
}
