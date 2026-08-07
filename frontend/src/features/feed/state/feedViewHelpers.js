import { normalizePostPayload } from "../../posts/state/mainPostModel";

export function normalizeFeedPage(payload, apiBase) {
  const posts = (Array.isArray(payload?.posts) ? payload.posts : [])
    .map((post) => normalizePostPayload(post, apiBase));
  const nextCursor = typeof payload?.nextCursor === "string" ? payload.nextCursor : "";
  const hasMore = Boolean(payload?.hasMore);

  return {
    posts,
    nextCursor,
    hasMore,
  };
}

export function shouldSkipFeedAppend({
  append,
  loadingPosts,
  loadingMorePosts,
  feedHasMore,
  feedCursor,
}) {
  if (!append) {
    return false;
  }

  return (
    loadingPosts ||
    loadingMorePosts ||
    !feedHasMore ||
    !feedCursor
  );
}

export function resolveFeedContinuation({
  append,
  previousCursor,
  nextCursor,
  hasMore,
}) {
  const resolvedNextCursor = typeof nextCursor === "string" ? nextCursor : "";
  const resolvedHasMore = Boolean(hasMore) && Boolean(resolvedNextCursor);
  const resolvedPreviousCursor = typeof previousCursor === "string" ? previousCursor : "";

  if (
    append &&
    resolvedHasMore &&
    resolvedPreviousCursor &&
    resolvedNextCursor === resolvedPreviousCursor
  ) {
    return {
      nextCursor: "",
      hasMore: false,
    };
  }

  return {
    nextCursor: resolvedNextCursor,
    hasMore: resolvedHasMore,
  };
}

export function isHomeFeedActive(routeType, view) {
  return routeType === "home" && view !== "mine";
}

export function didEnterHomeFeed(previousRouteType, previousView, routeType, view) {
  return isHomeFeedActive(routeType, view) && !isHomeFeedActive(previousRouteType, previousView);
}
