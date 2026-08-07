function normalizeCurrentDetailPostId(currentDetailPostId) {
  const normalizedCurrentDetailPostId = Number(currentDetailPostId || 0);
  return normalizedCurrentDetailPostId > 0 ? normalizedCurrentDetailPostId : null;
}

export function buildMainPostFeedQueryRuntime({
  setPosts,
  reloadCurrentFeed,
}) {
  return {
    setPosts,
    reloadCurrentFeed,
  };
}

export function buildMainPostDetailQueryRuntime({
  currentDetailPostId,
  setPostDetail,
  setSubPosts,
  loadPostDetail,
  prefetchPostDetail,
  reloadCurrentPostDetail,
  reloadCurrentPostThread,
  updatePostDetailCache,
}) {
  return {
    currentDetailPostId: normalizeCurrentDetailPostId(currentDetailPostId),
    setPostDetail,
    setSubPosts,
    loadPostDetail,
    prefetchPostDetail,
    reloadCurrentPostDetail,
    reloadCurrentPostThread,
    updatePostDetailCache,
  };
}

export function syncLoadedMainPostIntoFeedQueryRuntime({
  feedQueryRuntime,
  loadedPost,
  syncLoadedMainPostIntoFeed,
}) {
  if (
    typeof feedQueryRuntime?.setPosts !== "function" ||
    typeof syncLoadedMainPostIntoFeed !== "function"
  ) {
    return false;
  }

  feedQueryRuntime.setPosts((prev) =>
    syncLoadedMainPostIntoFeed(prev, loadedPost, feedQueryRuntime.feedQueryState),
  );
  return true;
}
