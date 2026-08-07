package com.memesee.content.media.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.common.application.ContentReferenceAvailabilityService;
import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.feed.infrastructure.MainPostFeedItemRepository;
import com.memesee.content.feed.infrastructure.MainPostFeedPageCache;
import com.memesee.content.media.application.MediaAssetMetadataProjectionPort.MediaAssetMetadataProjection;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.media.dto.MediaAssetVariantResponse;
import com.memesee.content.media.domain.MainPostMediaLink;
import com.memesee.content.media.domain.MediaAsset;
import com.memesee.content.media.domain.MediaAssetKind;
import com.memesee.content.media.domain.MediaAssetProcessingStatus;
import com.memesee.content.media.domain.MediaAssetStatus;
import com.memesee.content.media.domain.MediaAssetVariant;
import com.memesee.content.media.domain.MediaAssetVariantKind;
import com.memesee.content.media.domain.MediaLinkRole;
import com.memesee.content.media.domain.SubPostMediaLink;
import com.memesee.content.media.infrastructure.MediaAssetVariantRepository;
import com.memesee.content.media.infrastructure.MainPostMediaCache;
import com.memesee.content.media.infrastructure.MainPostMediaLinkRepository;
import com.memesee.content.media.infrastructure.MediaAssetMetadataCache;
import com.memesee.content.media.infrastructure.MediaAssetRepository;
import com.memesee.content.media.infrastructure.MinioMediaStorageService;
import com.memesee.content.media.infrastructure.SubPostMediaLinkRepository;
import com.memesee.content.media.infrastructure.SubPostMediaCache;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import com.memesee.platform.cache.PlatformSingleFlight;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaAssetApplicationService
        implements MainPostMediaCollaborationApplicationService,
        MainPostMediaCommandCollaborationApplicationService,
        SubPostMediaCollaborationApplicationService,
        SubPostMediaCommandCollaborationApplicationService,
        MediaVariantRetryUseCase {

    private static final Logger log = LoggerFactory.getLogger(MediaAssetApplicationService.class);

    private final MediaAssetRepository mediaAssetRepository;
    private final MediaAssetMetadataProjectionPort mediaAssetMetadataProjectionPort;
    private final MainPostMediaLinkRepository mainPostMediaLinkRepository;
    private final SubPostMediaLinkRepository subPostMediaLinkRepository;
    private final MediaAttachmentProjectionPort mediaAttachmentProjectionPort;
    private final MinioMediaStorageService minioMediaStorageService;
    private final MediaAssetVariantRepository mediaAssetVariantRepository;
    private final ContentReferenceAvailabilityService referenceAvailabilityService;
    private final AuthContextResolver authContextResolver;
    private final MediaAssetMetadataCache mediaAssetMetadataCache;
    private final MainPostMediaCache mainPostMediaCache;
    private final SubPostMediaCache subPostMediaCache;
    private final MainPostFeedItemRepository mainPostFeedItemRepository;
    private final MainPostFeedPageCache mainPostFeedPageCache;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final Optional<MediaVariantProcessingPublisher> mediaVariantProcessingPublisher;
    private final PlatformSingleFlight mediaAssetMetadataLoadSingleFlight = new PlatformSingleFlight();
    private final PlatformSingleFlight mainPostMediaLoadSingleFlight = new PlatformSingleFlight();
    private final PlatformSingleFlight subPostMediaLoadSingleFlight = new PlatformSingleFlight();
    private final PlatformAsyncRefreshCoordinator asyncRefreshCoordinator;

    @Autowired
    public MediaAssetApplicationService(
            MediaAssetRepository mediaAssetRepository,
            MediaAssetMetadataProjectionPort mediaAssetMetadataProjectionPort,
            MainPostMediaLinkRepository mainPostMediaLinkRepository,
            SubPostMediaLinkRepository subPostMediaLinkRepository,
            MediaAttachmentProjectionPort mediaAttachmentProjectionPort,
            MinioMediaStorageService minioMediaStorageService,
            MediaAssetVariantRepository mediaAssetVariantRepository,
            ContentReferenceAvailabilityService referenceAvailabilityService,
            AuthContextResolver authContextResolver,
            MediaAssetMetadataCache mediaAssetMetadataCache,
            MainPostMediaCache mainPostMediaCache,
            SubPostMediaCache subPostMediaCache,
            MainPostFeedItemRepository mainPostFeedItemRepository,
            MainPostFeedPageCache mainPostFeedPageCache,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager,
            Optional<MediaVariantProcessingPublisher> mediaVariantProcessingPublisher
    ) {
        this(
                mediaAssetRepository,
                mediaAssetMetadataProjectionPort,
                mainPostMediaLinkRepository,
                subPostMediaLinkRepository,
                mediaAttachmentProjectionPort,
                minioMediaStorageService,
                mediaAssetVariantRepository,
                referenceAvailabilityService,
                authContextResolver,
                mediaAssetMetadataCache,
                mainPostMediaCache,
                subPostMediaCache,
                mainPostFeedItemRepository,
                mainPostFeedPageCache,
                objectMapper,
                newRequiresNewTransactionTemplate(transactionManager),
                mediaVariantProcessingPublisher,
                new PlatformAsyncRefreshCoordinator()
        );
    }

    MediaAssetApplicationService(
            MediaAssetRepository mediaAssetRepository,
            MediaAssetMetadataProjectionPort mediaAssetMetadataProjectionPort,
            MainPostMediaLinkRepository mainPostMediaLinkRepository,
            SubPostMediaLinkRepository subPostMediaLinkRepository,
            MediaAttachmentProjectionPort mediaAttachmentProjectionPort,
            MinioMediaStorageService minioMediaStorageService,
            MediaAssetVariantRepository mediaAssetVariantRepository,
            ContentReferenceAvailabilityService referenceAvailabilityService,
            AuthContextResolver authContextResolver,
            MediaAssetMetadataCache mediaAssetMetadataCache,
            MainPostMediaCache mainPostMediaCache,
            SubPostMediaCache subPostMediaCache,
            MainPostFeedItemRepository mainPostFeedItemRepository,
            MainPostFeedPageCache mainPostFeedPageCache,
            ObjectMapper objectMapper,
            TransactionTemplate transactionTemplate,
            Optional<MediaVariantProcessingPublisher> mediaVariantProcessingPublisher,
            PlatformAsyncRefreshCoordinator asyncRefreshCoordinator
    ) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.mediaAssetMetadataProjectionPort = mediaAssetMetadataProjectionPort;
        this.mainPostMediaLinkRepository = mainPostMediaLinkRepository;
        this.subPostMediaLinkRepository = subPostMediaLinkRepository;
        this.mediaAttachmentProjectionPort = mediaAttachmentProjectionPort;
        this.minioMediaStorageService = minioMediaStorageService;
        this.mediaAssetVariantRepository = mediaAssetVariantRepository;
        this.referenceAvailabilityService = referenceAvailabilityService;
        this.authContextResolver = authContextResolver;
        this.mediaAssetMetadataCache = mediaAssetMetadataCache;
        this.mainPostMediaCache = mainPostMediaCache;
        this.subPostMediaCache = subPostMediaCache;
        this.mainPostFeedItemRepository = mainPostFeedItemRepository;
        this.mainPostFeedPageCache = mainPostFeedPageCache;
        this.objectMapper = objectMapper;
        this.transactionTemplate = transactionTemplate;
        this.mediaVariantProcessingPublisher =
                mediaVariantProcessingPublisher == null ? Optional.empty() : mediaVariantProcessingPublisher;
        this.asyncRefreshCoordinator = asyncRefreshCoordinator;
    }

    @Transactional
    public MediaAssetResponse uploadImage(String authorizationHeader, MultipartFile file) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "请选择要上传的图片。");
        }
        byte[] originalBytes;
        try {
            originalBytes = file.getBytes();
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "图片读取失败。", ex);
        }
        MinioMediaStorageService.StoredMediaObject storedMediaObject = minioMediaStorageService.storeImageBytes(
                originalBytes,
                file.getOriginalFilename(),
                file.getContentType()
        );
        MediaAsset asset = mediaAssetRepository.save(new MediaAsset(
                authContext.username(),
                MediaAssetKind.IMAGE,
                storedMediaObject.bucketName(),
                storedMediaObject.objectKey(),
                storedMediaObject.originalFilename(),
                storedMediaObject.contentType(),
                storedMediaObject.sizeBytes(),
                MediaAssetStatus.ACTIVE,
                MediaAssetProcessingStatus.PROCESSING
        ));
        publishVariantProcessing(asset.getId());
        MediaAssetResponse response = toResponse(asset);
        putMediaAssetCacheAfterCommit(response);
        return response;
    }

    @Transactional(readOnly = true)
    public MediaAssetResponse getMediaAsset(Long assetId) {
        PlatformCacheReadResult<MediaAssetResponse> cachedSnapshot = mediaAssetMetadataCache.getMediaAssetSnapshot(assetId);
        if (cachedSnapshot.value().isPresent()) {
            MediaAssetResponse cachedResponse = cachedSnapshot.value().orElseThrow();
            triggerAsyncMediaAssetMetadataRefreshIfStale(assetId, cachedSnapshot);
            return cachedResponse;
        }
        if (cachedSnapshot.handled()) {
            throw mediaAssetNotFound();
        }
        return mediaAssetMetadataLoadSingleFlight.execute(
                "media-asset-metadata:" + assetId,
                () -> loadMediaAssetMetadata(assetId).orElseThrow(this::mediaAssetNotFound),
                mediaAssetMetadataCache::recordRequestMerge
        );
    }

    @Transactional
    public void retryMediaVariantProcessing(Long assetId) {
        if (assetId == null || assetId <= 0L) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "媒体资产 ID 无效。");
        }
        MediaAsset asset = mediaAssetRepository.findByIdAndStatus(assetId, MediaAssetStatus.ACTIVE)
                .orElseThrow(this::mediaAssetNotFound);
        asset.markProcessing();
        evictMediaAssetCacheAfterCommit(assetId);
        publishVariantProcessing(assetId);
    }

    @Transactional
    public List<Long> retryFailedMediaVariantProcessing(int limit) {
        int safeLimit = Math.max(1, Math.min(100, limit <= 0 ? 20 : limit));
        List<MediaAsset> failedAssets = mediaAssetRepository
                .findTop100ByStatusAndProcessingStatusOrderByIdAsc(
                        MediaAssetStatus.ACTIVE,
                        MediaAssetProcessingStatus.FAILED
                )
                .stream()
                .limit(safeLimit)
                .toList();
        failedAssets.forEach(asset -> {
            asset.markProcessing();
            evictMediaAssetCacheAfterCommit(asset.getId());
            publishVariantProcessing(asset.getId());
        });
        return failedAssets.stream().map(MediaAsset::getId).toList();
    }

    @Transactional
    public void syncMainPostMedia(Long mainPostId, String ownerUsername, List<Long> mediaAssetIds) {
        List<MediaAssetMetadataProjection> assets = requireOwnedAssets(ownerUsername, mediaAssetIds);
        mainPostMediaLinkRepository.deleteAllByMainPostId(mainPostId);
        if (assets.isEmpty()) {
            mainPostMediaLinkRepository.flush();
            putMainPostMediaCacheAfterCommit(mainPostId, List.of());
            refreshMainPostFeedMediaAfterCommit(List.of(mainPostId));
            return;
        }
        List<MainPostMediaLink> links = new ArrayList<>();
        for (int i = 0; i < assets.size(); i++) {
            links.add(new MainPostMediaLink(mainPostId, assets.get(i).assetId(), i, MediaLinkRole.ATTACHMENT));
        }
        mainPostMediaLinkRepository.saveAll(links);
        mainPostMediaLinkRepository.flush();
        evictMainPostMediaCacheAfterCommit(mainPostId);
        refreshMainPostFeedMediaAfterCommit(List.of(mainPostId));
    }

    @Transactional
    public void syncSubPostMedia(Long subPostId, String ownerUsername, List<Long> mediaAssetIds) {
        List<MediaAssetMetadataProjection> assets = requireOwnedAssets(ownerUsername, mediaAssetIds);
        subPostMediaLinkRepository.deleteAllBySubPostId(subPostId);
        if (assets.isEmpty()) {
            subPostMediaLinkRepository.flush();
            putSubPostMediaCacheAfterCommit(subPostId, List.of());
            return;
        }
        List<SubPostMediaLink> links = new ArrayList<>();
        for (int i = 0; i < assets.size(); i++) {
            links.add(new SubPostMediaLink(subPostId, assets.get(i).assetId(), i, MediaLinkRole.ATTACHMENT));
        }
        subPostMediaLinkRepository.saveAll(links);
        subPostMediaLinkRepository.flush();
        evictSubPostMediaCacheAfterCommit(subPostId);
    }

    @Transactional
    public void clearMainPostMedia(Long mainPostId) {
        mainPostMediaLinkRepository.deleteAllByMainPostId(mainPostId);
        evictMainPostMediaCacheAfterCommit(mainPostId);
    }

    @Transactional
    public void clearSubPostMedia(Long subPostId) {
        subPostMediaLinkRepository.deleteAllBySubPostId(subPostId);
        evictSubPostMediaCacheAfterCommit(subPostId);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<MediaAssetResponse>> resolveMainPostMedia(Collection<MainPost> mainPosts) {
        if (mainPosts == null || mainPosts.isEmpty()) {
            return Map.of();
        }
        List<Long> mainPostIds = mainPosts.stream().map(MainPost::getId).filter(Objects::nonNull).toList();
        return resolveMainPostMediaByIds(mainPostIds);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<MediaAssetResponse>> resolveMainPostMediaByIds(Collection<Long> mainPostIds) {
        List<Long> normalizedMainPostIds = normalizeIds(mainPostIds);
        if (normalizedMainPostIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<MediaAssetResponse>> result = defaultMutableMap(normalizedMainPostIds);
        Set<Long> activeMainPostIds = loadActiveMainPostIds(normalizedMainPostIds);
        normalizedMainPostIds.stream()
                .filter(mainPostId -> !activeMainPostIds.contains(mainPostId))
                .forEach(mainPostMediaCache::evictMedia);
        List<Long> resolvableMainPostIds = normalizedMainPostIds.stream()
                .filter(activeMainPostIds::contains)
                .toList();
        if (resolvableMainPostIds.isEmpty()) {
            return immutableCopy(result);
        }
        List<Long> missingMainPostIds = new ArrayList<>();
        List<Long> staleMainPostIds = new ArrayList<>();
        for (Long mainPostId : resolvableMainPostIds) {
            PlatformCacheReadResult<List<MediaAssetResponse>> cachedSnapshot = mainPostMediaCache.getMediaSnapshot(mainPostId);
            if (cachedSnapshot.value().isPresent()) {
                result.put(mainPostId, new ArrayList<>(cachedSnapshot.value().orElseThrow()));
                if (cachedSnapshot.stale()) {
                    staleMainPostIds.add(mainPostId);
                }
            } else {
                missingMainPostIds.add(mainPostId);
            }
        }
        triggerAsyncMainPostMediaRefreshIfStale(staleMainPostIds);
        if (missingMainPostIds.isEmpty()) {
            return immutableCopy(result);
        }

        Map<Long, List<MediaAssetResponse>> loadedMissingMedia = mainPostMediaLoadSingleFlight.execute(
                buildSingleFlightBatchKey("main-post-media", missingMainPostIds),
                () -> loadMissingMainPostMedia(missingMainPostIds),
                mainPostMediaCache::recordRequestMerge
        );
        loadedMissingMedia.forEach((mainPostId, mediaAssets) -> result.put(mainPostId, new ArrayList<>(mediaAssets)));
        return immutableCopy(result);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<MediaAssetResponse>> resolveSubPostMedia(Collection<SubPost> subPosts) {
        if (subPosts == null || subPosts.isEmpty()) {
            return Map.of();
        }
        List<Long> subPostIds = subPosts.stream().map(SubPost::getId).filter(Objects::nonNull).toList();
        return resolveSubPostMediaByIds(subPostIds);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<MediaAssetResponse>> resolveSubPostMediaByIds(Collection<Long> subPostIds) {
        List<Long> normalizedSubPostIds = normalizeIds(subPostIds);
        if (normalizedSubPostIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<MediaAssetResponse>> result = defaultMutableMap(normalizedSubPostIds);
        Set<Long> activeSubPostIds = loadActiveSubPostIdsWithActiveMainPost(normalizedSubPostIds);
        normalizedSubPostIds.stream()
                .filter(subPostId -> !activeSubPostIds.contains(subPostId))
                .forEach(subPostMediaCache::evictMedia);
        List<Long> resolvableSubPostIds = normalizedSubPostIds.stream()
                .filter(activeSubPostIds::contains)
                .toList();
        if (resolvableSubPostIds.isEmpty()) {
            return immutableCopy(result);
        }
        List<Long> missingSubPostIds = new ArrayList<>();
        List<Long> staleSubPostIds = new ArrayList<>();
        for (Long subPostId : resolvableSubPostIds) {
            PlatformCacheReadResult<List<MediaAssetResponse>> cachedSnapshot = subPostMediaCache.getMediaSnapshot(subPostId);
            if (cachedSnapshot.value().isPresent()) {
                result.put(subPostId, new ArrayList<>(cachedSnapshot.value().orElseThrow()));
                if (cachedSnapshot.stale()) {
                    staleSubPostIds.add(subPostId);
                }
            } else {
                missingSubPostIds.add(subPostId);
            }
        }
        triggerAsyncSubPostMediaRefreshIfStale(staleSubPostIds);
        if (missingSubPostIds.isEmpty()) {
            return immutableCopy(result);
        }

        Map<Long, List<MediaAssetResponse>> loadedMissingMedia = subPostMediaLoadSingleFlight.execute(
                buildSingleFlightBatchKey("sub-post-media", missingSubPostIds),
                () -> loadMissingSubPostMedia(missingSubPostIds),
                subPostMediaCache::recordRequestMerge
        );
        loadedMissingMedia.forEach((subPostId, mediaAssets) -> result.put(subPostId, new ArrayList<>(mediaAssets)));
        return immutableCopy(result);
    }

    private Set<Long> loadActiveMainPostIds(List<Long> mainPostIds) {
        return referenceAvailabilityService.loadActiveMainPostIds(mainPostIds);
    }

    private Set<Long> loadActiveSubPostIdsWithActiveMainPost(List<Long> subPostIds) {
        return referenceAvailabilityService.loadActiveSubPostIdsWithActiveMainPost(subPostIds);
    }

    private void triggerAsyncMainPostMediaRefreshIfStale(List<Long> staleMainPostIds) {
        if (staleMainPostIds == null || staleMainPostIds.isEmpty()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                buildSingleFlightBatchKey("main-post-media-refresh", staleMainPostIds),
                () -> {
                    try {
                        loadMissingMainPostMedia(staleMainPostIds);
                    } catch (RuntimeException error) {
                        log.warn("main_post_media_async_refresh_failed ids={}", staleMainPostIds, error);
                    }
                },
                mainPostMediaCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            mainPostMediaCache.recordRefresh();
            return;
        }
        mainPostMediaCache.recordRefreshMerge();
    }

    private void triggerAsyncMediaAssetMetadataRefreshIfStale(
            Long assetId,
            PlatformCacheReadResult<MediaAssetResponse> cachedSnapshot
    ) {
        if (!cachedSnapshot.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "media-asset-metadata-refresh:" + assetId,
                () -> {
                    try {
                        loadMediaAssetMetadata(assetId);
                    } catch (RuntimeException error) {
                        log.warn("media_asset_metadata_async_refresh_failed id={}", assetId, error);
                    }
                },
                mediaAssetMetadataCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            mediaAssetMetadataCache.recordRefresh();
            return;
        }
        mediaAssetMetadataCache.recordRefreshMerge();
    }

    private void triggerAsyncSubPostMediaRefreshIfStale(List<Long> staleSubPostIds) {
        if (staleSubPostIds == null || staleSubPostIds.isEmpty()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                buildSingleFlightBatchKey("sub-post-media-refresh", staleSubPostIds),
                () -> {
                    try {
                        loadMissingSubPostMedia(staleSubPostIds);
                    } catch (RuntimeException error) {
                        log.warn("sub_post_media_async_refresh_failed ids={}", staleSubPostIds, error);
                    }
                },
                subPostMediaCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            subPostMediaCache.recordRefresh();
            return;
        }
        subPostMediaCache.recordRefreshMerge();
    }

    private Map<Long, List<MediaAssetResponse>> loadMissingMainPostMedia(List<Long> requestedMainPostIds) {
        Map<Long, List<MediaAssetResponse>> result = defaultMutableMap(requestedMainPostIds);
        mainPostMediaCache.recordLoaderHit();
        Map<Long, List<MediaAttachmentProjectionPort.MediaAttachmentProjection>> mediaByMainPostId =
                mediaAttachmentProjectionPort.loadMainPostMedia(requestedMainPostIds);
        Map<Long, List<MediaAssetVariantResponse>> variantsByAssetId =
                loadVariantResponsesByAssetId(extractAttachmentAssetIds(mediaByMainPostId));
        mediaByMainPostId
                .forEach((mainPostId, projections) -> {
                    List<MediaAssetResponse> immutableMediaAssets = projections.stream()
                            .map(projection -> toResponse(projection, variantsByAssetId))
                            .toList();
                    result.put(mainPostId, new ArrayList<>(immutableMediaAssets));
                    if (canCacheMediaAttachments(immutableMediaAssets)) {
                        mainPostMediaCache.putMedia(mainPostId, immutableMediaAssets);
                    } else {
                        mainPostMediaCache.evictMedia(mainPostId);
                    }
                });
        return immutableCopy(result);
    }

    private Optional<MediaAssetResponse> loadMediaAssetMetadata(Long assetId) {
        mediaAssetMetadataCache.recordLoaderHit();
        Optional<MediaAssetMetadataProjection> loadedAsset =
                mediaAssetMetadataProjectionPort.loadActiveMediaAsset(assetId);
        if (loadedAsset.isEmpty()) {
            mediaAssetMetadataCache.putMissingMediaAsset(assetId);
            return Optional.empty();
        }
        MediaAssetResponse response = toResponse(loadedAsset.get());
        mediaAssetMetadataCache.putMediaAsset(response);
        return Optional.of(response);
    }

    private Map<Long, List<MediaAssetResponse>> loadMissingSubPostMedia(List<Long> requestedSubPostIds) {
        Map<Long, List<MediaAssetResponse>> result = defaultMutableMap(requestedSubPostIds);
        subPostMediaCache.recordLoaderHit();
        Map<Long, List<MediaAttachmentProjectionPort.MediaAttachmentProjection>> mediaBySubPostId =
                mediaAttachmentProjectionPort.loadSubPostMedia(requestedSubPostIds);
        Map<Long, List<MediaAssetVariantResponse>> variantsByAssetId =
                loadVariantResponsesByAssetId(extractAttachmentAssetIds(mediaBySubPostId));
        mediaBySubPostId
                .forEach((subPostId, projections) -> {
                    List<MediaAssetResponse> immutableMediaAssets = projections.stream()
                            .map(projection -> toResponse(projection, variantsByAssetId))
                            .toList();
                    result.put(subPostId, new ArrayList<>(immutableMediaAssets));
                    if (canCacheMediaAttachments(immutableMediaAssets)) {
                        subPostMediaCache.putMedia(subPostId, immutableMediaAssets);
                    } else {
                        subPostMediaCache.evictMedia(subPostId);
                    }
                });
        return immutableCopy(result);
    }

    private boolean canCacheMediaAttachments(List<MediaAssetResponse> mediaAssets) {
        if (mediaAssets == null || mediaAssets.isEmpty()) {
            return true;
        }
        return mediaAssets.stream().allMatch(this::hasCompleteDisplayVariants);
    }

    private boolean hasCompleteDisplayVariants(MediaAssetResponse mediaAsset) {
        if (mediaAsset == null || !"IMAGE".equalsIgnoreCase(mediaAsset.kind())) {
            return true;
        }
        List<MediaAssetVariantResponse> variants = mediaAsset.variants() == null ? List.of() : mediaAsset.variants();
        Set<String> kinds = variants.stream()
                .map(MediaAssetVariantResponse::kind)
                .filter(Objects::nonNull)
                .map(value -> value.trim().toUpperCase(java.util.Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        return kinds.containsAll(Set.of("ORIGINAL", "THUMB", "SMALL", "MEDIUM", "DISPLAY"));
    }

    private List<MediaAssetMetadataProjection> requireOwnedAssets(String ownerUsername, List<Long> mediaAssetIds) {
        if (mediaAssetIds == null || mediaAssetIds.isEmpty()) {
            return List.of();
        }
        Set<Long> normalizedIds = new LinkedHashSet<>(mediaAssetIds);
        List<MediaAssetMetadataProjection> assets = mediaAssetMetadataProjectionPort.loadOwnedActiveMediaAssets(
                ownerUsername,
                normalizedIds
        );
        if (assets.size() != normalizedIds.size()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "\u5a92\u4f53\u8d44\u4ea7\u4e0d\u5b58\u5728\u6216\u4e0d\u5c5e\u4e8e\u5f53\u524d\u7528\u6237\u3002"
            );
        }

        Map<Long, MediaAssetMetadataProjection> assetsById = new LinkedHashMap<>();
        assets.forEach(asset -> assetsById.put(asset.assetId(), asset));
        List<MediaAssetMetadataProjection> orderedAssets = new ArrayList<>();
        for (Long id : normalizedIds) {
            orderedAssets.add(assetsById.get(id));
        }
        return orderedAssets;
    }

    private MediaAssetMetadataProjection findActiveAssetOrThrow(Long assetId) {
        return mediaAssetMetadataProjectionPort.loadActiveMediaAsset(assetId)
                .orElseThrow(this::mediaAssetNotFound);
    }

    private Map<Long, List<MediaAssetResponse>> defaultMutableMap(List<Long> ids) {
        Map<Long, List<MediaAssetResponse>> result = new LinkedHashMap<>();
        ids.forEach(id -> result.put(id, new ArrayList<>()));
        return result;
    }

    private Map<Long, List<MediaAssetResponse>> immutableCopy(Map<Long, List<MediaAssetResponse>> result) {
        Map<Long, List<MediaAssetResponse>> copy = new LinkedHashMap<>();
        result.forEach((id, assets) -> copy.put(id, List.copyOf(assets)));
        return copy;
    }

    private MediaAssetResponse toResponse(MediaAsset asset) {
        return toResponse(asset, loadVariantResponses(asset.getId()));
    }

    private MediaAssetResponse toResponse(MediaAsset asset, List<MediaAssetVariantResponse> variants) {
        MediaAssetVariantResponse display = findVariantResponse(variants, MediaAssetVariantKind.DISPLAY);
        MediaAssetVariantResponse medium = findVariantResponse(variants, MediaAssetVariantKind.MEDIUM);
        MediaAssetVariantResponse small = findVariantResponse(variants, MediaAssetVariantKind.SMALL);
        MediaAssetVariantResponse thumb = findVariantResponse(variants, MediaAssetVariantKind.THUMB);
        MediaAssetVariantResponse original = findVariantResponse(variants, MediaAssetVariantKind.ORIGINAL);
        String fallbackOriginalUrl = minioMediaStorageService.buildPublicUrl(asset.getBucketName(), asset.getObjectKey());
        String originalUrl = variantResponseUrlOrDefault(original, fallbackOriginalUrl);
        String displayUrl = variantResponseUrlOrDefault(display, originalUrl);
        String mediumUrl = variantResponseUrlOrDefault(medium, displayUrl);
        String smallUrl = variantResponseUrlOrDefault(small, mediumUrl);
        String thumbUrl = variantResponseUrlOrDefault(thumb, smallUrl);
        return new MediaAssetResponse(
                asset.getId(),
                asset.getPublicId(),
                asset.getKind().name(),
                displayUrl,
                thumbUrl,
                smallUrl,
                mediumUrl,
                displayUrl,
                originalUrl,
                original != null ? original.contentType() : asset.getContentType(),
                asset.getOriginalFilename(),
                original != null ? original.sizeBytes() : asset.getSizeBytes(),
                original != null ? original.width() : 0,
                original != null ? original.height() : 0,
                asset.getProcessingStatus().name(),
                asset.getBlurDataUrl(),
                variants
        );
    }

    private MediaAssetResponse toResponse(MediaAssetMetadataProjection projection) {
        return toResponse(projection, loadVariantResponses(projection.assetId()));
    }

    private MediaAssetResponse toResponse(
            MediaAssetMetadataProjection projection,
            List<MediaAssetVariantResponse> variants
    ) {
        MediaAssetVariantResponse display = findVariantResponse(variants, MediaAssetVariantKind.DISPLAY);
        MediaAssetVariantResponse medium = findVariantResponse(variants, MediaAssetVariantKind.MEDIUM);
        MediaAssetVariantResponse small = findVariantResponse(variants, MediaAssetVariantKind.SMALL);
        MediaAssetVariantResponse thumb = findVariantResponse(variants, MediaAssetVariantKind.THUMB);
        MediaAssetVariantResponse original = findVariantResponse(variants, MediaAssetVariantKind.ORIGINAL);
        String fallbackOriginalUrl = minioMediaStorageService.buildPublicUrl(
                projection.bucketName(),
                projection.objectKey()
        );
        String originalUrl = variantResponseUrlOrDefault(original, fallbackOriginalUrl);
        String displayUrl = variantResponseUrlOrDefault(display, originalUrl);
        String mediumUrl = variantResponseUrlOrDefault(medium, displayUrl);
        String smallUrl = variantResponseUrlOrDefault(small, mediumUrl);
        String thumbUrl = variantResponseUrlOrDefault(thumb, smallUrl);
        return new MediaAssetResponse(
                projection.assetId(),
                projection.publicId(),
                projection.kind().name(),
                displayUrl,
                thumbUrl,
                smallUrl,
                mediumUrl,
                displayUrl,
                originalUrl,
                original != null ? original.contentType() : projection.contentType(),
                projection.originalFilename(),
                original != null ? original.sizeBytes() : projection.sizeBytes(),
                original != null ? original.width() : 0,
                original != null ? original.height() : 0,
                normalizeProcessingStatus(projection.processingStatus()),
                projection.blurDataUrl(),
                variants
        );
    }

    private MediaAssetResponse toResponse(MediaAttachmentProjectionPort.MediaAttachmentProjection projection) {
        return toResponse(projection, loadVariantResponses(projection.assetId()));
    }

    private MediaAssetResponse toResponse(
            MediaAttachmentProjectionPort.MediaAttachmentProjection projection,
            Map<Long, List<MediaAssetVariantResponse>> variantsByAssetId
    ) {
        return toResponse(
                projection,
                variantsByAssetId.getOrDefault(projection.assetId(), List.of())
        );
    }

    private MediaAssetResponse toResponse(
            MediaAttachmentProjectionPort.MediaAttachmentProjection projection,
            List<MediaAssetVariantResponse> variants
    ) {
        MediaAssetVariantResponse display = findVariantResponse(variants, MediaAssetVariantKind.DISPLAY);
        MediaAssetVariantResponse medium = findVariantResponse(variants, MediaAssetVariantKind.MEDIUM);
        MediaAssetVariantResponse small = findVariantResponse(variants, MediaAssetVariantKind.SMALL);
        MediaAssetVariantResponse thumb = findVariantResponse(variants, MediaAssetVariantKind.THUMB);
        MediaAssetVariantResponse original = findVariantResponse(variants, MediaAssetVariantKind.ORIGINAL);
        String fallbackOriginalUrl = minioMediaStorageService.buildPublicUrl(
                projection.bucketName(),
                projection.objectKey()
        );
        String originalUrl = variantResponseUrlOrDefault(original, fallbackOriginalUrl);
        String displayUrl = variantResponseUrlOrDefault(display, originalUrl);
        String mediumUrl = variantResponseUrlOrDefault(medium, displayUrl);
        String smallUrl = variantResponseUrlOrDefault(small, mediumUrl);
        String thumbUrl = variantResponseUrlOrDefault(thumb, smallUrl);
        return new MediaAssetResponse(
                projection.assetId(),
                projection.publicId(),
                projection.kind(),
                displayUrl,
                thumbUrl,
                smallUrl,
                mediumUrl,
                displayUrl,
                originalUrl,
                original != null ? original.contentType() : projection.contentType(),
                projection.originalFilename(),
                original != null ? original.sizeBytes() : projection.sizeBytes(),
                original != null ? original.width() : 0,
                original != null ? original.height() : 0,
                normalizeProcessingStatus(projection.processingStatus()),
                projection.blurDataUrl(),
                variants
        );
    }

    private String normalizeProcessingStatus(String processingStatus) {
        if (processingStatus == null || processingStatus.isBlank()) {
            return MediaAssetProcessingStatus.READY.name();
        }
        return processingStatus.trim().toUpperCase(java.util.Locale.ROOT);
    }

    private List<MediaAssetVariantResponse> loadVariantResponses(Long mediaAssetId) {
        if (mediaAssetId == null) {
            return List.of();
        }
        return mediaAssetVariantRepository.findAllByMediaAssetIdIn(List.of(mediaAssetId)).stream()
                .map(this::toVariantResponse)
                .toList();
    }

    private Map<Long, List<MediaAssetVariantResponse>> loadVariantResponsesByAssetId(Collection<Long> mediaAssetIds) {
        List<Long> normalizedAssetIds = normalizeIds(mediaAssetIds);
        if (normalizedAssetIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<MediaAssetVariantResponse>> variantsByAssetId = new LinkedHashMap<>();
        mediaAssetVariantRepository.findAllByMediaAssetIdIn(normalizedAssetIds)
                .forEach(variant -> variantsByAssetId
                        .computeIfAbsent(variant.getMediaAssetId(), ignored -> new ArrayList<>())
                        .add(toVariantResponse(variant)));
        return variantsByAssetId;
    }

    private List<Long> extractAttachmentAssetIds(
            Map<Long, List<MediaAttachmentProjectionPort.MediaAttachmentProjection>> mediaByOwnerId
    ) {
        if (mediaByOwnerId == null || mediaByOwnerId.isEmpty()) {
            return List.of();
        }
        return mediaByOwnerId.values().stream()
                .filter(Objects::nonNull)
                .flatMap(Collection::stream)
                .map(MediaAttachmentProjectionPort.MediaAttachmentProjection::assetId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private MediaAssetVariantResponse toVariantResponse(MediaAssetVariant variant) {
        return new MediaAssetVariantResponse(
                variant.getKind().name(),
                mediaVariantUrl(variant),
                variant.getContentType(),
                variant.getSizeBytes(),
                variant.getWidth(),
                variant.getHeight()
        );
    }

    private MediaAssetVariantResponse findVariantResponse(
            List<MediaAssetVariantResponse> variants,
            MediaAssetVariantKind kind
    ) {
        return variants.stream()
                .filter(variant -> kind.name().equals(variant.kind()))
                .findFirst()
                .orElse(null);
    }

    private String variantResponseUrlOrDefault(MediaAssetVariantResponse variant, String fallbackUrl) {
        if (variant != null && variant.url() != null && !variant.url().isBlank()) {
            return variant.url();
        }
        return fallbackUrl == null ? "" : fallbackUrl;
    }

    private String mediaVariantUrl(MediaAssetVariant variant) {
        String version = buildMediaVariantVersion(variant);
        String publicUrl = minioMediaStorageService.buildPublicUrl(variant.getBucketName(), variant.getObjectKey());
        if (publicUrl != null && !publicUrl.isBlank()) {
            return version == null || version.isBlank() ? publicUrl : publicUrl + "?v=" + version;
        }
        return "";
    }

    private String buildMediaVariantVersion(MediaAssetVariant variant) {
        if (variant == null) {
            return "";
        }
        return Integer.toUnsignedString(
                Objects.hash(
                        variant.getBucketName(),
                        variant.getObjectKey(),
                        variant.getSizeBytes(),
                        variant.getWidth(),
                        variant.getHeight()
                ),
                36
        );
    }

    private List<Long> normalizeIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> normalizedIds = new LinkedHashSet<>();
        ids.stream()
                .filter(Objects::nonNull)
                .forEach(normalizedIds::add);
        return List.copyOf(normalizedIds);
    }

    private String buildSingleFlightBatchKey(String cacheName, List<Long> ids) {
        return cacheName + ":" + ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
    }

    private void publishVariantProcessing(Long assetId) {
        Runnable task = () -> {
            if (mediaVariantProcessingPublisher.isEmpty()) {
                log.warn("media_variant_processing_publisher_missing assetId={}", assetId);
                return;
            }
            mediaVariantProcessingPublisher.orElseThrow().publish(assetId);
        };
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
            return;
        }
        task.run();
    }

    private void evictLinkedMediaCaches(Long assetId) {
        mainPostMediaLinkRepository.findAllByMediaAssetId(assetId)
                .forEach(link -> mainPostMediaCache.evictMedia(link.getMainPostId()));
        subPostMediaLinkRepository.findAllByMediaAssetId(assetId)
                .forEach(link -> subPostMediaCache.evictMedia(link.getSubPostId()));
    }

    private void refreshLinkedMainPostFeedMedia(Long assetId) {
        List<Long> linkedMainPostIds = mainPostMediaLinkRepository.findAllByMediaAssetId(assetId).stream()
                .map(MainPostMediaLink::getMainPostId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        refreshMainPostFeedMedia(linkedMainPostIds);
    }

    private void refreshLinkedMainPostFeedMediaAfterCommit(Long assetId) {
        runAfterCurrentCommitOrNow("main_post_feed_media_refresh_failed", () -> transactionTemplate.executeWithoutResult(
                status -> refreshLinkedMainPostFeedMedia(assetId)
        ));
    }

    private void refreshMainPostFeedMediaAfterCommit(List<Long> mainPostIds) {
        List<Long> normalizedMainPostIds = normalizeIds(mainPostIds);
        if (normalizedMainPostIds.isEmpty()) {
            return;
        }
        runAfterCurrentCommitOrNow("main_post_feed_media_refresh_failed", () -> transactionTemplate.executeWithoutResult(
                status -> refreshMainPostFeedMedia(normalizedMainPostIds)
        ));
    }

    private void putMediaAssetCacheAfterCommit(MediaAssetResponse response) {
        runAfterCurrentCommitOrNow(
                "media_asset_metadata_cache_update_failed",
                () -> mediaAssetMetadataCache.putMediaAsset(response)
        );
    }

    private void evictMediaAssetCacheAfterCommit(Long assetId) {
        runAfterCurrentCommitOrNow(
                "media_asset_metadata_cache_evict_failed",
                () -> mediaAssetMetadataCache.evictMediaAsset(assetId)
        );
    }

    private void putMainPostMediaCacheAfterCommit(Long mainPostId, List<MediaAssetResponse> mediaAssets) {
        runAfterCurrentCommitOrNow(
                "main_post_media_cache_update_failed",
                () -> mainPostMediaCache.putMedia(mainPostId, mediaAssets)
        );
    }

    private void evictMainPostMediaCacheAfterCommit(Long mainPostId) {
        runAfterCurrentCommitOrNow(
                "main_post_media_cache_evict_failed",
                () -> mainPostMediaCache.evictMedia(mainPostId)
        );
    }

    private void putSubPostMediaCacheAfterCommit(Long subPostId, List<MediaAssetResponse> mediaAssets) {
        runAfterCurrentCommitOrNow(
                "sub_post_media_cache_update_failed",
                () -> subPostMediaCache.putMedia(subPostId, mediaAssets)
        );
    }

    private void evictSubPostMediaCacheAfterCommit(Long subPostId) {
        runAfterCurrentCommitOrNow(
                "sub_post_media_cache_evict_failed",
                () -> subPostMediaCache.evictMedia(subPostId)
        );
    }

    private void runAfterCurrentCommitOrNow(String failureMessage, Runnable task) {
        Runnable guardedTask = () -> {
            try {
                task.run();
            } catch (RuntimeException error) {
                log.warn(failureMessage, error);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    guardedTask.run();
                }
            });
            return;
        }
        guardedTask.run();
    }

    private static TransactionTemplate newRequiresNewTransactionTemplate(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template;
    }

    private void refreshMainPostFeedMedia(List<Long> mainPostIds) {
        List<Long> normalizedMainPostIds = normalizeIds(mainPostIds);
        if (normalizedMainPostIds.isEmpty()) {
            return;
        }
        Map<Long, List<MediaAssetResponse>> mediaByMainPostId = loadMissingMainPostMedia(normalizedMainPostIds);
        mediaByMainPostId.forEach((mainPostId, mediaAssets) -> {
            try {
                mainPostFeedItemRepository.updateMediaAssetsJson(
                        mainPostId,
                        objectMapper.writeValueAsString(mediaAssets)
                );
            } catch (JsonProcessingException error) {
                throw new IllegalStateException("Failed to serialize feed media assets.", error);
            }
        });
        mainPostFeedPageCache.evictAllFeedPages();
    }

    private ApiException mediaAssetNotFound() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                ApiErrorCode.RESOURCE_NOT_FOUND,
                "\u5a92\u4f53\u8d44\u4ea7\u4e0d\u5b58\u5728\u3002"
        );
    }


}
