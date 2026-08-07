import {
  navigateToHome,
} from "../../../shared/state/appHelpers";
import { useCommunityNavigationState } from "../../../features/shell/hooks/useCommunityNavigationState";
import { notifyAuthRequired } from "../../../shared/state/authInteractionHelpers";

export function shouldOpenProfileNotificationsOnMineOpen(options = {}) {
  return Boolean(options?.openNotifications);
}

export function useShellNavigation({
  route,
  view,
  setView,
  isLoggedIn,
  setMessage,
  setRoute,
  feedQueryRuntime,
  activeProfileCommunitySlug,
  setActiveProfileCommunitySlug,
  activeProfileLibraryPage,
  setActiveProfileLibraryPage,
  activeProfileNotificationPage,
  setActiveProfileNotificationPage,
  setProfileLevelExpanded,
  refreshCurrentCommunity,
  reportUserActivity,
  onAuthRequired,
  confirmComposerNavigationLeave,
}) {
  const selectedCommunitySlug = feedQueryRuntime?.selectedCommunitySlug;
  const setSelectedCommunitySlug = feedQueryRuntime?.setSelectedCommunitySlug;
  const communityNavigationState = useCommunityNavigationState();

  function hasActiveProfileChildPage() {
    return Boolean(
      activeProfileCommunitySlug ||
      activeProfileLibraryPage ||
      activeProfileNotificationPage,
    );
  }

  function clearProfileChildPage() {
    setActiveProfileCommunitySlug("");
    setActiveProfileLibraryPage("");
    setActiveProfileNotificationPage(false);
  }

  async function confirmComposeLeaveIfNeeded() {
    if (route.type !== "compose") {
      return true;
    }
    if (typeof confirmComposerNavigationLeave !== "function") {
      return true;
    }
    return confirmComposerNavigationLeave();
  }

  async function handleTopbarLeadingAction() {
    if (route.type === "home" && view === "mine") {
      if (hasActiveProfileChildPage()) {
        clearProfileChildPage();
        return;
      }
      setView("latest");
      return;
    }
    if (route.type === "post") {
      navigateToHome(setRoute);
      return;
    }
    if (route.type === "compose") {
      if (!(await confirmComposeLeaveIfNeeded())) {
        return;
      }
      navigateToHome(setRoute);
    }
  }

  async function openMineView(options = {}) {
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    if (!(await confirmComposeLeaveIfNeeded())) {
      return;
    }
    setProfileLevelExpanded(false);
    setActiveProfileCommunitySlug("");
    setActiveProfileLibraryPage("");
    setActiveProfileNotificationPage(shouldOpenProfileNotificationsOnMineOpen(options));
    setView("mine");
    navigateToHome(setRoute);
  }

  async function backToLatest() {
    if (!(await confirmComposeLeaveIfNeeded())) {
      return;
    }
    setActiveProfileCommunitySlug("");
    setActiveProfileLibraryPage("");
    setActiveProfileNotificationPage(false);
    setView("latest");
    navigateToHome(setRoute);
  }

  function openProfileCommunity(slug) {
    setActiveProfileLibraryPage("");
    setActiveProfileNotificationPage(false);
    setActiveProfileCommunitySlug(slug);
  }

  function openProfileLibraryPage(page) {
    setActiveProfileCommunitySlug("");
    setActiveProfileNotificationPage(false);
    setActiveProfileLibraryPage(page);
  }

  function openProfileNotificationPage() {
    setActiveProfileCommunitySlug("");
    setActiveProfileLibraryPage("");
    setActiveProfileNotificationPage(true);
  }

  function backToProfileOverview() {
    clearProfileChildPage();
  }

  async function selectCommunity(slug) {
    if (!(await confirmComposeLeaveIfNeeded())) {
      return;
    }
    const isSameCommunity = selectedCommunitySlug === slug;
    setActiveProfileCommunitySlug("");
    setActiveProfileLibraryPage("");
    setActiveProfileNotificationPage(false);
    setView("latest");
    setSelectedCommunitySlug(slug);
    navigateToHome(setRoute);
    if (slug) {
      reportUserActivity({ type: "COMMUNITY_ENTER", communitySlug: slug }, { silent: true });
    }
    if (isSameCommunity) {
      await refreshCurrentCommunity();
    }
  }

  return {
    isCommunityCondensed: communityNavigationState.isCommunityCondensed,
    isMobileViewport: communityNavigationState.isMobileViewport,
    handleTopbarLeadingAction,
    toggleCommunityCondensed: communityNavigationState.toggleCommunityCondensed,
    openMineView,
    backToLatest,
    openProfileCommunity,
    openProfileLibraryPage,
    openProfileNotificationPage,
    backToProfileOverview,
    selectCommunity,
    resetShellNavigation,
  };
}

function resetShellNavigation() {
}
