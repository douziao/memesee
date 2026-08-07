package com.memesee.content.feed.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.memesee.content.common.application.ContentReferenceAvailabilityService;
import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.feed.dto.FeedPageResponse;
import com.memesee.content.feed.infrastructure.MainPostFeedPageCache;
import com.memesee.content.feed.infrastructure.MainPostFeedPageCacheKey;
import com.memesee.content.feed.infrastructure.MybatisMainPostFeedItemRow;
import com.memesee.content.feed.infrastructure.MybatisMainPostFeedMapper;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.application.MainPostViewerInteractionResolver;
import com.memesee.content.mainpost.dto.MainPostSummaryResponse;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.search.application.MainPostSearchQueryService;
import com.memesee.content.search.application.MainPostSearchRequest;
import com.memesee.content.search.application.MainPostSearchResult;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class MainPostFeedQueryApplicationServiceTest {

    private final MybatisMainPostFeedMapper feedMapper = mock(MybatisMainPostFeedMapper.class);
    private final MainPostFeedPageCache feedPageCache = mock(MainPostFeedPageCache.class);
    private final MainPostSearchQueryService searchQueryService = mock(MainPostSearchQueryService.class);
    private final MainPostRepository mainPostRepository = mock(MainPostRepository.class);
    private final ContentReferenceAvailabilityService referenceAvailabilityService =
            new ContentReferenceAvailabilityService(mainPostRepository, mock(SubPostRepository.class));
    private final MainPostFeedQueryApplicationService service = new MainPostFeedQueryApplicationService(
            feedMapper,
            new PassthroughViewerInteractionResolver(),
            null,
            searchQueryService,
            feedPageCache,
            referenceAvailabilityService,
            new ObjectMapper().registerModule(new JavaTimeModule())
    );

    @BeforeEach
    void setUp() {
        when(feedPageCache.getFeedPageSnapshot(any())).thenCallRealMethod();
        when(feedPageCache.getFeedPage(any())).thenReturn(Optional.empty());
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(any())).thenAnswer(invocation -> {
            Collection<Long> ids = invocation.getArgument(0);
            if (ids == null) {
                return List.of();
            }
            return ids.stream().map(this::mainPost).toList();
        });
    }

    @Test
    void listFeedUsesSizePlusOneForHasMoreAndEncodesStableNextCursor() {
        Instant createdAt = Instant.parse("2026-06-08T00:00:00Z");
        when(feedMapper.selectFeed(
                eq("memes"),
                eq(null),
                eq(null),
                eq("MOST_VIEWS"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(3)
        )).thenReturn(List.of(
                row(100L, 30L, createdAt.plusSeconds(3), createdAt.plusSeconds(30), "30.000000"),
                row(99L, 20L, createdAt.plusSeconds(2), createdAt.plusSeconds(20), "20.000000"),
                row(98L, 10L, createdAt.plusSeconds(1), createdAt.plusSeconds(10), "10.000000")
        ));

        FeedPageResponse<MainPostSummaryResponse> firstPage = service.listFeed(
                " MeMes ",
                "",
                "most_views",
                "",
                2,
                ""
        );

        assertThat(firstPage.posts()).extracting(MainPostSummaryResponse::id).containsExactly(100L, 99L);
        assertThat(firstPage.hasMore()).isTrue();
        assertThat(firstPage.nextCursor()).isNotBlank();
        assertThat(firstPage.posts().get(0).communitySlug()).isEqualTo("memes");
        assertThat(firstPage.posts().get(0).tags()).containsExactly("tag");
        verify(feedPageCache).putFeedPage(
                new MainPostFeedPageCacheKey("memes", "MOST_VIEWS", null, 2),
                firstPage
        );
    }

    @Test
    void listFeedPassesMostViewsCursorFieldsToNextPageQuery() {
        Instant createdAt = Instant.parse("2026-06-08T00:00:00Z");
        when(feedMapper.selectFeed(
                eq(null),
                eq(null),
                eq(null),
                eq("MOST_VIEWS"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(3)
        )).thenReturn(List.of(
                row(100L, 30L, createdAt.plusSeconds(3), createdAt.plusSeconds(30), "30.000000"),
                row(99L, 20L, createdAt.plusSeconds(2), createdAt.plusSeconds(20), "20.000000"),
                row(98L, 10L, createdAt.plusSeconds(1), createdAt.plusSeconds(10), "10.000000")
        ));
        String cursor = service.listFeed(null, null, "most_views", null, 2, null).nextCursor();

        when(feedMapper.selectFeed(
                eq(null),
                eq(null),
                eq(null),
                eq("MOST_VIEWS"),
                eq(99L),
                eq(Timestamp.from(createdAt.plusSeconds(20))),
                eq(Timestamp.from(createdAt.plusSeconds(2))),
                eq(new BigDecimal("20.000000")),
                eq(20L),
                eq(3)
        )).thenReturn(List.of(row(97L, 9L, createdAt, createdAt, "9.000000")));

        FeedPageResponse<MainPostSummaryResponse> secondPage = service.listFeed(
                null,
                null,
                "most_views",
                cursor,
                2,
                null
        );

        assertThat(secondPage.posts()).extracting(MainPostSummaryResponse::id).containsExactly(97L);
        assertThat(secondPage.hasMore()).isFalse();
        assertThat(secondPage.nextCursor()).isEmpty();
    }

    @Test
    void listFeedDropsCursorWhenSortModeChangesAndCapsOversizedPageRequests() {
        Instant createdAt = Instant.parse("2026-06-08T00:00:00Z");
        when(feedMapper.selectFeed(
                eq(null),
                eq(null),
                eq(null),
                eq("MOST_VIEWS"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(3)
        )).thenReturn(List.of(
                row(100L, 30L, createdAt.plusSeconds(3), createdAt.plusSeconds(30), "30.000000"),
                row(99L, 20L, createdAt.plusSeconds(2), createdAt.plusSeconds(20), "20.000000"),
                row(98L, 10L, createdAt.plusSeconds(1), createdAt.plusSeconds(10), "10.000000")
        ));
        String mostViewsCursor = service.listFeed(null, null, "most_views", null, 2, null).nextCursor();
        when(feedMapper.selectFeed(
                eq(null),
                eq(null),
                eq(null),
                eq("LATEST_MESSAGE"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(61)
        )).thenReturn(List.of());

        service.listFeed(null, null, "latest_message", mostViewsCursor, 999, null);

        verify(feedMapper).selectFeed(
                eq(null),
                eq(null),
                eq(null),
                eq("LATEST_MESSAGE"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(61)
        );
        verify(feedPageCache).putFeedPage(
                new MainPostFeedPageCacheKey(null, "LATEST_MESSAGE", null, 60),
                new FeedPageResponse<>(List.of(), "", false)
        );
    }

    @Test
    void searchFeedOverfetchesAndKeepsCursorAfterConsumedSearchHits() {
        Instant createdAt = Instant.parse("2026-06-08T00:00:00Z");
        when(searchQueryService.search(any())).thenReturn(
                new MainPostSearchResult(List.of(100L, 99L, 98L, 97L), 5L),
                new MainPostSearchResult(List.of(), 5L)
        );
        when(feedMapper.selectFeedByIds(List.of(100L, 99L, 98L, 97L))).thenReturn(List.of(
                row(99L, 30L, createdAt.plusSeconds(3), createdAt.plusSeconds(30), "30.000000"),
                row(98L, 20L, createdAt.plusSeconds(2), createdAt.plusSeconds(20), "20.000000"),
                row(97L, 10L, createdAt.plusSeconds(1), createdAt.plusSeconds(10), "10.000000")
        ));

        FeedPageResponse<MainPostSummaryResponse> firstPage = service.listFeed(
                null,
                " meme ",
                "latest_message",
                null,
                2,
                null
        );
        service.listFeed(null, "meme", "latest_message", firstPage.nextCursor(), 2, null);

        assertThat(firstPage.posts()).extracting(MainPostSummaryResponse::id).containsExactly(99L, 98L);
        assertThat(firstPage.hasMore()).isTrue();
        assertThat(firstPage.nextCursor()).isNotBlank();

        ArgumentCaptor<MainPostSearchRequest> searchRequestCaptor =
                ArgumentCaptor.forClass(MainPostSearchRequest.class);
        verify(searchQueryService, times(2)).search(searchRequestCaptor.capture());
        assertThat(searchRequestCaptor.getAllValues().get(0).offset()).isZero();
        assertThat(searchRequestCaptor.getAllValues().get(0).limit()).isEqualTo(4);
        assertThat(searchRequestCaptor.getAllValues().get(1).offset()).isEqualTo(3);
        assertThat(searchRequestCaptor.getAllValues().get(1).limit()).isEqualTo(4);
    }

    @Test
    void cachedFeedPageDropsPostsThatAreNoLongerActiveInAuthoritativeStore() {
        Instant now = Instant.parse("2026-06-08T00:00:00Z");
        MainPostSummaryResponse activePost = summary(42L, "visible title", "visible preview", now);
        MainPostSummaryResponse deletedPost = summary(99L, "stale deleted title", "stale deleted preview", now);
        when(feedPageCache.getFeedPage(any()))
                .thenReturn(Optional.of(new FeedPageResponse<>(
                        List.of(activePost, deletedPost),
                        "next-cursor",
                        true
                )));
        doReturn(List.of(mainPost(42L)))
                .when(mainPostRepository)
                .findAllByIdInAndDeletedAtIsNull(any());

        FeedPageResponse<MainPostSummaryResponse> response = service.listFeed(
                null,
                null,
                "latest_message",
                null,
                20,
                null
        );

        assertThat(response.posts()).extracting(MainPostSummaryResponse::id).containsExactly(42L);
        assertThat(response.posts()).noneSatisfy(post -> {
            assertThat(post.title()).contains("stale deleted");
            assertThat(post.contentPreview()).contains("stale deleted");
        });
        assertThat(response.nextCursor()).isEqualTo("next-cursor");
        assertThat(response.hasMore()).isTrue();
    }

    @Test
    @SuppressWarnings("unchecked")
    void cacheMissFeedPageDropsStaleProjectionRowsBeforeCaching() {
        Instant createdAt = Instant.parse("2026-06-08T00:00:00Z");
        when(feedMapper.selectFeed(
                eq(null),
                eq(null),
                eq(null),
                eq("LATEST_MESSAGE"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(21)
        )).thenReturn(List.of(
                row(42L, 20L, createdAt, createdAt, "20.000000"),
                row(99L, 30L, createdAt.plusSeconds(1), createdAt.plusSeconds(10), "30.000000")
        ));
        doReturn(List.of(mainPost(42L)))
                .when(mainPostRepository)
                .findAllByIdInAndDeletedAtIsNull(any());

        FeedPageResponse<MainPostSummaryResponse> response = service.listFeed(
                null,
                null,
                "latest_message",
                null,
                20,
                null
        );

        assertThat(response.posts()).extracting(MainPostSummaryResponse::id).containsExactly(42L);
        assertThat(response.posts()).noneSatisfy(post -> {
            assertThat(post.title()).isEqualTo("帖子 99");
            assertThat(post.contentPreview()).isEqualTo("摘要 99");
        });
        ArgumentCaptor<FeedPageResponse<MainPostSummaryResponse>> cachedResponseCaptor =
                ArgumentCaptor.forClass(FeedPageResponse.class);
        verify(feedPageCache).putFeedPage(
                eq(new MainPostFeedPageCacheKey(null, "LATEST_MESSAGE", null, 20)),
                cachedResponseCaptor.capture()
        );
        assertThat(cachedResponseCaptor.getValue().posts())
                .extracting(MainPostSummaryResponse::id)
                .containsExactly(42L);
    }

    @Test
    void searchFeedDropsRowsThatAreNoLongerActiveInAuthoritativeStore() {
        Instant createdAt = Instant.parse("2026-06-08T00:00:00Z");
        when(searchQueryService.search(any())).thenReturn(
                new MainPostSearchResult(List.of(99L, 42L), 2L)
        );
        when(feedMapper.selectFeedByIds(List.of(99L, 42L))).thenReturn(List.of(
                row(99L, 30L, createdAt.plusSeconds(1), createdAt.plusSeconds(10), "30.000000"),
                row(42L, 20L, createdAt, createdAt, "20.000000")
        ));
        doReturn(List.of(mainPost(42L)))
                .when(mainPostRepository)
                .findAllByIdInAndDeletedAtIsNull(any());

        FeedPageResponse<MainPostSummaryResponse> response = service.listFeed(
                null,
                "stale",
                "latest_message",
                null,
                2,
                null
        );

        assertThat(response.posts()).extracting(MainPostSummaryResponse::id).containsExactly(42L);
        assertThat(response.posts()).noneSatisfy(post -> {
            assertThat(post.title()).isEqualTo("帖子 99");
            assertThat(post.contentPreview()).isEqualTo("摘要 99");
        });
    }

    private MybatisMainPostFeedItemRow row(
            Long id,
            long viewCount,
            Instant createdAt,
            Instant latestActivityAt,
            String heatScore
    ) {
        MybatisMainPostFeedItemRow row = new MybatisMainPostFeedItemRow();
        row.setMainPostId(id);
        row.setCommunitySlug("memes");
        row.setCommunityName("梗图");
        row.setTitle("帖子 " + id);
        row.setContentPreview("摘要 " + id);
        row.setPostMode("long");
        row.setAuthorUsername("alice");
        row.setTagsJson("[\"tag\"]");
        row.setMediaAssetsJson("[]");
        row.setPreviewImageUrlsJson("[]");
        row.setHeatScore(new BigDecimal(heatScore));
        row.setViewCount(viewCount);
        row.setSubPostCount(0L);
        row.setLikeCount(0L);
        row.setFavoriteCount(0L);
        row.setCreatedAt(Timestamp.from(createdAt));
        row.setUpdatedAt(Timestamp.from(createdAt));
        row.setLatestActivityAt(Timestamp.from(latestActivityAt));
        return row;
    }

    private MainPostSummaryResponse summary(Long id, String title, String contentPreview, Instant timestamp) {
        return new MainPostSummaryResponse(
                id,
                "memes",
                "梗图",
                title,
                contentPreview,
                "long",
                "alice",
                timestamp,
                timestamp,
                timestamp,
                BigDecimal.ZERO,
                0L,
                0L,
                0L,
                0L,
                false,
                false,
                List.of(),
                List.of(),
                List.of("tag")
        );
    }

    private MainPost mainPost(Long id) {
        MainPost mainPost = new MainPost(10L, "alice", "title", "content");
        writeField(mainPost, "id", id);
        return mainPost;
    }

    private static void writeField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError("Unable to set field " + fieldName, exception);
        }
    }

    private static class PassthroughViewerInteractionResolver extends MainPostViewerInteractionResolver {
        PassthroughViewerInteractionResolver() {
            super(null, null);
        }

        @Override
        public AuthContext resolveOptional(String authorizationHeader) {
            return AuthContext.anonymous();
        }

        @Override
        public List<MainPostSummaryResponse> applyToSummaryItems(
                List<MainPostSummaryResponse> items,
                AuthContext authContext
        ) {
            return items == null ? List.of() : new ArrayList<>(items);
        }
    }
}
