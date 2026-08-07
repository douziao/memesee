export function buildDetailQueryLayoutInput({
  detailQueryRuntime,
  queryRuntimeRefreshInterface,
  mainPostEngagement,
}) {
  return {
    loadingPostDetail: detailQueryRuntime?.loadingPostDetail,
    refreshingCurrentPostThread:
      queryRuntimeRefreshInterface.isRefreshingCurrentPostThread,
    selectedPost: detailQueryRuntime?.selectedPost,
    refreshCurrentPostThread:
      queryRuntimeRefreshInterface.refreshCurrentPostThread,
    reloadCurrentPostThread: detailQueryRuntime?.reloadCurrentPostThread,
    selectedLikeCount: detailQueryRuntime?.selectedLikeCount,
    selectedFavoriteCount: detailQueryRuntime?.selectedFavoriteCount,
    togglePostLike: mainPostEngagement.togglePostLike,
    togglePostFavorite: mainPostEngagement.togglePostFavorite,
    handlePostReport: mainPostEngagement.handlePostReport,
    subPosts: detailQueryRuntime?.subPosts,
    loadingSubPosts: detailQueryRuntime?.loadingSubPosts,
    loadingMoreSubPosts: detailQueryRuntime?.loadingMoreSubPosts,
    subPostsHasMore: detailQueryRuntime?.subPostsHasMore,
    loadMoreSubPosts: detailQueryRuntime?.loadMoreSubPosts,
    orderedSubPostFloors: detailQueryRuntime?.orderedSubPostFloors,
    subPostNodeMap: detailQueryRuntime?.subPostNodeMap,
  };
}
