export function buildSubPostThreadActionLayoutInput({ subPostThreadState }) {
  return {
    openMainPostSubPostComposer: subPostThreadState.openMainPostSubPostComposer,
    setSubPostInput: subPostThreadState.setSubPostInput,
    onSubPostMediaPicked: subPostThreadState.onSubPostMediaPicked,
    retryFailedSubPostMediaUploads: subPostThreadState.retryFailedSubPostMediaUploads,
    refreshSubPostMediaAssets: subPostThreadState.refreshSubPostMediaAssets,
    removeSubPostMediaAt: subPostThreadState.removeSubPostMediaAt,
    submitSubPost: subPostThreadState.submitSubPost,
    cancelTopSubPostComposer: subPostThreadState.cancelTopSubPostComposer,
    toggleSubPostBranches: subPostThreadState.toggleSubPostBranches,
    jumpToSubPostFloor: subPostThreadState.jumpToSubPostFloor,
    clearTargetSubPostLocation: subPostThreadState.clearTargetSubPostLocation,
    toggleSubPostMoreMenu: subPostThreadState.toggleSubPostMoreMenu,
    handleSubPostFavoriteFromMenu: subPostThreadState.handleSubPostFavoriteFromMenu,
    handleSubPostShareFromMenu: subPostThreadState.handleSubPostShareFromMenu,
    copyTargetSubPostLink: subPostThreadState.copyTargetSubPostLink,
    handleSubPostReport: subPostThreadState.handleSubPostReport,
    startNestedSubPostComposer: subPostThreadState.startNestedSubPostComposer,
    cancelNestedSubPostComposer: subPostThreadState.cancelNestedSubPostComposer,
    toggleSubPostLike: subPostThreadState.toggleSubPostLike,
    deleteSubPost: subPostThreadState.deleteSubPost,
  };
}
