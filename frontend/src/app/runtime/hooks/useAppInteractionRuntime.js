import { useComposerDraft } from "../../../features/composer/hooks/useComposerDraft";
import { useEffect } from "react";
import { useMainPostActions } from "../../../features/posts/hooks/useMainPostActions";
import { useMainPostEngagement } from "../../../features/posts/hooks/useMainPostEngagement";
import { buildInteractionQueryRuntimeDependencies } from "../query/appInteractionQueryRuntimeHelpers";
import { useQueryRuntimeRefreshInterface } from "./useQueryRuntimeRefreshInterface";
import { useSessionCleanup } from "./useSessionCleanup";
import { useShellNavigation } from "./useShellNavigation";
import { useSubPostThread } from "../../../features/posts/hooks/useSubPostThread";
import { buildPostLifecycleEventHandlers } from "../state/postLifecycleEvents";

export function useAppInteractionRuntime({
  client,
  apiBase,
  view,
  setView,
  refs,
  appChrome,
  authSession,
  dataRuntime,
  setMessage,
}) {
  const {
    queryRuntimes,
    communitiesCatalogState,
    profileViewState,
    notificationsState,
  } =
    dataRuntime;
  const {
    feedQueryRuntime,
    detailQueryRuntime,
    mainPostMutationInterface,
    queryRuntimeActionRuntime,
  } = buildInteractionQueryRuntimeDependencies(queryRuntimes);
  const postLifecycleEvents = buildPostLifecycleEventHandlers({
    profileViewState,
    notificationsState,
  });

  const mainPostEngagement = useMainPostEngagement({
    route: appChrome.route,
    isLoggedIn: authSession.isLoggedIn,
    token: authSession.token,
    client,
    setMessage,
    onAuthRequired: authSession.openAuthModal,
    syncUserProgressFromPayload: authSession.syncUserProgressFromPayload,
    onMainPostInteractionSynced: postLifecycleEvents.handleMainPostInteractionSynced,
    feedQueryRuntime,
    detailQueryRuntime,
    mainPostMutationInterface,
  });

  const queryRuntimeRefreshInterface = useQueryRuntimeRefreshInterface({
    queryRuntimeActionRuntime,
  });

  const composerDraft = useComposerDraft({
    route: appChrome.route,
    routeType: appChrome.route.type,
    isLoggedIn: authSession.isLoggedIn,
    currentUser: authSession.currentUser,
    token: authSession.token,
    client,
    apiBase,
    communities: communitiesCatalogState.communities,
    orderedCommunities: communitiesCatalogState.orderedCommunities,
    feedQueryRuntime,
    setMessage,
    setView,
    setRoute: appChrome.setRoute,
    onAuthRequired: authSession.openAuthModal,
    onMainPostSaved: postLifecycleEvents.handleMainPostSaved,
    mainPostMutationInterface,
  });

  useEffect(() => {
    if (typeof appChrome.registerRouteLeaveGuard !== "function") {
      return undefined;
    }
    return appChrome.registerRouteLeaveGuard(({ currentRoute }) => {
      if (currentRoute?.type !== "compose") {
        return true;
      }
      return composerDraft.confirmComposerNavigationLeave();
    });
  }, [appChrome, composerDraft.confirmComposerNavigationLeave]);

  const shellNavigationState = useShellNavigation({
    route: appChrome.route,
    view,
    setView,
    isLoggedIn: authSession.isLoggedIn,
    setMessage,
    setRoute: appChrome.setRoute,
    feedQueryRuntime,
    activeProfileCommunitySlug: profileViewState.activeProfileCommunitySlug,
    setActiveProfileCommunitySlug: profileViewState.setActiveProfileCommunitySlug,
    activeProfileLibraryPage: profileViewState.activeProfileLibraryPage,
    setActiveProfileLibraryPage: profileViewState.setActiveProfileLibraryPage,
    activeProfileNotificationPage: profileViewState.activeProfileNotificationPage,
    setActiveProfileNotificationPage: profileViewState.setActiveProfileNotificationPage,
    setProfileLevelExpanded: profileViewState.setProfileLevelExpanded,
    refreshCurrentCommunity: queryRuntimeRefreshInterface.refreshCurrentCommunity,
    reportUserActivity: mainPostEngagement.reportUserActivity,
    onAuthRequired: authSession.openAuthModal,
    confirmComposerNavigationLeave: composerDraft.confirmComposerNavigationLeave,
  });

  const subPostThreadState = useSubPostThread({
    routeType: appChrome.route.type,
    mainPostId: appChrome.route.type === "post" ? appChrome.route.mainPostId : null,
    routeManageSource: appChrome.route.type === "post" ? appChrome.route.manageSource : "",
    targetSubPostId: appChrome.route.type === "post" ? appChrome.route.targetSubPostId : null,
    isLoggedIn: authSession.isLoggedIn,
    detailQueryRuntime,
    token: authSession.token,
    client,
    setMessage,
    setRoute: appChrome.setRoute,
    onAuthRequired: authSession.openAuthModal,
    reportUserActivity: mainPostEngagement.reportUserActivity,
    currentUser: authSession.currentUser,
    topbarRef: refs.topbarRef,
    subPostTextareaRef: refs.subPostTextareaRef,
    onSubPostDeleted: postLifecycleEvents.handleSubPostDeleted,
    onSubPostInteractionSynced: postLifecycleEvents.handleSubPostInteractionSynced,
    mainPostMutationInterface,
  });

  const mainPostActions = useMainPostActions({
    client,
    token: authSession.token,
    isLoggedIn: authSession.isLoggedIn,
    currentUser: authSession.currentUser,
    route: appChrome.route,
    detailQueryRuntime,
    feedQueryRuntime,
    editingMainPostId: composerDraft.editingMainPostId,
    setMessage,
    onAuthRequired: authSession.openAuthModal,
    resetComposerForm: composerDraft.resetComposerForm,
    onMainPostDeleted: postLifecycleEvents.handleMainPostDeleted,
    setView,
    setRoute: appChrome.setRoute,
    confirmComposerNavigationLeave: composerDraft.confirmComposerNavigationLeave,
    mainPostMutationInterface,
  });

  const sessionCleanupState = useSessionCleanup({
    resetShellNavigation: shellNavigationState.resetShellNavigation,
    resetNotifications: notificationsState.resetNotifications,
    clearProfileState: profileViewState.clearProfileState,
    resetComposerForm: composerDraft.resetComposerForm,
    clearLocalAuth: authSession.clearLocalAuth,
    setView,
    setRoute: appChrome.setRoute,
    setMessage,
  });

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
