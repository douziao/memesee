package com.memesee.content.feed.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memesee.content.common.application.ContentReferenceAvailabilityService;
import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.feed.dto.FeedPageResponse;
import com.memesee.content.feed.infrastructure.MainPostFeedPageCache;
import com.memesee.content.feed.infrastructure.MainPostFeedPageCacheKey;
import com.memesee.content.feed.infrastructure.MybatisMainPostFeedItemRow;
import com.memesee.content.feed.infrastructure.MybatisMainPostFeedMapper;
import com.memesee.content.mainpost.application.MainPostViewerInteractionResolver;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.search.application.MainPostSearchQueryService;
import com.memesee.content.search.application.MainPostSearchRequest;
import com.memesee.content.search.application.MainPostSearchResult;
import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import com.memesee.platform.cache.PlatformCacheReadResult;
import com.memesee.platform.cache.PlatformSingleFlight;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MainPostFeedQueryApplicationService {

    private static final Logger log = LoggerFactory.getLogger(MainPostFeedQueryApplicationService.class);

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 60;
    private static final int SEARCH_OVERFETCH_MULTIPLIER = 2;
    private static final int MAX_SEARCH_FETCH_SIZE = 120;
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {
    };
    private static final TypeReference<List<MediaAssetResponse>> MEDIA_ASSET_LIST_TYPE = new TypeReference<>() {
    };

    private final MybatisMainPostFeedMapper feedMapper;
    private final MainPostViewerInteractionResolver viewerInteractionResolver;
    private final AuthContextResolver authContextResolver;
    private final MainPostSearchQueryService searchQueryService;
    private final MainPostFeedPageCache feedPageCache;
    private final ContentReferenceAvailabilityService referenceAvailabilityService;
    private final ObjectMapper objectMapper;
    private final PlatformSingleFlight feedCacheLoadSingleFlight = new PlatformSingleFlight();
    private final PlatformAsyncRefreshCoordinator asyncRefreshCoordinator = new PlatformAsyncRefreshCoordinator();

    public MainPostFeedQueryApplicationService(
            MybatisMainPostFeedMapper feedMapper,
            MainPostViewerInteractionResolver viewerInteractionResolver,
            AuthContextResolver authContextResolver,
            MainPostSearchQueryService searchQueryService,
            MainPostFeedPageCache feedPageCache,
            ContentReferenceAvailabilityService referenceAvailabilityService,
            ObjectMapper objectMapper
    ) {
        this.feedMapper = feedMapper;
        this.viewerInteractionResolver = viewerInteractionResolver;
        this.authContextResolver = authContextResolver;
        this.searchQueryService = searchQueryService;
        this.feedPageCache = feedPageCache;
        this.referenceAvailabilityService = referenceAvailabilityService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public FeedPageResponse<MainPostSummaryResponse> listFeed(
            String communitySlug,
            String keyword,
            String sortMode,
            String cursor,
            Integer size,
            String authorizationHeader
    ) {
        String normalizedCommunitySlug = normalizeCommunitySlug(communitySlug);
        String normalizedKeyword = normalizeKeyword(keyword);
        String normalizedSortMode = MainPostSortMode.from(sortMode).name();
        int safeSize = normalizeSize(size);
        MainPostFeedCursor feedCursor = decodeCursor(cursor);
        if (feedCursor != null && !normalizedSortMode.equals(feedCursor.sortMode())) {
            feedCursor = null;
        }
        if (normalizedKeyword != null) {
            return listSearchFeed(
                    normalizedCommunitySlug,
                    normalizedKeyword,
                    normalizedSortMode,
                    feedCursor,
                    safeSize,
                    authorizationHeader
            );
        }
        MainPostFeedPageCacheKey cacheKey = new MainPostFeedPageCacheKey(
                normalizedCommunitySlug,
                normalizedSortMode,
                normalizeCacheCursor(cursor, feedCursor),
                safeSize
        );
        FeedPageResponse<MainPostSummaryResponse> baselineResponse = loadCachedFeedPage(
                cacheKey,
                normalizedCommunitySlug,
                null,
                normalizedSortMode,
                feedCursor,
                safeSize
        );
        return personalizeFeedPage(baselineResponse, authorizationHeader);
    }

    @Transactional(readOnly = true)
    public FeedPageResponse<MainPostSummaryResponse> listMyMainPosts(
            String cursor,
            Integer size,
            String authorizationHeader
    ) {
        AuthContext authContext = authContextResolver.resolveRequired(authorizationHeader);
        int safeSize = normalizeSize(size);
        MainPostFeedCursor feedCursor = decodeCursor(cursor);
        String sortMode = MainPostSortMode.LATEST_MESSAGE.name();
        if (feedCursor != null && !sortMode.equals(feedCursor.sortMode())) {
            feedCursor = null;
        }
        FeedPageResponse<MainPostSummaryResponse> baselineResponse = loadActiveDatabaseFeedPage(
                null,
                authContext.username(),
                sortMode,
                feedCursor,
                safeSize
        );
        List<MainPostSummaryResponse> items =
                viewerInteractionResolver.applyToSummaryItems(baselineResponse.posts(), authContext);
        return new FeedPageResponse<>(items, baselineResponse.nextCursor(), baselineResponse.hasMore());
    }

    private FeedPageResponse<MainPostSummaryResponse> loadCachedFeedPage(
            MainPostFeedPageCacheKey cacheKey,
            String normalizedCommunitySlug,
            String normalizedAuthorUsername,
            String normalizedSortMode,
            MainPostFeedCursor feedCursor,
            int safeSize
    ) {
        PlatformCacheReadResult<FeedPageResponse<MainPostSummaryResponse>> cachedSnapshot =
                feedPageCache.getFeedPageSnapshot(cacheKey);
        if (cachedSnapshot.value().isPresent()) {
            FeedPageResponse<MainPostSummaryResponse> cachedResponse = cachedSnapshot.value().orElseThrow();
            triggerAsyncFeedPageRefreshIfStale(
                    cachedSnapshot,
                    cacheKey,
                    normalizedCommunitySlug,
                    normalizedAuthorUsername,
                    normalizedSortMode,
                    feedCursor,
                    safeSize
            );
            return filterActiveFeedPage(cachedResponse);
        }
        return feedCacheLoadSingleFlight.execute(
                buildFeedPageSingleFlightKey(cacheKey),
                () -> {
                    feedPageCache.recordLoaderHit();
                    FeedPageResponse<MainPostSummaryResponse> loadedResponse = loadActiveDatabaseFeedPage(
                            normalizedCommunitySlug,
                            normalizedAuthorUsername,
                            normalizedSortMode,
                            feedCursor,
                            safeSize
                    );
                    feedPageCache.putFeedPage(cacheKey, loadedResponse);
                    return loadedResponse;
                },
                feedPageCache::recordRequestMerge
        );
    }

    private FeedPageResponse<MainPostSummaryResponse> loadActiveDatabaseFeedPage(
            String normalizedCommunitySlug,
            String normalizedAuthorUsername,
            String normalizedSortMode,
            MainPostFeedCursor feedCursor,
            int safeSize
    ) {
        return filterActiveFeedPage(loadDatabaseFeedPage(
                normalizedCommunitySlug,
                normalizedAuthorUsername,
                normalizedSortMode,
                feedCursor,
                safeSize
        ));
    }

    private FeedPageResponse<MainPostSummaryResponse> loadDatabaseFeedPage(
            String normalizedCommunitySlug,
            String normalizedAuthorUsername,
            String normalizedSortMode,
            MainPostFeedCursor feedCursor,
            int safeSize
    ) {
        List<MybatisMainPostFeedItemRow> rows = feedMapper.selectFeed(
                normalizedCommunitySlug,
                normalizedAuthorUsername,
                null,
                normalizedSortMode,
                feedCursor == null ? null : feedCursor.mainPostId(),
                toTimestamp(feedCursor == null ? null : feedCursor.latestActivityAt()),
                toTimestamp(feedCursor == null ? null : feedCursor.createdAt()),
                feedCursor == null ? null : feedCursor.heatScore(),
                feedCursor == null ? null : feedCursor.viewCount(),
                safeSize + 1
        );
        boolean hasMore = rows.size() > safeSize;
        List<MybatisMainPostFeedItemRow> pageRows = hasMore ? rows.subList(0, safeSize) : rows;
        List<MainPostSummaryResponse> items = pageRows.stream()
                .map(this::toSummary)
                .toList();
        String nextCursor = hasMore && !pageRows.isEmpty()
                ? encodeCursor(normalizedSortMode, pageRows.get(pageRows.size() - 1))
                : "";
        return new FeedPageResponse<>(items, nextCursor, hasMore);
    }

    private FeedPageResponse<MainPostSummaryResponse> personalizeFeedPage(
            FeedPageResponse<MainPostSummaryResponse> baselineResponse,
            String authorizationHeader
    ) {
        if (baselineResponse == null || baselineResponse.posts().isEmpty()) {
            return baselineResponse == null ? new FeedPageResponse<>(List.of(), "", false) : baselineResponse;
        }
        AuthContext authContext = viewerInteractionResolver.resolveOptional(authorizationHeader);
        if (!authContext.isAuthenticated()) {
            return baselineResponse;
        }
        List<MainPostSummaryResponse> items =
                viewerInteractionResolver.applyToSummaryItems(baselineResponse.posts(), authContext);
        return new FeedPageResponse<>(items, baselineResponse.nextCursor(), baselineResponse.hasMore());
    }

    private void triggerAsyncFeedPageRefreshIfStale(
            PlatformCacheReadResult<FeedPageResponse<MainPostSummaryResponse>> cachedSnapshot,
            MainPostFeedPageCacheKey cacheKey,
            String normalizedCommunitySlug,
            String normalizedAuthorUsername,
            String normalizedSortMode,
            MainPostFeedCursor feedCursor,
            int safeSize
    ) {
        if (!cachedSnapshot.stale()) {
            return;
        }
        PlatformAsyncRefreshCoordinator.TriggerOutcome refreshOutcome = asyncRefreshCoordinator.trigger(
                "main-post-feed-page-refresh:" + String.valueOf(cacheKey),
                () -> {
                    try {
                        feedPageCache.recordLoaderHit();
                        FeedPageResponse<MainPostSummaryResponse> refreshedResponse = loadActiveDatabaseFeedPage(
                                normalizedCommunitySlug,
                                normalizedAuthorUsername,
                                normalizedSortMode,
                                feedCursor,
                                safeSize
                        );
                        feedPageCache.putFeedPage(cacheKey, refreshedResponse);
                    } catch (RuntimeException error) {
                        log.warn("main_post_feed_page_async_refresh_failed key={}", cacheKey, error);
                    }
                },
                feedPageCache::recordRequestMerge
        );
        if (refreshOutcome == PlatformAsyncRefreshCoordinator.TriggerOutcome.EXECUTED) {
            feedPageCache.recordRefresh();
            return;
        }
        feedPageCache.recordRefreshMerge();
    }

    private String buildFeedPageSingleFlightKey(MainPostFeedPageCacheKey cacheKey) {
        return "main-post-feed-page:" + String.valueOf(cacheKey);
    }

    private String normalizeCacheCursor(String cursor, MainPostFeedCursor feedCursor) {
        if (feedCursor == null || cursor == null || cursor.isBlank()) {
            return null;
        }
        return cursor.trim();
    }

    private FeedPageResponse<MainPostSummaryResponse> listSearchFeed(
            String normalizedCommunitySlug,
            String normalizedKeyword,
            String normalizedSortMode,
            MainPostFeedCursor feedCursor,
            int safeSize,
            String authorizationHeader
    ) {
        int offset = feedCursor == null || feedCursor.searchOffset() == null
                ? 0
                : Math.max(0, feedCursor.searchOffset());
        MainPostSearchResult searchResult;
        int searchLimit = normalizeSearchFetchLimit(safeSize);
        try {
            searchResult = searchQueryService.search(new MainPostSearchRequest(
                    normalizedKeyword,
                    normalizedCommunitySlug,
                    normalizedSortMode,
                    offset,
                    searchLimit
            ));
        } catch (RuntimeException ex) {
            return listDatabaseSearchFeed(
                    normalizedCommunitySlug,
                    normalizedKeyword,
                    normalizedSortMode,
                    offset,
                    safeSize,
                    authorizationHeader
            );
        }
        List<Long> mainPostIds = searchResult.mainPostIds();
        if (mainPostIds == null || mainPostIds.isEmpty()) {
            return new FeedPageResponse<>(List.of(), "", false);
        }
        List<MybatisMainPostFeedItemRow> rows = feedMapper.selectFeedByIds(mainPostIds);
        Map<Long, MybatisMainPostFeedItemRow> rowsById = new LinkedHashMap<>();
        for (MybatisMainPostFeedItemRow row : rows) {
            rowsById.put(row.getMainPostId(), row);
        }
        List<MybatisMainPostFeedItemRow> orderedRows = mainPostIds.stream()
                .map(rowsById::get)
                .filter(Objects::nonNull)
                .toList();
        List<MybatisMainPostFeedItemRow> pageRows = orderedRows.stream()
                .limit(safeSize)
                .toList();
        List<MainPostSummaryResponse> items = pageRows.stream()
                .map(this::toSummary)
                .toList();
        FeedPageResponse<MainPostSummaryResponse> activePage = filterActiveFeedPage(
                new FeedPageResponse<>(items, "", false)
        );
        items = activePage.posts();
        AuthContext authContext = viewerInteractionResolver.resolveOptional(authorizationHeader);
        items = viewerInteractionResolver.applyToSummaryItems(items, authContext);
        int consumedHits = countConsumedSearchHits(mainPostIds, rowsById, safeSize);
        int nextOffset = offset + consumedHits;
        boolean hasMore = nextOffset < searchResult.totalHits();
        String nextCursor = hasMore ? encodeSearchCursor(normalizedSortMode, nextOffset) : "";
        return new FeedPageResponse<>(items, nextCursor, hasMore);
    }

    private FeedPageResponse<MainPostSummaryResponse> listDatabaseSearchFeed(
            String normalizedCommunitySlug,
            String normalizedKeyword,
            String normalizedSortMode,
            int offset,
            int safeSize,
            String authorizationHeader
    ) {
        List<MybatisMainPostFeedItemRow> rows = feedMapper.selectFeedSearchOffset(
                normalizedCommunitySlug,
                normalizedKeyword,
                normalizedSortMode,
                safeSize + 1,
                offset
        );
        boolean hasMore = rows.size() > safeSize;
        List<MybatisMainPostFeedItemRow> pageRows = hasMore ? rows.subList(0, safeSize) : rows;
        List<MainPostSummaryResponse> items = pageRows.stream()
                .map(this::toSummary)
                .toList();
        FeedPageResponse<MainPostSummaryResponse> activePage = filterActiveFeedPage(
                new FeedPageResponse<>(items, "", false)
        );
        items = activePage.posts();
        AuthContext authContext = viewerInteractionResolver.resolveOptional(authorizationHeader);
        items = viewerInteractionResolver.applyToSummaryItems(items, authContext);
        String nextCursor = hasMore ? encodeSearchCursor(normalizedSortMode, offset + safeSize) : "";
        return new FeedPageResponse<>(items, nextCursor, hasMore);
    }

    private FeedPageResponse<MainPostSummaryResponse> filterActiveFeedPage(
            FeedPageResponse<MainPostSummaryResponse> response
    ) {
        if (response == null || response.posts() == null || response.posts().isEmpty()) {
            return response == null ? new FeedPageResponse<>(List.of(), "", false) : response;
        }
        Set<Long> activeMainPostIds = loadActiveMainPostIds(response.posts());
        List<MainPostSummaryResponse> activePosts = response.posts().stream()
                .filter(post -> post != null && activeMainPostIds.contains(post.id()))
                .toList();
        if (activePosts.size() == response.posts().size()) {
            return response;
        }
        return new FeedPageResponse<>(activePosts, response.nextCursor(), response.hasMore());
    }

    private Set<Long> loadActiveMainPostIds(List<MainPostSummaryResponse> posts) {
        List<Long> mainPostIds = posts.stream()
                .filter(Objects::nonNull)
                .map(MainPostSummaryResponse::id)
                .filter(id -> id != null && id > 0L)
                .distinct()
                .toList();
        if (mainPostIds.isEmpty()) {
            return Set.of();
        }
        return referenceAvailabilityService.loadActiveMainPostIds(mainPostIds);
    }

    private MainPostSummaryResponse toSummary(MybatisMainPostFeedItemRow row) {
        return new MainPostSummaryResponse(
                row.getMainPostId(),
                row.getCommunitySlug(),
                row.getCommunityName(),
                row.getTitle(),
                row.getContentPreview(),
                row.getPostMode(),
                row.getAuthorUsername(),
                toInstant(row.getCreatedAt()),
                toInstant(row.getUpdatedAt()),
                toInstant(row.getLatestActivityAt()),
                row.getHeatScore(),
                row.getViewCount(),
                row.getSubPostCount(),
                row.getLikeCount(),
                row.getFavoriteCount(),
                false,
                false,
                parseMediaAssets(row.getMediaAssetsJson()),
                parseStringList(row.getPreviewImageUrlsJson()),
                parseStringList(row.getTagsJson())
        );
    }

    private String encodeCursor(String sortMode, MybatisMainPostFeedItemRow row) {
        try {
            MainPostFeedCursor cursor = new MainPostFeedCursor(
                    sortMode,
                    row.getMainPostId(),
                    toInstant(row.getLatestActivityAt()),
                    toInstant(row.getCreatedAt()),
                    row.getHeatScore(),
                    row.getViewCount(),
                    null
            );
            String json = objectMapper.writeValueAsString(cursor);
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(json.getBytes(StandardCharsets.UTF_8));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to encode feed cursor.", ex);
        }
    }

    private String encodeSearchCursor(String sortMode, int offset) {
        try {
            MainPostFeedCursor cursor = new MainPostFeedCursor(
                    sortMode,
                    null,
                    null,
                    null,
                    null,
                    null,
                    offset
            );
            String json = objectMapper.writeValueAsString(cursor);
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(json.getBytes(StandardCharsets.UTF_8));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to encode feed search cursor.", ex);
        }
    }

    private MainPostFeedCursor decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(cursor.trim());
            return objectMapper.readValue(new String(bytes, StandardCharsets.UTF_8), MainPostFeedCursor.class);
        } catch (Exception ex) {
            return null;
        }
    }

    private String normalizeCommunitySlug(String communitySlug) {
        if (communitySlug == null || communitySlug.isBlank() || "lobby".equalsIgnoreCase(communitySlug)) {
            return null;
        }
        return communitySlug.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim().toLowerCase(Locale.ROOT);
    }

    private int normalizeSize(Integer size) {
        if (size == null || size <= 0) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    private int normalizeSearchFetchLimit(int safeSize) {
        return Math.min(MAX_SEARCH_FETCH_SIZE, Math.max(safeSize, safeSize * SEARCH_OVERFETCH_MULTIPLIER));
    }

    private int countConsumedSearchHits(
            List<Long> mainPostIds,
            Map<Long, MybatisMainPostFeedItemRow> rowsById,
            int safeSize
    ) {
        int consumedHits = 0;
        int activeRows = 0;
        for (Long mainPostId : mainPostIds) {
            consumedHits += 1;
            if (rowsById.containsKey(mainPostId)) {
                activeRows += 1;
                if (activeRows >= safeSize) {
                    break;
                }
            }
        }
        return consumedHits;
    }

    private Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private List<String> parseStringList(String json) {
        return parseList(json, STRING_LIST_TYPE);
    }

    private List<MediaAssetResponse> parseMediaAssets(String json) {
        return parseList(json, MEDIA_ASSET_LIST_TYPE);
    }

    private <T> List<T> parseList(String json, TypeReference<List<T>> type) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<T> items = objectMapper.readValue(json, type);
            if (items == null || items.isEmpty()) {
                return List.of();
            }
            return items.stream().filter(Objects::nonNull).toList();
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to parse feed projection JSON.", ex);
        }
    }
}
