package com.memesee.content.community.application;

import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformSingleFlight;
import com.memesee.content.community.dto.CommunityResponse;
import com.memesee.content.community.application.CommunityCatalogProjectionPort.CommunityCatalogProjection;
import com.memesee.content.community.domain.Community;
import com.memesee.content.community.infrastructure.CommunityCatalogCache;
import com.memesee.content.community.infrastructure.CommunityRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class CommunityApplicationService implements CommunityCollaborationApplicationService {

    private static final Logger log = LoggerFactory.getLogger(CommunityApplicationService.class);

    private static final List<CommunitySeed> DEFAULT_COMMUNITIES = List.of(
            new CommunitySeed("daily", "\u65e5\u5e38", "\u751f\u6d3b\u8bb0\u5f55\u3001\u968f\u7b14\u3001\u89c1\u95fb\u4e0e\u8f7b\u677e\u804a\u5929\u3002", 10),
            new CommunitySeed("article", "\u6587\u7ae0", "\u957f\u6587\u3001\u89c2\u70b9\u3001\u6559\u7a0b\u4e0e\u7ecf\u9a8c\u6c89\u6dc0\u3002", 20),
            new CommunitySeed("tech", "\u79d1\u6280", "\u6280\u672f\u8d44\u8baf\u3001\u6570\u7801\u5206\u4eab\u4e0e\u5f00\u53d1\u8ba8\u8bba\u3002", 30),
            new CommunitySeed("news", "\u65b0\u95fb", "\u65f6\u4e8b\u6d88\u606f\u3001\u70ed\u70b9\u901f\u89c8\u4e0e\u793e\u4f1a\u8bdd\u9898\u3002", 40),
            new CommunitySeed("game", "\u6e38\u620f", "\u6e38\u620f\u4f53\u9a8c\u3001\u653b\u7565\u3001\u8bc4\u6d4b\u4e0e\u8054\u673a\u4ea4\u6d41\u3002", 50),
            new CommunitySeed("animation", "\u52a8\u753b", "\u52a8\u753b\u4f5c\u54c1\u3001\u5206\u955c\u3001\u8bbe\u5b9a\u4e0e\u521b\u4f5c\u4ea4\u6d41\u3002", 60),
            new CommunitySeed("comic", "\u6f2b\u753b", "\u6f2b\u753b\u8fde\u8f7d\u3001\u6761\u6f2b\u3001\u5267\u60c5\u8ba8\u8bba\u4e0e\u521b\u4f5c\u4ea4\u6d41\u3002", 70),
            new CommunitySeed("gallery", "\u753b\u96c6", "\u63d2\u753b\u3001\u56fe\u96c6\u3001\u8bbe\u5b9a\u7a3f\u4e0e\u89c6\u89c9\u521b\u4f5c\u5206\u4eab\u3002", 80)
    );

    private final CommunityCatalogProjectionPort communityCatalogProjectionPort;
    private final CommunityRepository communityRepository;
    private final CommunityCatalogCache communityCatalogCache;
    private final PlatformAsyncRefreshCoordinator asyncRefreshCoordinator;
    private final PlatformSingleFlight cacheLoadSingleFlight = new PlatformSingleFlight();

    @Autowired
    public CommunityApplicationService(
            CommunityCatalogProjectionPort communityCatalogProjectionPort,
            CommunityRepository communityRepository,
            CommunityCatalogCache communityCatalogCache
    ) {
        this(
                communityCatalogProjectionPort,
                communityRepository,
                communityCatalogCache,
                new PlatformAsyncRefreshCoordinator()
        );
    }

    CommunityApplicationService(
            CommunityCatalogProjectionPort communityCatalogProjectionPort,
            CommunityRepository communityRepository,
            CommunityCatalogCache communityCatalogCache,
            PlatformAsyncRefreshCoordinator asyncRefreshCoordinator
    ) {
        this.communityCatalogProjectionPort = communityCatalogProjectionPort;
        this.communityRepository = communityRepository;
        this.communityCatalogCache = communityCatalogCache;
        this.asyncRefreshCoordinator = asyncRefreshCoordinator;
    }

    @Transactional(readOnly = true)
    public List<CommunityResponse> listCommunities() {
        PlatformCacheReadResult<List<CommunityResponse>> cachedSnapshot = communityCatalogCache.getCommunityListSnapshot();
        if (cachedSnapshot.value().isPresent()) {
            List<CommunityResponse> cachedResponses = cachedSnapshot.value().orElseThrow();
            triggerAsyncCommunityCatalogRefreshIfStale(cachedSnapshot);
            return cachedResponses;
        }
        if (cachedSnapshot.handled()) {
            return List.of();
        }
        return cacheLoadSingleFlight.execute(
                buildCommunityCatalogListSingleFlightKey(),
                this::loadCommunityCatalogAndCache,
                communityCatalogCache::recordRequestMerge
        );
    }

    @Transactional(readOnly = true)
    public CommunityResponse getCommunity(String communitySlug) {
        return toResponse(requireCommunityBySlug(communitySlug));
    }

    @Transactional
    public void ensureDefaultCommunities() {
        DEFAULT_COMMUNITIES.forEach(this::upsertCommunity);
        refreshCommunityCatalogCacheAfterCommit();
    }

    private void upsertCommunity(CommunitySeed seed) {
        Community community = communityRepository.findBySlug(seed.slug())
                .orElseGet(() -> new Community(seed.slug(), seed.name(), seed.description(), seed.sortOrder()));
        community.updateCatalog(seed.name(), seed.description(), seed.sortOrder());
        communityRepository.save(community);
    }

    @Override
    @Transactional(readOnly = true)
    public Community requireCommunityBySlug(String communitySlug) {
        String normalizedSlug = normalizeSlug(communitySlug);
        PlatformCacheReadResult<CommunityResponse> cachedSnapshot = communityCatalogCache.getCommunitySnapshot(normalizedSlug);
        if (cachedSnapshot.value().isPresent()) {
            Community cachedCommunity = toCommunity(cachedSnapshot.value().orElseThrow());
            triggerAsyncCommunityRefreshBySlugIfStale(normalizedSlug, cachedSnapshot);
            return cachedCommunity;
        }
        if (cachedSnapshot.handled()) {
            throw communityNotFound();
        }
        CommunityResponse response = cacheLoadSingleFlight.execute(
                buildCommunityBySlugSingleFlightKey(normalizedSlug),
                () -> loadCommunityBySlugAndCache(normalizedSlug).orElseThrow(this::communityNotFound),
                communityCatalogCache::recordRequestMerge
        );
        return toCommunity(response);
    }

    @Override
    @Transactional(readOnly = true)
    public Community requireCommunityById(Long communityId) {
        PlatformCacheReadResult<CommunityResponse> cachedSnapshot =
                communityCatalogCache.getCommunityByIdSnapshot(communityId);
        if (cachedSnapshot.value().isPresent()) {
            Community cachedCommunity = toCommunity(cachedSnapshot.value().orElseThrow());
            triggerAsyncCommunityRefreshByIdIfStale(communityId, cachedSnapshot);
            return cachedCommunity;
        }
        if (cachedSnapshot.handled()) {
            throw communityNotFound();
        }
        CommunityResponse response = cacheLoadSingleFlight.execute(
                buildCommunityByIdSingleFlightKey(communityId),
                () -> loadCommunityByIdAndCache(communityId).orElseThrow(this::communityNotFound),
                communityCatalogCache::recordRequestMerge
        );
        return toCommunity(response);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, Community> loadCommunities(Collection<Long> communityIds) {
        if (communityIds == null || communityIds.isEmpty()) {
            return Map.of();
        }
        LinkedHashSet<Long> requestedIds = communityIds.stream()
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (requestedIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Community> communitiesById = new LinkedHashMap<>();
        Map<Long, PlatformCacheReadResult<CommunityResponse>> cachedSnapshotsById = new LinkedHashMap<>();
        List<Long> staleIds = new ArrayList<>();
        requestedIds.forEach(communityId -> {
            PlatformCacheReadResult<CommunityResponse> cachedSnapshot =
                    communityCatalogCache.getCommunityByIdSnapshot(communityId);
            cachedSnapshotsById.put(communityId, cachedSnapshot);
            cachedSnapshot.value().ifPresent(cachedResponse -> {
                communitiesById.put(communityId, toCommunity(cachedResponse));
                if (cachedSnapshot.stale()) {
                    staleIds.add(communityId);
                }
            });
        });
        triggerAsyncCommunityRefreshByIdsIfStale(staleIds);

        List<Long> missingIds = requestedIds.stream()
                .filter(communityId -> !communitiesById.containsKey(communityId))
                .filter(communityId -> !cachedSnapshotsById.getOrDefault(communityId, PlatformCacheReadResult.miss()).handled())
                .toList();
        if (missingIds.isEmpty()) {
            return communitiesById;
        }

        List<CommunityResponse> loadedCommunities = loadCommunitiesByIdsAndCache(missingIds);
        loadedCommunities.forEach(community -> communitiesById.put(community.id(), toCommunity(community)));
        return communitiesById;
    }

    private Optional<CommunityResponse> loadCommunityBySlugAndCache(String normalizedSlug) {
        communityCatalogCache.recordLoaderHit();
        Optional<CommunityCatalogProjection> loadedCommunity = communityCatalogProjectionPort.loadCommunityBySlug(normalizedSlug);
        if (loadedCommunity.isEmpty()) {
            communityCatalogCache.putMissingCommunity(normalizedSlug);
            return Optional.empty();
        }
        CommunityResponse loadedResponse = toResponse(loadedCommunity.get());
        communityCatalogCache.putCommunity(loadedResponse);
        return Optional.of(loadedResponse);
    }

    private Optional<CommunityResponse> loadCommunityByIdAndCache(Long communityId) {
        communityCatalogCache.recordLoaderHit();
        Optional<CommunityCatalogProjection> loadedCommunity = communityCatalogProjectionPort.loadCommunityById(communityId);
        if (loadedCommunity.isEmpty()) {
            communityCatalogCache.putMissingCommunityById(communityId);
            return Optional.empty();
        }
        CommunityResponse loadedResponse = toResponse(loadedCommunity.get());
        communityCatalogCache.putCommunity(loadedResponse);
        return Optional.of(loadedResponse);
    }

    private List<CommunityResponse> loadCommunityCatalogAndCache() {
        communityCatalogCache.recordLoaderHit();
        List<CommunityResponse> responses = communityCatalogProjectionPort.loadCommunityCatalog().stream()
                .map(this::toResponse)
                .toList();
        cacheCommunityCatalog(responses);
        return responses;
    }

    private List<CommunityResponse> loadCommunitiesByIdsAndCache(List<Long> communityIds) {
        if (communityIds == null || communityIds.isEmpty()) {
            return List.of();
        }
        communityCatalogCache.recordLoaderHit();
        List<CommunityResponse> loadedCommunities = communityCatalogProjectionPort.loadCommunitiesByIds(communityIds).stream()
                .map(this::toResponse)
                .toList();
        loadedCommunities.forEach(communityCatalogCache::putCommunity);
        Set<Long> loadedIds = loadedCommunities.stream()
                .map(CommunityResponse::id)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        communityIds.stream()
                .filter(Objects::nonNull)
                .filter(communityId -> !loadedIds.contains(communityId))
                .forEach(communityCatalogCache::putMissingCommunityById);
        return loadedCommunities;
    }

    private void triggerAsyncCommunityRefreshBySlugIfStale(
            String normalizedSlug,
            PlatformCacheReadResult<CommunityResponse> cachedSnapshot
    ) {
        if (!cachedSnapshot.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "community-catalog:slug-refresh:" + normalizedSlug,
                () -> {
                    try {
                        loadCommunityBySlugAndCache(normalizedSlug);
                    } catch (RuntimeException error) {
                        log.warn("community_catalog_slug_async_refresh_failed slug={}", normalizedSlug, error);
                    }
                },
                communityCatalogCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            communityCatalogCache.recordRefresh();
            return;
        }
        communityCatalogCache.recordRefreshMerge();
    }

    private void triggerAsyncCommunityCatalogRefreshIfStale(
            PlatformCacheReadResult<List<CommunityResponse>> cachedSnapshot
    ) {
        if (!cachedSnapshot.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "community-catalog:list-refresh",
                () -> {
                    try {
                        loadCommunityCatalogAndCache();
                    } catch (RuntimeException error) {
                        log.warn("community_catalog_list_async_refresh_failed", error);
                    }
                },
                communityCatalogCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            communityCatalogCache.recordRefresh();
            return;
        }
        communityCatalogCache.recordRefreshMerge();
    }

    private void triggerAsyncCommunityRefreshByIdIfStale(
            Long communityId,
            PlatformCacheReadResult<CommunityResponse> cachedSnapshot
    ) {
        if (!cachedSnapshot.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "community-catalog:id-refresh:" + communityId,
                () -> {
                    try {
                        loadCommunityByIdAndCache(communityId);
                    } catch (RuntimeException error) {
                        log.warn("community_catalog_id_async_refresh_failed communityId={}", communityId, error);
                    }
                },
                communityCatalogCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            communityCatalogCache.recordRefresh();
            return;
        }
        communityCatalogCache.recordRefreshMerge();
    }

    private void triggerAsyncCommunityRefreshByIdsIfStale(List<Long> staleCommunityIds) {
        if (staleCommunityIds == null || staleCommunityIds.isEmpty()) {
            return;
        }
        List<Long> normalizedIds = staleCommunityIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (normalizedIds.isEmpty()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                buildCommunityIdsRefreshKey(normalizedIds),
                () -> {
                    try {
                        loadCommunitiesByIdsAndCache(normalizedIds);
                    } catch (RuntimeException error) {
                        log.warn("community_catalog_batch_async_refresh_failed communityIds={}", normalizedIds, error);
                    }
                },
                communityCatalogCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            communityCatalogCache.recordRefresh();
            return;
        }
        communityCatalogCache.recordRefreshMerge();
    }

    private String buildCommunityBySlugSingleFlightKey(String normalizedSlug) {
        return "community-catalog:slug:" + normalizedSlug;
    }

    private String buildCommunityCatalogListSingleFlightKey() {
        return "community-catalog:list";
    }

    private String buildCommunityByIdSingleFlightKey(Long communityId) {
        return "community-catalog:id:" + communityId;
    }

    private String buildCommunityIdsRefreshKey(List<Long> communityIds) {
        return "community-catalog:ids-refresh:" + communityIds.stream()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
    }

    private String normalizeSlug(String communitySlug) {
        if (communitySlug == null || communitySlug.isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    ApiErrorCode.INVALID_REQUEST,
                    "\u793e\u533a\u6807\u8bc6\u4e0d\u80fd\u4e3a\u7a7a\u3002"
            );
        }
        return communitySlug.trim().toLowerCase(Locale.ROOT);
    }

    private CommunityResponse toResponse(Community community) {
        return new CommunityResponse(
                community.getId(),
                community.getSlug(),
                community.getName(),
                community.getDescription(),
                community.getSortOrder()
        );
    }

    private ApiException communityNotFound() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                ApiErrorCode.RESOURCE_NOT_FOUND,
                "\u793e\u533a\u4e0d\u5b58\u5728\u3002"
        );
    }

    private CommunityResponse toResponse(CommunityCatalogProjection community) {
        return new CommunityResponse(
                community.id(),
                community.slug(),
                community.name(),
                community.description(),
                community.sortOrder()
        );
    }

    private void cacheCommunityCatalog(List<CommunityResponse> responses) {
        communityCatalogCache.putCommunityList(responses);
    }

    private void refreshCommunityCatalogCacheAfterCommit() {
        runAfterCurrentCommitOrNow("community_catalog_cache_refresh_failed", () -> {
            communityCatalogCache.evictCommunityCatalog();
            cacheCommunityCatalog(
                    communityCatalogProjectionPort.loadCommunityCatalog().stream()
                            .map(this::toResponse)
                            .toList()
            );
        });
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

    private Community toCommunity(CommunityResponse community) {
        return Community.snapshot(
                community.id(),
                community.slug(),
                community.name(),
                community.description(),
                community.sortOrder()
        );
    }

    private record CommunitySeed(String slug, String name, String description, int sortOrder) {
    }
}
