import { reloadFeedWithQueryState } from "./feedQueryStateHelpers";
import { didEnterHomeFeed } from "./feedViewHelpers";

export async function reloadCurrentFeedState({
  loadPosts,
  feedQueryState,
  overrides = {},
}) {
  await reloadFeedWithQueryState(loadPosts, feedQueryState, overrides);
  return true;
}

export async function refreshCurrentFeedState({
  backToTop,
  reloadCurrentFeed,
  overrides = {},
}) {
  if (typeof backToTop === "function") {
    backToTop();
  }

  if (typeof reloadCurrentFeed !== "function") {
    return false;
  }

  await reloadCurrentFeed(overrides);
  return true;
}

export function shouldReloadCurrentFeedOnHomeFeedEntry({
  previousRouteType,
  previousView,
  routeType,
  view,
}) {
  return didEnterHomeFeed(previousRouteType, previousView, routeType, view);
}
