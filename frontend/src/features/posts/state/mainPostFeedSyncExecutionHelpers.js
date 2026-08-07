export function buildMainPostFeedSyncExecutionContext({
  shouldSyncFeed,
  setPosts,
  buildNextPosts,
} = {}) {
  return {
    shouldSyncFeed: Boolean(shouldSyncFeed),
    setPosts,
    buildNextPosts,
  };
}

export function executeMainPostFeedSyncExecutionContext(feedSyncRuntime = {}) {
  if (
    !feedSyncRuntime.shouldSyncFeed ||
    typeof feedSyncRuntime.setPosts !== "function" ||
    typeof feedSyncRuntime.buildNextPosts !== "function"
  ) {
    return false;
  }

  feedSyncRuntime.setPosts((prev) => feedSyncRuntime.buildNextPosts(prev));
  return true;
}
