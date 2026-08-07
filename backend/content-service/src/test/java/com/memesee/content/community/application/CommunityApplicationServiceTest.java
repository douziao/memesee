package com.memesee.content.community.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.memesee.content.community.application.CommunityCatalogProjectionPort.CommunityCatalogProjection;
import com.memesee.content.community.domain.Community;
import com.memesee.content.community.dto.CommunityResponse;
import com.memesee.content.community.infrastructure.CommunityCatalogCache;
import com.memesee.content.community.infrastructure.CommunityRepository;
import com.memesee.platform.cache.PlatformAsyncRefreshCoordinator;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class CommunityApplicationServiceTest {

    private final CommunityCatalogProjectionPort communityCatalogProjectionPort =
            mock(CommunityCatalogProjectionPort.class);
    private final CommunityRepository communityRepository = mock(CommunityRepository.class);
    private final TestCommunityCatalogCache communityCatalogCache = new TestCommunityCatalogCache();
    private final CommunityApplicationService service = new CommunityApplicationService(
            communityCatalogProjectionPort,
            communityRepository,
            communityCatalogCache,
            new PlatformAsyncRefreshCoordinator()
    );

    @Test
    void ensureDefaultCommunitiesRefreshesCatalogCacheOnlyAfterCommit() {
        when(communityRepository.findBySlug(any())).thenReturn(Optional.empty());
        when(communityRepository.save(any(Community.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(communityCatalogProjectionPort.loadCommunityCatalog()).thenReturn(List.of(
                projection(1L, "daily"),
                projection(2L, "article")
        ));

        runWithManualTransactionSynchronization(() -> {
            service.ensureDefaultCommunities();

            assertThat(communityCatalogCache.evicted).isFalse();
            assertThat(communityCatalogCache.cachedCommunityLists).isEmpty();

            triggerAfterCommit();

            assertThat(communityCatalogCache.evicted).isTrue();
            assertThat(communityCatalogCache.cachedCommunityLists).hasSize(1);
            assertThat(communityCatalogCache.cachedCommunityLists.get(0))
                    .extracting(CommunityResponse::slug)
                    .containsExactly("daily", "article");
        });
    }

    @Test
    void ensureDefaultCommunitiesDoesNotRefreshCatalogCacheWhenTransactionDoesNotCommit() {
        when(communityRepository.findBySlug(any())).thenReturn(Optional.empty());
        when(communityRepository.save(any(Community.class))).thenAnswer(invocation -> invocation.getArgument(0));

        runWithManualTransactionSynchronization(() -> {
            service.ensureDefaultCommunities();

            assertThat(communityCatalogCache.evicted).isFalse();
            assertThat(communityCatalogCache.cachedCommunityLists).isEmpty();
        });
    }

    @Test
    void ensureDefaultCommunitiesRefreshesCatalogCacheImmediatelyWithoutTransactionSynchronization() {
        when(communityRepository.findBySlug(any())).thenReturn(Optional.empty());
        when(communityRepository.save(any(Community.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(communityCatalogProjectionPort.loadCommunityCatalog()).thenReturn(List.of(projection(1L, "daily")));

        service.ensureDefaultCommunities();

        assertThat(communityCatalogCache.evicted).isTrue();
        assertThat(communityCatalogCache.cachedCommunityLists).hasSize(1);
        assertThat(communityCatalogCache.cachedCommunityLists.get(0))
                .extracting(CommunityResponse::slug)
                .containsExactly("daily");
    }

    private CommunityCatalogProjection projection(Long id, String slug) {
        return new CommunityCatalogProjection(id, slug, slug + " name", slug + " description", id.intValue());
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

    private static class TestCommunityCatalogCache implements CommunityCatalogCache {
        private boolean evicted;
        private final List<List<CommunityResponse>> cachedCommunityLists = new ArrayList<>();

        @Override
        public Optional<List<CommunityResponse>> getCommunityList() {
            return Optional.empty();
        }

        @Override
        public Optional<CommunityResponse> getCommunity(String slug) {
            return Optional.empty();
        }

        @Override
        public Optional<CommunityResponse> getCommunityById(Long communityId) {
            return Optional.empty();
        }

        @Override
        public void putCommunityList(List<CommunityResponse> communities) {
            cachedCommunityLists.add(List.copyOf(communities));
        }

        @Override
        public void putCommunity(CommunityResponse community) {
        }

        @Override
        public void evictCommunityCatalog() {
            evicted = true;
        }
    }
}
