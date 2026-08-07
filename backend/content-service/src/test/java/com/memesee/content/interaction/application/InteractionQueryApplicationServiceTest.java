package com.memesee.content.interaction.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.memesee.content.common.auth.AuthContext;
import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.common.application.ContentReferenceAvailabilityService;
import com.memesee.content.interaction.dto.MyInteractionListResponse;
import com.memesee.content.interaction.infrastructure.MyInteractionListCache;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.application.SubPostMediaCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class InteractionQueryApplicationServiceTest {

    @Test
    void includesReadySubPostImageAssetCountInMyInteractionList() {
        RecordingInteractionListProjectionPort projectionPort = new RecordingInteractionListProjectionPort();
        RecordingInteractionListCache cache = new RecordingInteractionListCache();
        RecordingSubPostMediaService mediaService = new RecordingSubPostMediaService();
        mediaService.mediaBySubPostId = Map.of(7L, List.of(
                mediaAsset(1L, "IMAGE", "READY"),
                mediaAsset(2L, "IMAGE", "READY"),
                mediaAsset(3L, "IMAGE", "PROCESSING"),
                mediaAsset(4L, "IMAGE", "FAILED"),
                mediaAsset(5L, "VIDEO", "READY")
        ));
        InteractionQueryApplicationService service = new InteractionQueryApplicationService(
                projectionPort,
                new FixedAuthContextResolver(),
                cache,
                mediaService,
                new ContentReferenceAvailabilityService(
                        mock(MainPostRepository.class),
                        mock(SubPostRepository.class)
                ),
                new PlatformAsyncRefreshCoordinator()
        );

        MyInteractionListResponse response = service.listMyInteractions("Bearer token", 20);

        assertThat(projectionPort.username).isEqualTo("alice");
        assertThat(mediaService.requestedSubPostIds).containsExactly(7L);
        assertThat(response.subPostInteractions()).singleElement()
                .extracting("subPostMediaAssetCount")
                .isEqualTo(2L);
        assertThat(cache.cachedResponse).isSameAs(response);
    }

    @Test
    void cachedInteractionListDropsUnavailableReferencesEvenWhenRefreshFails() {
        RecordingInteractionListProjectionPort projectionPort = new RecordingInteractionListProjectionPort();
        projectionPort.failOnLoad = true;
        RecordingInteractionListCache cache = new RecordingInteractionListCache();
        cache.responseToReturn = Optional.of(new MyInteractionListResponse(
                List.of(
                        postInteraction(101L, "已删除主帖标题"),
                        postInteraction(102L, "仍可见主帖标题")
                ),
                List.of(
                        subPostInteraction(201L, 301L, "已删除子帖预览"),
                        subPostInteraction(202L, 302L, "仍可见子帖预览")
                )
        ));
        MainPostRepository mainPostRepository = mock(MainPostRepository.class);
        SubPostRepository subPostRepository = mock(SubPostRepository.class);
        when(mainPostRepository.findAllByIdInAndDeletedAtIsNull(anyCollection()))
                .thenReturn(List.of(mainPost(102L), mainPost(302L)));
        when(subPostRepository.findByIdIn(anyList()))
                .thenReturn(List.of(subPost(202L, 302L)));
        InteractionQueryApplicationService service = new InteractionQueryApplicationService(
                projectionPort,
                new FixedAuthContextResolver(),
                cache,
                new RecordingSubPostMediaService(),
                new ContentReferenceAvailabilityService(mainPostRepository, subPostRepository),
                new PlatformAsyncRefreshCoordinator()
        );

        MyInteractionListResponse response = service.listMyInteractions("Bearer token", 20);

        assertThat(response.postInteractions())
                .extracting("postTitle")
                .containsExactly("仍可见主帖标题");
        assertThat(response.subPostInteractions())
                .extracting("subPostPreview")
                .containsExactly("仍可见子帖预览");
        assertThat(cache.evictedUsername).isEqualTo("alice");
        assertThat(cache.loaderHits).isEqualTo(1);
    }

    private static MediaAssetResponse mediaAsset(Long id, String kind, String processingStatus) {
        return new MediaAssetResponse(
                id,
                "asset-" + id,
                kind,
                "/media/" + id + ".jpg",
                null,
                null,
                null,
                "/media/" + id + ".jpg",
                null,
                "image/jpeg",
                id + ".jpg",
                100,
                640,
                360,
                processingStatus,
                null,
                List.of()
        );
    }

    private static com.memesee.content.interaction.dto.MyPostInteractionItemResponse postInteraction(
            Long postId,
            String title
    ) {
        return new com.memesee.content.interaction.dto.MyPostInteractionItemResponse(
                postId,
                title,
                "梗图",
                "主帖预览",
                "author",
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-01-02T00:00:00Z"),
                10,
                2,
                3,
                4,
                "favorite",
                Instant.parse("2026-01-03T00:00:00Z")
        );
    }

    private static com.memesee.content.interaction.dto.MySubPostInteractionItemResponse subPostInteraction(
            Long subPostId,
            Long mainPostId,
            String preview
    ) {
        return new com.memesee.content.interaction.dto.MySubPostInteractionItemResponse(
                subPostId,
                mainPostId,
                "主帖",
                "memes",
                "梗图",
                "主帖预览",
                "author",
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-01-02T00:00:00Z"),
                10,
                2,
                3,
                4,
                "bob",
                preview,
                1,
                "favorite",
                Instant.parse("2026-01-03T00:00:00Z")
        );
    }

    private static MainPost mainPost(Long id) {
        MainPost mainPost = new MainPost(1L, "author", "title", "content");
        setField(mainPost, "id", id);
        return mainPost;
    }

    private static SubPost subPost(Long id, Long mainPostId) {
        SubPost subPost = new SubPost(mainPostId, null, "author", "content");
        setField(subPost, "id", id);
        return subPost;
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException error) {
            throw new IllegalStateException(error);
        }
    }

    private static class FixedAuthContextResolver extends AuthContextResolver {

        private FixedAuthContextResolver() {
            super(null);
        }

        @Override
        public AuthContext resolveRequired(String authorizationHeader) {
            return new AuthContext("alice", 1);
        }
    }

    private static class RecordingInteractionListProjectionPort implements InteractionListProjectionPort {

        private String username;
        private boolean failOnLoad;

        @Override
        public InteractionListProjection loadInteractionList(String username, int limit) {
            if (failOnLoad) {
                throw new IllegalStateException("projection unavailable");
            }
            this.username = username;
            return new InteractionListProjection(
                    List.of(),
                    List.of(new SubPostInteractionProjection(
                            7L,
                            42L,
                            "主帖",
                            "memes",
                            "梗图",
                            "主帖预览",
                            "author",
                            Instant.parse("2026-01-01T00:00:00Z"),
                            Instant.parse("2026-01-02T00:00:00Z"),
                            10,
                            2,
                            3,
                            4,
                            "bob",
                            "",
                            "favorite",
                            Instant.parse("2026-01-03T00:00:00Z")
                    ))
            );
        }
    }

    private static class RecordingInteractionListCache implements MyInteractionListCache {

        private Optional<MyInteractionListResponse> responseToReturn = Optional.empty();
        private MyInteractionListResponse cachedResponse;
        private String evictedUsername;
        private int loaderHits;

        @Override
        public Optional<MyInteractionListResponse> getInteractionList(String username, int limit) {
            return responseToReturn;
        }

        @Override
        public void putInteractionList(String username, int limit, MyInteractionListResponse response) {
            cachedResponse = response;
        }

        @Override
        public void evictInteractionLists(String username) {
            evictedUsername = username;
        }

        @Override
        public void recordLoaderHit() {
            loaderHits++;
        }
    }

    private static class RecordingSubPostMediaService implements SubPostMediaCollaborationApplicationService {

        private Map<Long, List<MediaAssetResponse>> mediaBySubPostId = Map.of();
        private List<Long> requestedSubPostIds = List.of();

        @Override
        public Map<Long, List<MediaAssetResponse>> resolveSubPostMedia(Collection<SubPost> subPosts) {
            return mediaBySubPostId;
        }

        @Override
        public Map<Long, List<MediaAssetResponse>> resolveSubPostMediaByIds(Collection<Long> subPostIds) {
            requestedSubPostIds = subPostIds == null ? List.of() : List.copyOf(subPostIds);
            return mediaBySubPostId;
        }
    }
}
