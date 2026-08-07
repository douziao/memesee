export function buildDetailStatusProps({ detail, actions }) {
  return {
    loadingPostDetail: detail.loadingPostDetail,
    refreshingCurrentPostThread: detail.refreshingCurrentPostThread,
    postDetailErrorType: detail.postDetailErrorType,
    selectedPost: detail.selectedPost,
    refreshCurrentPostThread: detail.refreshCurrentPostThread,
    backToLatest: actions.backToLatest,
  };
}

export function buildDetailHeaderProps({ helpers }) {
  return {
    authorInitial: helpers.authorInitial,
    formatTime: helpers.formatTime,
  };
}

export function buildDetailGalleryProps({ detail }) {
  return {
    richDetailImages: detail.richDetailImages,
    richOriginalImages: detail.richOriginalImages,
    richImageSources: detail.richImageSources,
    detailMediaIndex: detail.detailMediaIndex,
    setDetailMediaIndex: detail.setDetailMediaIndex,
    openImageViewer: detail.openImageViewer,
  };
}

export function buildDetailContentProps({ detail }) {
  return {
    markdownInput: detail.detailMarkdownInput,
  };
}

export function buildDetailInteractionProps({ shell, detail, subPostThread, refs, actions, helpers, auth }) {
  return {
    metaProps: {
      selectedLikeCount: detail.selectedLikeCount,
      selectedFavoriteCount: detail.selectedFavoriteCount,
      formatHeatScore: helpers.formatHeatScore,
      formatTime: helpers.formatTime,
    },
    actionProps: {
      isLoggedIn: shell.isLoggedIn,
      openMainPostSubPostComposer: subPostThread.openMainPostSubPostComposer,
      togglePostLike: detail.togglePostLike,
      togglePostFavorite: detail.togglePostFavorite,
      handlePostReport: detail.handlePostReport,
      sharePost: actions.sharePost,
      isSharingPost: actions.isSharingPost,
      targetSubPostId: subPostThread.targetSubPostStatus?.kind === "missing"
        ? 0
        : shell.route?.targetSubPostId,
      requireAuthNotice: subPostThread.requireAuthNotice,
      openAuthModal: auth?.openAuthModal,
    },
    composerProps: {
      showTopSubPostComposer: subPostThread.showTopSubPostComposer,
      activeSubPostTarget: subPostThread.activeSubPostTarget,
      subPostInput: subPostThread.subPostInput,
      setSubPostInput: subPostThread.setSubPostInput,
      subPostMediaAssets: subPostThread.subPostMediaAssets,
      uploadingSubPostMedia: subPostThread.uploadingSubPostMedia,
      subPostMediaUploadStatus: subPostThread.subPostMediaUploadStatus,
      onSubPostMediaPicked: subPostThread.onSubPostMediaPicked,
      retryFailedSubPostMediaUploads: subPostThread.retryFailedSubPostMediaUploads,
      refreshSubPostMediaAssets: subPostThread.refreshSubPostMediaAssets,
      removeSubPostMediaAt: subPostThread.removeSubPostMediaAt,
      submittingSubPost: subPostThread.submittingSubPost,
      submitSubPost: subPostThread.submitSubPost,
      cancelTopSubPostComposer: subPostThread.cancelTopSubPostComposer,
      subPostComposerRef: refs.subPostComposerRef,
      subPostTextareaRef: refs.subPostTextareaRef,
    },
  };
}

export function buildSubPostPanelProps({ shell, detail, subPostThread, actions, helpers, auth }) {
  return {
    listProps: {
      loadingSubPosts: detail.loadingSubPosts,
      subPostsError: detail.subPostsError,
      loadingMoreSubPosts: detail.loadingMoreSubPosts,
      loadingMoreSubPostsError: detail.loadingMoreSubPostsError,
      subPostsHasMore: detail.subPostsHasMore,
      loadMoreSubPosts: detail.loadMoreSubPosts,
      reloadCurrentSubPosts: detail.reloadCurrentSubPosts,
      selectedPost: detail.selectedPost,
      subPosts: detail.subPosts,
      orderedSubPostFloors: detail.orderedSubPostFloors,
      subPostNodeMap: detail.subPostNodeMap,
      targetSubPostStatus: subPostThread.targetSubPostStatus,
      targetSubPostId: shell.route?.type === "post" ? shell.route.targetSubPostId : null,
    },
    managementProps: {
      allowPostManagement: shell.route?.manageSource === "profile-published",
      currentUser: shell.currentUser,
      openEditComposer: actions.openEditComposer,
      deletePost: actions.deletePost,
    },
    composerProps: {
      activeSubPostTarget: subPostThread.activeSubPostTarget,
      subPostInput: subPostThread.subPostInput,
      setSubPostInput: subPostThread.setSubPostInput,
      subPostMediaAssets: subPostThread.subPostMediaAssets,
      uploadingSubPostMedia: subPostThread.uploadingSubPostMedia,
      subPostMediaUploadStatus: subPostThread.subPostMediaUploadStatus,
      onSubPostMediaPicked: subPostThread.onSubPostMediaPicked,
      retryFailedSubPostMediaUploads: subPostThread.retryFailedSubPostMediaUploads,
      refreshSubPostMediaAssets: subPostThread.refreshSubPostMediaAssets,
      removeSubPostMediaAt: subPostThread.removeSubPostMediaAt,
      submittingSubPost: subPostThread.submittingSubPost,
      submitSubPost: subPostThread.submitSubPost,
      isLoggedIn: shell.isLoggedIn,
      startNestedSubPostComposer: subPostThread.startNestedSubPostComposer,
      cancelNestedSubPostComposer: subPostThread.cancelNestedSubPostComposer,
      requireAuthNotice: subPostThread.requireAuthNotice,
      openAuthModal: auth?.openAuthModal,
    },
    interactionProps: {
      collapsedSubPostBranches: subPostThread.collapsedSubPostBranches,
      subPostMoreMenuId: subPostThread.subPostMoreMenuId,
      toggleSubPostBranches: subPostThread.toggleSubPostBranches,
      jumpToSubPostFloor: subPostThread.jumpToSubPostFloor,
      clearTargetSubPostLocation: subPostThread.clearTargetSubPostLocation,
      toggleSubPostMoreMenu: subPostThread.toggleSubPostMoreMenu,
      handleSubPostFavoriteFromMenu: subPostThread.handleSubPostFavoriteFromMenu,
      handleSubPostShareFromMenu: subPostThread.handleSubPostShareFromMenu,
      copyTargetSubPostLink: subPostThread.copyTargetSubPostLink,
      handleSubPostReport: subPostThread.handleSubPostReport,
      toggleSubPostLike: subPostThread.toggleSubPostLike,
      deleteSubPost: subPostThread.deleteSubPost,
      currentUser: shell.currentUser,
    },
    helperProps: {
      authorInitial: helpers.authorInitial,
      formatTime: helpers.formatTime,
      subPostQuotePreview: helpers.subPostQuotePreview,
    },
  };
}
