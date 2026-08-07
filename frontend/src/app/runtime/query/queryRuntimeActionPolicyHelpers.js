const QUERY_RUNTIME_ACTION_POLICIES = {
  refresh_home_feed: {
    actionKey: "refreshFeed",
    pendingStateKey: "isRefreshingHomeFeed",
    shouldBackToTop: true,
  },
  refresh_current_community: {
    actionKey: "refreshFeed",
    pendingStateKey: "isRefreshingHomeFeed",
    shouldBackToTop: true,
  },
  refresh_current_post_thread: {
    actionKey: "reloadCurrentPostThread",
    pendingStateKey: "isRefreshingCurrentPostThread",
    shouldBackToTop: true,
  },
};

export function getQueryRuntimeActionPolicy(policyName) {
  return QUERY_RUNTIME_ACTION_POLICIES[policyName] || null;
}

export function isQueryRuntimeActionBlocked(policyName, runtimeState = {}) {
  const policy = getQueryRuntimeActionPolicy(policyName);
  if (!policy?.pendingStateKey) {
    return false;
  }
  return Boolean(runtimeState[policy.pendingStateKey]);
}
