export function normalizeFeedQueryState(feedQueryState = {}) {
  return {
    selectedCommunitySlug: String(feedQueryState.selectedCommunitySlug || "lobby"),
    searchQuery: String(feedQueryState.searchQuery || "").trim(),
    feedSortMode: String(feedQueryState.feedSortMode || "latest_message"),
  };
}

export function reloadFeedWithQueryState(loadPosts, feedQueryState, overrides = {}) {
  if (typeof loadPosts !== "function") {
    return Promise.resolve();
  }

  const current = normalizeFeedQueryState(feedQueryState);
  const next = normalizeFeedQueryState({ ...current, ...overrides });
  return loadPosts(next.selectedCommunitySlug, next.searchQuery, next.feedSortMode, { reset: true });
}

export function shouldReloadFeedAfterMainPostUpsert(feedQueryState, postCommunitySlug) {
  const current = normalizeFeedQueryState(feedQueryState);
  return (
    Boolean(current.searchQuery) ||
    (current.selectedCommunitySlug !== "lobby" &&
      current.selectedCommunitySlug !== String(postCommunitySlug || ""))
  );
}

export function canHydrateMainPostIntoCurrentFeed(feedQueryState, postCommunitySlug) {
  return !shouldReloadFeedAfterMainPostUpsert(feedQueryState, postCommunitySlug);
}
