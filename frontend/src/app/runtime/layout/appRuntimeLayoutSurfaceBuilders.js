import {
  buildCommunityQueryLayoutInput,
  buildFeedQueryLayoutInput,
} from "./appRuntimeLayoutQueryInputHelpers";

export function buildShellLayoutInput({
  view,
  appChrome,
  authSession,
  shellNavigationState,
}) {
  return {
    route: appChrome.route,
    setRoute: appChrome.setRoute,
    view,
    isLoggedIn: authSession.isLoggedIn,
    currentUser: authSession.currentUser,
    userLevel: authSession.userLevel,
    isMobileViewport: shellNavigationState.isMobileViewport,
    message: appChrome.message,
    clearMessage: () => appChrome.setMessage(""),
    imageViewer: appChrome.imageViewer,
    closeImageViewer: appChrome.closeImageViewer,
  };
}

export function buildCommunityLayoutInput({
  runtimeConfig,
  queryRuntimes,
  communityCatalogState,
  shellNavigationState,
}) {
  return buildCommunityQueryLayoutInput({
    runtimeConfig,
    feedQueryRuntime: queryRuntimes.feedQueryRuntime,
    communityCatalogState,
    shellNavigationState,
  });
}

export function buildFeedLayoutInput({
  runtimeConfig,
  feedView,
  queryRuntimes,
  queryRuntimeRefreshInterface,
}) {
  return buildFeedQueryLayoutInput({
    runtimeConfig,
    feedView,
    feedQueryRuntime: queryRuntimes.feedQueryRuntime,
    queryRuntimeRefreshInterface,
  });
}
