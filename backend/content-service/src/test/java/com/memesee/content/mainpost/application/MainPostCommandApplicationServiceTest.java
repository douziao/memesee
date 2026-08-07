package com.memesee.content.mainpost.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.common.auth.JwtService;
import com.memesee.content.common.observability.ContentCommandTelemetry;
import com.memesee.content.community.domain.Community;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.dto.CreateMainPostRequest;
import com.memesee.content.mainpost.dto.MainPostDetailResponse;
import com.memesee.content.mainpost.dto.UpdateMainPostRequest;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.media.application.MainPostMediaCollaborationApplicationService;
import com.memesee.content.media.application.MainPostMediaCommandCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.sideeffect.application.ContentSideEffectPublisher;
import com.memesee.platform.error.ApiErrorCode;
import com.memesee.platform.error.ApiException;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.springframework.http.HttpStatus;

class MainPostCommandApplicationServiceTest {

    private final MainPostRepository mainPostRepository = mock(MainPostRepository.class);
    private final MainPostMediaCommandCollaborationApplicationService mediaCommandService =
            mock(MainPostMediaCommandCollaborationApplicationService.class);
    private final MainPostMediaCollaborationApplicationService mediaQueryService =
            mock(MainPostMediaCollaborationApplicationService.class);
    private final ContentSideEffectPublisher sideEffectPublisher = mock(ContentSideEffectPublisher.class);
    private final TestMainPostApplicationSupport support = new TestMainPostApplicationSupport();
    private final CapturingContentCommandTelemetry contentCommandTelemetry = new CapturingContentCommandTelemetry();
    private final MainPostCommandApplicationService service = new MainPostCommandApplicationService(
            mainPostRepository,
            new AuthContextResolver(new FixedJwtService()),
            mediaCommandService,
            mediaQueryService,
            support,
            sideEffectPublisher,
            contentCommandTelemetry
    );

    @Test
    void createMainPostAllowsMediaOnlyContentAndNormalizesFields() {
        when(mainPostRepository.save(any(MainPost.class))).thenAnswer(invocation -> {
            MainPost post = invocation.getArgument(0);
            writeField(post, "id", 42L);
            return post;
        });
        when(mediaQueryService.resolveMainPostMedia(any())).thenReturn(Map.of(42L, List.of()));

        MainPostDetailResponse response = service.createMainPost(
                "Bearer token",
                new CreateMainPostRequest(
                        "memes",
                        "  标题  ",
                        "   ",
                        "rich",
                        List.of(7L),
                        List.of("#梗图", " 梗图 ", "日常")
                )
        );

        ArgumentCaptor<MainPost> postCaptor = ArgumentCaptor.forClass(MainPost.class);
        verify(mainPostRepository).save(postCaptor.capture());
        MainPost savedPost = postCaptor.getValue();
        assertThat(savedPost.getCommunityId()).isEqualTo(10L);
        assertThat(savedPost.getAuthorUsername()).isEqualTo("alice");
        assertThat(savedPost.getTitle()).isEqualTo("标题");
        assertThat(savedPost.getContent()).isEmpty();
        assertThat(savedPost.getPostMode()).isEqualTo("rich");
        assertThat(savedPost.getTags()).containsExactly("梗图", "日常");

        verify(mediaCommandService).syncMainPostMedia(42L, "alice", List.of(7L));
        verify(sideEffectPublisher).onMainPostCreated(savedPost);
        assertThat(response.id()).isEqualTo(42L);
        assertThat(response.postMode()).isEqualTo("rich");

        assertThat(contentCommandTelemetry.observations).hasSize(1);
        ContentCommandTelemetry.CommandObservation observation = contentCommandTelemetry.observations.getFirst();
        assertThat(observation.aggregate()).isEqualTo("main-post");
        assertThat(observation.operation()).isEqualTo("create");
        assertThat(observation.outcome()).isEqualTo("success");
        assertThat(observation.mainPostId()).isEqualTo(42L);
        assertThat(observation.communityId()).isEqualTo(10L);
        assertThat(observation.communitySlug()).isEqualTo("memes");
        assertThat(observation.postMode()).isEqualTo("rich");
        assertThat(observation.mediaAssetCount()).isEqualTo(1);
        assertThat(observation.tagCount()).isEqualTo(3);
        assertThat(observation.durationNanos()).isPositive();
    }

    @Test
    void createMainPostRejectsBlankContentWithoutPositiveMediaIdsBeforeSaving() {
        assertThatThrownBy(() -> service.createMainPost(
                "Bearer token",
                new CreateMainPostRequest(
                        "memes",
                        "标题",
                        "   ",
                        "long",
                        List.of(0L, -1L),
                        List.of()
                )
        ))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        verify(mainPostRepository, never()).save(any());
        verify(mediaCommandService, never()).syncMainPostMedia(any(), any(), any());
        verify(sideEffectPublisher, never()).onMainPostCreated(any());
        assertThat(contentCommandTelemetry.observations).hasSize(1);
        ContentCommandTelemetry.CommandObservation observation = contentCommandTelemetry.observations.getFirst();
        assertThat(observation.operation()).isEqualTo("create");
        assertThat(observation.outcome()).isEqualTo("error");
        assertThat(observation.mainPostId()).isNull();
        assertThat(observation.mediaAssetCount()).isEqualTo(2);
    }

