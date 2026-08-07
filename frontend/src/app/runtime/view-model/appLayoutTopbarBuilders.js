export function buildTopbarProps({
  shell,
  feed,
  notifications,
  actions,
  auth,
  refs,
}) {
  return {
    shellProps: {
      route: shell.route,
      view: shell.view,
      topbarRef: refs.topbarRef,
    },
    islandProps: {
      sortProps: {
        feedSortMode: feed.feedSortMode,
        sortMenuAnchor: feed.sortMenuAnchor,
        feedSortModes: feed.feedSortModes,
        topSortRef: refs.topSortRef,
        toggleSortMenu: feed.toggleSortMenu,
        applyFeedSort: feed.applyFeedSort,
        handleTopbarLeadingAction: actions.handleTopbarLeadingAction,
        feedSortLabel: actions.feedSortLabel,
      },
      searchProps: {
        searchInput: feed.searchInput,
        searchQuery: feed.searchQuery,
        applySearch: actions.applySearch,
        setSearchInput: feed.setSearchInput,
        clearSearch: feed.clearFeedSearch,
      },
    },
    navProps: {
      isLoggedIn: shell.isLoggedIn,
      currentUser: shell.currentUser,
      notificationUnreadCount: notifications.notificationUnreadCount,
      authModalOpen: auth.authModalOpen,
      openMineView: actions.openMineView,
      openAuthModal: auth.openAuthModal,
      openComposer: actions.openComposer,
    },
  };
}
