package com.memesee.content.interaction.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.memesee.content.common.application.ContentCacheInvalidationCoordinator;
import com.memesee.content.interaction.infrastructure.MainPostFavoriteRepository;
import com.memesee.content.interaction.infrastructure.MainPostLikeRepository;
import com.memesee.content.interaction.infrastructure.SubPostFavoriteRepository;
import com.memesee.content.interaction.infrastructure.SubPostLikeRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.Test;

class InteractionReferenceInvalidationServiceTest {

    private final MainPostLikeRepository mainPostLikeRepository = mock(MainPostLikeRepository.class);
    private final MainPostFavoriteRepository mainPostFavoriteRepository = mock(MainPostFavoriteRepository.class);
    private final SubPostLikeRepository subPostLikeRepository = mock(SubPostLikeRepository.class);
    private final SubPostFavoriteRepository subPostFavoriteRepository = mock(SubPostFavoriteRepository.class);
    private final RecordingContentCacheInvalidationCoordinator cacheInvalidationCoordinator =
            new RecordingContentCacheInvalidationCoordinator();
    private final InteractionReferenceInvalidationService service = new InteractionReferenceInvalidationService(
            mainPostLikeRepository,
            mainPostFavoriteRepository,
            subPostLikeRepository,
            subPostFavoriteRepository,
            cacheInvalidationCoordinator
    );

    @Test
    void invalidatesUsersWhoInteractedWithDeletedMainPostOrItsSubPosts() {
        when(mainPostLikeRepository.findDistinctUsernamesByMainPostId(42L)).thenReturn(List.of("alice", "bob"));
        when(mainPostFavoriteRepository.findDistinctUsernamesByMainPostId(42L)).thenReturn(List.of("bob", "carol"));
        when(subPostLikeRepository.findDistinctUsernamesByMainPostId(42L)).thenReturn(List.of("dave"));
        when(subPostFavoriteRepository.findDistinctUsernamesByMainPostId(42L)).thenReturn(List.of("alice", "erin"));

        service.invalidateInteractionListsReferencingMainPost(42L);

        assertThat(cacheInvalidationCoordinator.evictedUsernames)
                .containsExactly("alice", "bob", "carol", "dave", "erin");
    }

    @Test
    void invalidatesUsersWhoInteractedWithDeletedSubPost() {
        when(subPostLikeRepository.findDistinctUsernamesBySubPostId(7L)).thenReturn(List.of("alice", "bob"));
        when(subPostFavoriteRepository.findDistinctUsernamesBySubPostId(7L)).thenReturn(List.of("bob", "carol"));

        service.invalidateInteractionListsReferencingSubPost(7L);

        assertThat(cacheInvalidationCoordinator.evictedUsernames)
                .containsExactly("alice", "bob", "carol");
    }

    private static class RecordingContentCacheInvalidationCoordinator extends ContentCacheInvalidationCoordinator {
        private final List<String> evictedUsernames = new ArrayList<>();

        RecordingContentCacheInvalidationCoordinator() {
            super(null, null, null, null);
        }

        @Override
        public void onInteractionReferencesUnavailable(Collection<String> usernames) {
            evictedUsernames.addAll(usernames);
        }
    }
}
