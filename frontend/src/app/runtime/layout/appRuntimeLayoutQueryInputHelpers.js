export function buildCommunityQueryLayoutInput({
  runtimeConfig,
  feedQueryRuntime,
  communityCatalogState,
  shellNavigationState,
}) {
  return {
    loadingCommunities: communityCatalogState.loadingCommunities,
    navigationCommunities: communityCatalogState.navigationCommunities,
    selectedCommunitySlug: feedQueryRuntime?.selectedCommunitySlug,
    isCommunityCondensed: shellNavigationState.isCommunityCondensed,
    communityMarks: runtimeConfig.communityMarks,
    communityShortDescriptions: runtimeConfig.communityShortDescriptions,
    orderedCommunities: communityCatalogState.orderedCommunities,
  };
}

export function buildFeedQueryLayoutInput({
  runtimeConfig,
  feedView,
  feedQueryRuntime,
  queryRuntimeRefreshInterface,
}) {
  return {
    searchInput: feedView.searchInput,
    setSearchInput: feedView.setSearchInput,
    searchQuery: feedView.searchQuery,
    feedSortMode: feedQueryRuntime?.feedSortMode,
    sortMenuAnchor: feedView.sortMenuAnchor,
    loadingPosts: feedQueryRuntime?.loadingPosts,
    loadingMorePosts: feedView.loadingMorePosts,
    loadingMorePostsError: feedView.loadingMorePostsError,
    filteredPosts: feedView.filteredPosts,
    feedHasMore: feedView.feedHasMore,
    feedError: feedView.feedError,
    feedSortModes: runtimeConfig.feedSortModes,
    showBackTop: feedView.showBackTop,
    refreshingHomeFeed: queryRuntimeRefreshInterface.isRefreshingHomeFeed,
    clearFeedSearch: feedView.clearSearch,
    toggleSortMenu: feedView.toggleSortMenu,
    applyFeedSort: feedView.applyFeedSort,
    backToTop: feedQueryRuntime?.backToTop,
    refreshFeed: queryRuntimeRefreshInterface.refreshHomeFeed,
    refreshCurrentFeed: feedView.refreshFeed,
  };
}
