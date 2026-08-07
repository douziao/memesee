export function buildShellActionLayoutInput({
  shellNavigationState,
  queryRuntimeRefreshInterface,
  sessionCleanupState,
}) {
  return {
    handleTopbarLeadingAction: shellNavigationState.handleTopbarLeadingAction,
    selectCommunity: shellNavigationState.selectCommunity,
    openMineView: shellNavigationState.openMineView,
    toggleCommunityCondensed: shellNavigationState.toggleCommunityCondensed,
    refreshCurrentCommunity: queryRuntimeRefreshInterface.refreshCurrentCommunity,
    backToLatest: shellNavigationState.backToLatest,
    logout: sessionCleanupState.logout,
    openProfileCommunity: shellNavigationState.openProfileCommunity,
    openProfileLibraryPage: shellNavigationState.openProfileLibraryPage,
    openProfileNotificationPage: shellNavigationState.openProfileNotificationPage,
    backToProfileOverview: shellNavigationState.backToProfileOverview,
  };
}

export function buildComposerActionLayoutInput({
  composerDraft,
  mainPostActions,
}) {
  return {
    applySearch: mainPostActions.applySearch,
    openComposer: composerDraft.openComposer,
    openEditComposer: composerDraft.openEditComposer,
  };
}

export function buildMainPostActionLayoutInput({ mainPostActions }) {
  return {
    feedSortLabel: mainPostActions.feedSortLabel,
    deletePost: mainPostActions.deletePost,
    openPostDetail: mainPostActions.openPostDetail,
    prefetchMainPostDetail: mainPostActions.prefetchMainPostDetail,
    sharePost: mainPostActions.sharePost,
    isSharingPost: mainPostActions.isSharingPost,
  };
}
