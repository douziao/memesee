import { buildAppLayoutProps } from "./view-model/appLayoutProps";
import { buildAppRuntimeLayoutInput } from "./appRuntimeLayoutInput";

export function buildAppRuntimeDataLayoutDependencies({
  feedView,
  queryRuntimes,
  communitiesCatalogState,
  profileViewState,
  notificationsState,
  postDetailView,
}) {
  return {
    feedView,
    queryRuntimes,
    communityCatalogState: communitiesCatalogState,
    profileViewState,
    notificationsState,
    postDetailView,
  };
}

export function buildAppRuntimeInteractionLayoutDependencies({
  mainPostEngagement,
  shellNavigationState,
  subPostThreadState,
  composerDraft,
  mainPostActions,
  queryRuntimeRefreshInterface,
  sessionCleanupState,
}) {
  return {
    mainPostEngagement,
    shellNavigationState,
    subPostThreadState,
    composerDraft,
    mainPostActions,
    queryRuntimeRefreshInterface,
    sessionCleanupState,
  };
}

export function buildAppRuntimeUtilityLayoutDependencies({
  view,
  appChrome,
  authSession,
  refs,
  helpers,
  runtimeConfig,
}) {
  return {
    view,
    appChrome,
    authSession,
    refs,
    helpers,
    runtimeConfig,
  };
}

export function buildAppRuntimeLayoutDependencies({
  view,
  appChrome,
  authSession,
  dataRuntime,
  interactionRuntime,
  refs,
  helpers,
  runtimeConfig,
}) {
  return {
    ...buildAppRuntimeUtilityLayoutDependencies({
      view,
      appChrome,
      authSession,
      refs,
      helpers,
      runtimeConfig,
    }),
    ...buildAppRuntimeDataLayoutDependencies(dataRuntime),
    ...buildAppRuntimeInteractionLayoutDependencies(interactionRuntime),
  };
}

export function buildAppRuntimeViewModel(dependencies) {
  return buildAppLayoutProps(
    buildAppRuntimeLayoutInput(buildAppRuntimeLayoutDependencies(dependencies)),
  );
}
