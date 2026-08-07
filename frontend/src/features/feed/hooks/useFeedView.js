import { useCallback, useEffect, useMemo, useRef } from "react";
import { normalizeFeedQueryState } from "../state/feedQueryStateHelpers";
import { isHomeFeedActive } from "../state/feedViewHelpers";
import {
  refreshCurrentFeedState,
  reloadCurrentFeedState,
  shouldReloadCurrentFeedOnHomeFeedEntry,
} from "../state/feedQueryRuntimeHelpers";
import { useFeedControls } from "./useFeedControls";
import { useFeedPagination } from "./useFeedPagination";

export function useFeedView({
  client,
  token,
  apiBase,
  routeType,
  view,
  topSortRef,
  setMessage,
  feedBatchSize,
  feedSortModes,
}) {
  const previousRouteTypeRef = useRef(routeType);
  const previousViewRef = useRef(view);
  const feedPagination = useFeedPagination({
    client,
    token,
    apiBase,
    setMessage,
    feedBatchSize,
  });
  const feedControls = useFeedControls({
    routeType,
    view,
    topSortRef,
    feedSortModes,
  });
  const {
    feedCursor,
    feedHasMore,
    feedError,
    feedLoadMoreRef,
    loadPosts,
    loadingMorePostsError,
    loadingMorePosts,
    loadingPosts,
    posts,
    resetFeedCollection,
    selectedCommunitySlug,
  } = feedPagination;
  const filteredPosts = posts;
  const feedQueryState = useMemo(
    () =>
      normalizeFeedQueryState({
        selectedCommunitySlug,
        searchQuery: feedControls.searchQuery,
        feedSortMode: feedControls.feedSortMode,
      }),
    [
      feedControls.feedSortMode,
      feedControls.searchQuery,
      selectedCommunitySlug,
    ],
  );
  const { selectedCommunitySlug: currentCommunitySlug } = feedQueryState;

  const reloadCurrentFeed = useCallback(async (overrides = {}) => {
    await reloadCurrentFeedState({
      loadPosts,
      feedQueryState,
      overrides,
    });
  }, [feedQueryState, loadPosts]);

  const refreshFeed = useCallback(async (overrides = {}) => {
    return refreshCurrentFeedState({
      backToTop: feedControls.backToTop,
      reloadCurrentFeed,
      overrides,
    });
  }, [feedControls.backToTop, reloadCurrentFeed]);

  const appendCurrentFeed = useCallback(async () => {
    if (!currentCommunitySlug) {
      return;
    }
    await loadPosts(
      currentCommunitySlug,
      feedQueryState.searchQuery,
      feedQueryState.feedSortMode,
      { append: true },
    );
  }, [currentCommunitySlug, feedQueryState.feedSortMode, feedQueryState.searchQuery, loadPosts]);

  useEffect(() => {
    if (!currentCommunitySlug) {
      resetFeedCollection();
      return;
    }
    reloadCurrentFeed();
  }, [
    currentCommunitySlug,
    reloadCurrentFeed,
    resetFeedCollection,
    token,
  ]);

  useEffect(() => {
    const previousRouteType = previousRouteTypeRef.current;
    const previousView = previousViewRef.current;
    previousRouteTypeRef.current = routeType;
    previousViewRef.current = view;

    if (!shouldReloadCurrentFeedOnHomeFeedEntry({
      previousRouteType,
      previousView,
      routeType,
      view,
    })) {
      return;
    }
    if (!currentCommunitySlug) {
      return;
    }
    reloadCurrentFeed();
  }, [
    currentCommunitySlug,
    reloadCurrentFeed,
    routeType,
    view,
  ]);

  useEffect(() => {
    if (!isHomeFeedActive(routeType, view) || !feedHasMore) {
      return;
    }
    const target = feedLoadMoreRef.current;
    if (!target) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          !entry?.isIntersecting ||
          loadingPosts ||
          loadingMorePosts ||
          loadingMorePostsError
        ) {
          return;
        }
        appendCurrentFeed();
      },
      { root: null, rootMargin: "420px 0px", threshold: 0.01 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [
    appendCurrentFeed,
    feedCursor,
    feedHasMore,
    feedError,
    feedLoadMoreRef,
    loadingMorePostsError,
    loadingMorePosts,
    loadingPosts,
    routeType,
    view,
  ]);

  return {
    ...feedPagination,
    ...feedControls,
    feedQueryState,
    reloadCurrentFeed,
    refreshFeed,
    appendCurrentFeed,
    filteredPosts,
  };
}
