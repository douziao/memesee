export function buildSubPostThreadStateLayoutInput({ subPostThreadState }) {
  return {
    showTopSubPostComposer: subPostThreadState.showTopSubPostComposer,
    activeSubPostTarget: subPostThreadState.activeSubPostTarget,
    subPostInput: subPostThreadState.subPostInput,
    subPostMediaAssets: subPostThreadState.subPostMediaAssets,
    uploadingSubPostMedia: subPostThreadState.uploadingSubPostMedia,
    subPostMediaUploadStatus: subPostThreadState.subPostMediaUploadStatus,
    submittingSubPost: subPostThreadState.submittingSubPost,
    collapsedSubPostBranches: subPostThreadState.collapsedSubPostBranches,
    subPostMoreMenuId: subPostThreadState.subPostMoreMenuId,
    targetSubPostStatus: subPostThreadState.targetSubPostStatus,
  };
}
