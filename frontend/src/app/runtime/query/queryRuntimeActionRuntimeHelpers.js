export function buildQueryRuntimeActionRuntime({
  feedQueryRuntime,
  detailQueryRuntime,
}) {
  return {
    backToTop: feedQueryRuntime?.backToTop,
    refreshFeed: feedQueryRuntime?.refreshFeed,
    reloadCurrentPostThread: detailQueryRuntime?.reloadCurrentPostThread,
    isRefreshingHomeFeed: Boolean(feedQueryRuntime?.loadingPosts),
    isRefreshingCurrentPostThread: Boolean(
      detailQueryRuntime?.loadingPostDetail || detailQueryRuntime?.loadingSubPosts,
    ),
  };
}
