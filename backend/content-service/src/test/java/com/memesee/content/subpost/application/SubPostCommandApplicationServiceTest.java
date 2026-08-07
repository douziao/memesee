package com.memesee.content.subpost.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.memesee.content.common.auth.AuthContextResolver;
import com.memesee.content.common.auth.JwtService;
import com.memesee.content.common.observability.ContentCommandTelemetry;
import com.memesee.content.mainpost.application.MainPostCollaborationApplicationService;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.media.application.SubPostMediaCollaborationApplicationService;
import com.memesee.content.media.application.SubPostMediaCommandCollaborationApplicationService;
import com.memesee.content.media.dto.MediaAssetResponse;
import com.memesee.content.sideeffect.application.ContentSideEffectPublisher;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.dto.CreateSubPostRequest;
import com.memesee.content.subpost.dto.UpdateSubPostRequest;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class SubPostCommandApplicationServiceTest {

    private final SubPostRepository subPostRepository = mock(SubPostRepository.class);
    private final TestMainPostCollaborationApplicationService mainPostCollaborationApplicationService =
            new TestMainPostCollaborationApplicationService();
    private final TestSubPostMediaCommandCollaborationApplicationService mediaCommandService =
            new TestSubPostMediaCommandCollaborationApplicationService();
    private final TestSubPostMediaCollaborationApplicationService mediaQueryService =
            new TestSubPostMediaCollaborationApplicationService();
    private final TestSubPostApplicationSupport subPostApplicationSupport =
            new TestSubPostApplicationSupport();
    private final TestContentSideEffectPublisher sideEffectPublisher =
            new TestContentSideEffectPublisher();
    private final CapturingContentCommandTelemetry contentCommandTelemetry = new CapturingContentCommandTelemetry();
    private final SubPostCommandApplicationService service = new SubPostCommandApplicationService(
            subPostRepository,
            mainPostCollaborationApplicationService,
            new AuthContextResolver(new FixedJwtService()),
            mediaCommandService,
            mediaQueryService,
            subPostApplicationSupport,
            sideEffectPublisher,
            contentCommandTelemetry
    );

    @Test
    void createSubPostAllowsMediaOnlyReply() {
        MainPost mainPost = mainPost(42L);
        List<SubPost> savedSubPosts = new ArrayList<>();
        mainPostCollaborationApplicationService.activeMainPost = mainPost;
        when(subPostRepository.save(any(SubPost.class))).thenAnswer(invocation -> {
            SubPost subPost = invocation.getArgument(0);
            writeField(subPost, "id", 7L);
            savedSubPosts.add(subPost);
            return subPost;
        });

        service.createSubPost(42L, "Bearer token", new CreateSubPostRequest(null, "   ", List.of(99L)));

        assertThat(savedSubPosts).hasSize(1);
        assertThat(savedSubPosts.getFirst().getContent()).isEmpty();
        assertThat(mediaCommandService.syncedSubPostIds).containsExactly(7L);
        assertThat(mediaCommandService.syncedMediaAssetIds).containsExactly(List.of(99L));
        assertThat(sideEffectPublisher.createdSubPostIds).containsExactly(7L);
        assertThat(mainPost.getSubPostCount()).isEqualTo(1L);

        assertThat(contentCommandTelemetry.observations).hasSize(1);
        ContentCommandTelemetry.CommandObservation observation = contentCommandTelemetry.observations.getFirst();
        assertThat(observation.aggregate()).isEqualTo("sub-post");
        assertThat(observation.operation()).isEqualTo("create");
        assertThat(observation.outcome()).isEqualTo("success");
        assertThat(observation.mainPostId()).isEqualTo(42L);
        assertThat(observation.subPostId()).isEqualTo(7L);
        assertThat(observation.mediaAssetCount()).isEqualTo(1);
    }

    @Test
    void updateSubPostPublishesChangedEventWithoutDeletingNotificationReferences() {
        MainPost mainPost = mainPost(42L);
        SubPost subPost = subPost(7L, 42L);
        mainPostCollaborationApplicationService.activeMainPost = mainPost;
        subPostApplicationSupport.activeSubPost = subPost;

        service.updateSubPost(7L, "Bearer token", new UpdateSubPostRequest("  新内容  ", List.of(11L)));

        assertThat(subPost.getContent()).isEqualTo("新内容");
        assertThat(mediaCommandService.syncedSubPostIds).containsExactly(7L);
        assertThat(sideEffectPublisher.changedMainPostIds).containsExactly(42L);
        assertThat(sideEffectPublisher.deletedSubPostIds).isEmpty();

        assertThat(contentCommandTelemetry.observations).hasSize(1);
        ContentCommandTelemetry.CommandObservation observation = contentCommandTelemetry.observations.getFirst();
        assertThat(observation.aggregate()).isEqualTo("sub-post");
        assertThat(observation.operation()).isEqualTo("update");
        assertThat(observation.outcome()).isEqualTo("success");
        assertThat(observation.mainPostId()).isEqualTo(42L);
        assertThat(observation.subPostId()).isEqualTo(7L);
        assertThat(observation.mediaAssetCount()).isEqualTo(1);
        assertThat(observation.postMode()).isEqualTo("reply");
        assertThat(observation.durationNanos()).isPositive();
    }

    @Test
    void deleteSubPostPublishesDeletedEventForNotificationReferenceInvalidation() {
        MainPost mainPost = mainPost(42L);
        SubPost subPost = subPost(7L, 42L);
        mainPostCollaborationApplicationService.activeMainPost = mainPost;
        subPostApplicationSupport.activeSubPost = subPost;
        when(subPostRepository.findFirstByMainPostIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(42L))
                .thenReturn(Optional.empty());

        service.deleteSubPost(7L, "Bearer token");

        assertThat(subPost.getDeletedAt()).isNotNull();
        assertThat(mediaCommandService.clearedSubPostIds).containsExactly(7L);
        assertThat(sideEffectPublisher.deletedSubPostIds).containsExactly(7L);
        assertThat(sideEffectPublisher.changedMainPostIds).isEmpty();

        assertThat(contentCommandTelemetry.observations).hasSize(1);
        ContentCommandTelemetry.CommandObservation observation = contentCommandTelemetry.observations.getFirst();
        assertThat(observation.aggregate()).isEqualTo("sub-post");
        assertThat(observation.operation()).isEqualTo("delete");
        assertThat(observation.outcome()).isEqualTo("success");
        assertThat(observation.mainPostId()).isEqualTo(42L);
        assertThat(observation.subPostId()).isEqualTo(7L);
        assertThat(observation.mediaAssetCount()).isZero();
    }

    private MainPost mainPost(Long id) {
        MainPost mainPost = new MainPost(10L, "owner", "title", "content");
        writeField(mainPost, "id", id);
        return mainPost;
    }

    private SubPost subPost(Long id, Long mainPostId) {
        SubPost subPost = new SubPost(mainPostId, null, "alice", "content");
        writeField(subPost, "id", id);
        return subPost;
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

    private static class TestMainPostCollaborationApplicationService
            implements MainPostCollaborationApplicationService {
        private MainPost activeMainPost;

        @Override
        public MainPost requireActiveMainPost(Long mainPostId) {
            return activeMainPost;
        }
    }

    private static class TestSubPostMediaCommandCollaborationApplicationService
            implements SubPostMediaCommandCollaborationApplicationService {
        private final List<Long> syncedSubPostIds = new ArrayList<>();
        private final List<Long> clearedSubPostIds = new ArrayList<>();
        private final List<List<Long>> syncedMediaAssetIds = new ArrayList<>();

        @Override
        public void syncSubPostMedia(Long subPostId, String ownerUsername, List<Long> mediaAssetIds) {
            syncedSubPostIds.add(subPostId);
            syncedMediaAssetIds.add(mediaAssetIds == null ? List.of() : List.copyOf(mediaAssetIds));
        }

        @Override
        public void clearSubPostMedia(Long subPostId) {
            clearedSubPostIds.add(subPostId);
        }
    }

    private static class TestSubPostMediaCollaborationApplicationService
            implements SubPostMediaCollaborationApplicationService {
        @Override
        public Map<Long, List<MediaAssetResponse>> resolveSubPostMedia(Collection<SubPost> subPosts) {
            return Map.of();
        }

        @Override
        public Map<Long, List<MediaAssetResponse>> resolveSubPostMediaByIds(Collection<Long> subPostIds) {
            return Map.of();
        }
    }

    private static class TestSubPostApplicationSupport extends SubPostApplicationSupport {
        private SubPost activeSubPost;

        TestSubPostApplicationSupport() {
            super(null, null);
        }

        @Override
        public SubPost requireActiveSubPost(Long subPostId) {
            return activeSubPost;
        }

        @Override
        public Map<Long, Long> loadFavoriteCounts(List<Long> subPostIds) {
            return Map.of();
        }

        @Override
        public ViewerInteractionState loadViewerInteractionState(List<Long> subPostIds, String username) {
            return ViewerInteractionState.empty();
        }
    }

    private static class TestContentSideEffectPublisher implements ContentSideEffectPublisher {
        private final List<Long> createdSubPostIds = new ArrayList<>();
        private final List<Long> changedMainPostIds = new ArrayList<>();
        private final List<Long> deletedSubPostIds = new ArrayList<>();

        @Override
        public void onMainPostCreated(MainPost mainPost) {
        }

        @Override
        public void onMainPostChanged(MainPost mainPost) {
        }

        @Override
        public void onMainPostDeleted(MainPost mainPost) {
        }

        @Override
        public void onMainPostViewed(MainPost mainPost) {
        }

        @Override
        public void onMainPostLiked(MainPost mainPost, String actorUsername) {
        }

        @Override
        public void onMainPostUnliked(MainPost mainPost, String actorUsername) {
        }

        @Override
        public void onMainPostFavorited(MainPost mainPost, String actorUsername) {
        }

        @Override
        public void onMainPostUnfavorited(MainPost mainPost, String actorUsername) {
        }

        @Override
        public void onSubPostCreated(
                MainPost mainPost,
                SubPost subPost,
                String actorUsername,
                String parentSubPostAuthorUsername
        ) {
            createdSubPostIds.add(subPost.getId());
        }

        @Override
        public void onSubPostChanged(MainPost mainPost) {
            changedMainPostIds.add(mainPost.getId());
        }

        @Override
        public void onSubPostDeleted(MainPost mainPost, SubPost subPost) {
            deletedSubPostIds.add(subPost.getId());
        }

        @Override
        public void onSubPostLiked(MainPost mainPost, SubPost subPost, String actorUsername) {
        }

        @Override
        public void onSubPostUnliked(SubPost subPost, String actorUsername) {
        }

        @Override
        public void onSubPostFavorited(MainPost mainPost, SubPost subPost, String actorUsername) {
        }

        @Override
        public void onSubPostUnfavorited(SubPost subPost, String actorUsername) {
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
