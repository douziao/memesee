export function buildQueryRuntimeRefreshInterface({
  queryRuntimeActionRuntime = {},
  refreshHomeFeed,
  refreshCurrentCommunity,
  refreshCurrentPostThread,
} = {}) {
  return {
    isRefreshingHomeFeed: Boolean(
      queryRuntimeActionRuntime?.isRefreshingHomeFeed,
    ),
    isRefreshingCurrentPostThread: Boolean(
      queryRuntimeActionRuntime?.isRefreshingCurrentPostThread,
    ),
    refreshHomeFeed,
    refreshCurrentCommunity,
    refreshCurrentPostThread,
  };
}
