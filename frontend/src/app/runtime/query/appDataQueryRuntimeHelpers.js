import {
  buildMainPostDetailQueryRuntime,
  buildMainPostFeedQueryRuntime,
} from "../../../features/posts/state/mainPostQueryRuntimeHelpers";

export function buildFeedQueryRuntime(feedView = {}) {
  return {
    ...buildMainPostFeedQueryRuntime({
      setPosts: feedView.setPosts,
      reloadCurrentFeed: feedView.reloadCurrentFeed,
    }),
    posts: feedView.posts,
    selectedCommunitySlug: feedView.selectedCommunitySlug,
    setSelectedCommunitySlug: feedView.setSelectedCommunitySlug,
    feedQueryState: feedView.feedQueryState,
    commitSearch: feedView.commitSearch,
    refreshFeed: feedView.refreshFeed,
    backToTop: feedView.backToTop,
    closeSortMenu: feedView.closeSortMenu,
    loadingPosts: feedView.loadingPosts,
    feedSortMode: feedView.feedSortMode,
  };
}

export function buildDetailQueryRuntime(postDetailView = {}) {
  return {
    selectedPost: postDetailView.selectedPost,
    selectedLikeCount: postDetailView.selectedLikeCount,
    selectedFavoriteCount: postDetailView.selectedFavoriteCount,
    subPosts: postDetailView.subPosts,
    markDeletedPost: postDetailView.markDeletedPost,
    loadingMoreSubPosts: postDetailView.loadingMoreSubPosts,
    subPostsHasMore: postDetailView.subPostsHasMore,
    loadMoreSubPosts: postDetailView.loadMoreSubPosts,
    orderedSubPostFloors: postDetailView.orderedSubPostFloors,
    subPostNodeMap: postDetailView.subPostNodeMap,
    loadingPostDetail: postDetailView.loadingPostDetail,
    loadingSubPosts: postDetailView.loadingSubPosts,
    subPostsError: postDetailView.subPostsError,
    loadingMoreSubPostsError: postDetailView.loadingMoreSubPostsError,
    reloadCurrentSubPosts: postDetailView.reloadCurrentSubPosts,
    ...buildMainPostDetailQueryRuntime({
      currentDetailPostId: postDetailView.selectedPost?.id,
      setPostDetail: postDetailView.setPostDetail,
      setSubPosts: postDetailView.setSubPosts,
      loadPostDetail: postDetailView.loadPostDetail,
      prefetchPostDetail: postDetailView.prefetchPostDetail,
      reloadCurrentPostDetail: postDetailView.reloadCurrentPostDetail,
      reloadCurrentPostThread: postDetailView.reloadCurrentPostThread,
      updatePostDetailCache: postDetailView.updatePostDetailCache,
    }),
  };
}

export function buildAppDataQueryRuntimes({
  feedView,
  postDetailView,
}) {
  return {
    feedQueryRuntime: buildFeedQueryRuntime(feedView),
    detailQueryRuntime: buildDetailQueryRuntime(postDetailView),
  };
}
