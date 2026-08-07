package com.memesee.content.interaction.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.memesee.content.community.infrastructure.CommunityCatalogCache;
import com.memesee.content.community.infrastructure.CommunityRepository;
import com.memesee.content.interaction.application.InteractionListProjectionPort.InteractionListProjection;
import com.memesee.content.interaction.domain.SubPostLike;
import com.memesee.content.mainpost.domain.MainPost;
import com.memesee.content.mainpost.infrastructure.MainPostRepository;
import com.memesee.content.subpost.domain.SubPost;
import com.memesee.content.subpost.infrastructure.SubPostRepository;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class JpaInteractionListProjectionPortTest {

    private final MainPostLikeRepository mainPostLikeRepository = mock(MainPostLikeRepository.class);
    private final MainPostFavoriteRepository mainPostFavoriteRepository = mock(MainPostFavoriteRepository.class);
    private final SubPostLikeRepository subPostLikeRepository = mock(SubPostLikeRepository.class);
    private final SubPostFavoriteRepository subPostFavoriteRepository = mock(SubPostFavoriteRepository.class);
    private final MainPostRepository mainPostRepository = mock(MainPostRepository.class);
    private final SubPostRepository subPostRepository = mock(SubPostRepository.class);
    private final CommunityRepository communityRepository = mock(CommunityRepository.class);
    private final CommunityCatalogCache communityCatalogCache = mock(CommunityCatalogCache.class);

    private final JpaInteractionListProjectionPort projectionPort = new JpaInteractionListProjectionPort(
            mainPostLikeRepository,
            mainPostFavoriteRepository,
            subPostLikeRepository,
            subPostFavoriteRepository,
            mainPostRepository,
            subPostRepository,
            communityRepository,
            communityCatalogCache
    );

    @Test
    void subPostInteractionsRequireActiveParentMainPost() {
        when(mainPostLikeRepository.findAllByUsernameOrderByCreatedAtDesc(any(), any())).thenReturn(List.of());
        when(mainPostFavoriteRepository.findAllByUsernameOrderByCreatedAtDesc(any(), any())).thenReturn(List.of());
        when(subPostFavoriteRepository.findAllByUsernameOrderByCreatedAtDesc(any(), any())).thenReturn(List.of());
        when(subPostLikeRepository.findAllByUsernameOrderByCreatedAtDesc(any(), any())).thenReturn(List.of(
                subPostLike(7L, Instant.parse("2026-06-08T00:00:02Z")),
                subPostLike(8L, Instant.parse("2026-06-08T00:00:01Z"))
        ));
        when(subPostRepository.findAllById(any())).thenReturn(List.of(
                subPost(7L, 42L, "visible sub-post body"),
                subPost(8L, 99L, "hidden sub-post body")
        ));
        when(mainPostRepository.findAllById(any())).thenReturn(List.of(mainPost(42L, "visible main post")));
        when(communityCatalogCache.getCommunityById(any())).thenReturn(Optional.empty());
        when(communityRepository.findAllById(any())).thenReturn(List.of());

        InteractionListProjection projection = projectionPort.loadInteractionList("alice", 20);

        assertThat(projection.subPostInteractions()).singleElement()
                .satisfies(item -> {
                    assertThat(item.subPostId()).isEqualTo(7L);
                    assertThat(item.mainPostId()).isEqualTo(42L);
                    assertThat(item.subPostPreview()).isEqualTo("visible sub-post body");
                });
        assertThat(projection.subPostInteractions())
                .noneSatisfy(item -> assertThat(item.subPostPreview()).contains("hidden sub-post body"));
    }

    private SubPostLike subPostLike(Long subPostId, Instant createdAt) {
        SubPostLike like = new SubPostLike(subPostId, "alice");
        writeField(like, "createdAt", createdAt);
        return like;
    }

    private SubPost subPost(Long id, Long mainPostId, String content) {
        SubPost subPost = new SubPost(mainPostId, null, "author", content);
        writeField(subPost, "id", id);
        return subPost;
    }

    private MainPost mainPost(Long id, String title) {
        MainPost mainPost = new MainPost(1L, "author", title, "main post body");
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
}