    @Test
    void createMainPostRejectsTagsThatExceedTheProductLimitBeforeSaving() {
        assertThatThrownBy(() -> service.createMainPost(
                "Bearer token",
                new CreateMainPostRequest(
                        "memes",
                        "标题",
                        "内容",
                        "long",
                        List.of(),
                        List.of("tag1", "tag2", "tag3", "tag4")
                )
        ))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.INVALID_REQUEST);
                });

        verify(mainPostRepository, never()).save(any());
        verify(mediaCommandService, never()).syncMainPostMedia(any(), any(), any());
    }

    @Test
    void updateMainPostRejectsNonOwnerBeforeMutatingOrSyncingMedia() {
        MainPost existingPost = new MainPost(10L, "bob", "旧标题", "旧内容", List.of("旧"), "long");
        writeField(existingPost, "id", 42L);
        support.activeMainPost = existingPost;

        assertThatThrownBy(() -> service.updateMainPost(
                42L,
                "Bearer token",
                new UpdateMainPostRequest(
                        "新标题",
                        "新内容",
                        "rich",
                        List.of(7L),
                        List.of("新")
                )
        ))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(exception.getCode()).isEqualTo(ApiErrorCode.FORBIDDEN);
                });

        assertThat(existingPost.getTitle()).isEqualTo("旧标题");
        assertThat(existingPost.getContent()).isEqualTo("旧内容");
        assertThat(existingPost.getPostMode()).isEqualTo("long");
        assertThat(existingPost.getTags()).containsExactly("旧");
        verify(mediaCommandService, never()).syncMainPostMedia(any(), any(), any());
        verify(sideEffectPublisher, never()).onMainPostChanged(any());
        assertThat(contentCommandTelemetry.observations).hasSize(1);
        ContentCommandTelemetry.CommandObservation observation = contentCommandTelemetry.observations.getFirst();
        assertThat(observation.operation()).isEqualTo("update");
        assertThat(observation.outcome()).isEqualTo("error");
        assertThat(observation.mainPostId()).isEqualTo(42L);
        assertThat(observation.communityId()).isEqualTo(10L);
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

    private static class FixedJwtService extends JwtService {
        FixedJwtService() {
            super("test-secret-with-at-least-thirty-two-characters");
        }

        @Override
        public String extractUsername(String token) {
            return "alice";
        }

        @Override
        public int extractUserLevel(String token) {
            return 1;
        }
    }

    private static class TestMainPostApplicationSupport extends MainPostApplicationSupport {
        private final Community community = Community.snapshot(10L, "memes", "梗图", "description", 0);
        private MainPost activeMainPost;

        TestMainPostApplicationSupport() {
            super(null, null, null, null);
        }

        @Override
        public MainPost requireActiveMainPost(Long mainPostId) {
            return activeMainPost;
        }

        @Override
        public Community requireCommunityBySlug(String communitySlug) {
            return community;
        }

        @Override
        public Community requireCommunityById(Long communityId) {
            return community;
        }

        @Override
        public MainPostDetailResponse toDetailResponse(
                MainPost mainPost,
                Community community,
                boolean likedByMe,
                boolean favoritedByMe,
                List<MediaAssetResponse> mediaAssets
        ) {
            return new MainPostDetailResponse(
                    mainPost.getId(),
                    community.getSlug(),
                    community.getName(),
                    mainPost.getTitle(),
                    mainPost.getContent(),
                    mainPost.getPostMode(),
                    mainPost.getAuthorUsername(),
                    mainPost.getCreatedAt(),
                    mainPost.getUpdatedAt(),
                    mainPost.getLatestActivityAt(),
                    mainPost.getHeatScore(),
                    mainPost.getViewCount(),
                    mainPost.getSubPostCount(),
                    mainPost.getLikeCount(),
                    mainPost.getFavoriteCount(),
                    likedByMe,
                    favoritedByMe,
                    List.of(),
                    mainPost.getTags()
            );
        }

        @Override
        public Map<Long, Community> loadCommunities(Collection<Long> communityIds) {
            return Map.of(community.getId(), community);
        }
    }

    private static class CapturingContentCommandTelemetry extends ContentCommandTelemetry {
        private final List<ContentCommandTelemetry.CommandObservation> observations = new ArrayList<>();

        private CapturingContentCommandTelemetry() {
            super(new SimpleMeterRegistry());
        }

        @Override
        public void record(ContentCommandTelemetry.CommandObservation observation) {
            observations.add(observation);
        }
    }
}
