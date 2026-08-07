import { buildFeedProps } from "./appLayoutPageBuilders";

function buildLeftRailProps({ shell, community, actions, refs }) {
  return {
    shellProps: {
      isMobileViewport: shell.isMobileViewport,
      routeType: shell.route.type,
    },
    communityNavProps: {
      shellProps: {
        communityNavRef: refs.communityNavRef,
        communityNavHeadRef: refs.communityNavHeadRef,
        isCommunityCondensed: community.isCommunityCondensed,
      },
      listProps: {
        loadingCommunities: community.loadingCommunities,
        navigationCommunities: community.navigationCommunities,
        selectedCommunitySlug: community.selectedCommunitySlug,
        communityMarks: community.communityMarks,
        communityShortDescriptions: community.communityShortDescriptions,
      },
      actionProps: {
        toggleCommunityCondensed: actions.toggleCommunityCondensed,
        selectCommunity: actions.selectCommunity,
        refreshCurrentCommunity: actions.refreshCurrentCommunity,
      },
    },
  };
}

function buildRightRailProps({ shell, profile, notifications, actions, auth }) {
  return {
    shellProps: {
      isLoggedIn: shell.isLoggedIn,
      view: shell.view,
      authModalOpen: auth.authModalOpen,
      notificationUnreadCount: notifications.notificationUnreadCount,
      currentUser: shell.currentUser,
    },
    gaugeProps: {
      progressProps: {
        dashboardPercent: profile.dashboardPercent,
        dashboardCurrentLevel: profile.dashboardCurrentLevel,
        levelProgress: profile.levelProgress,
      },
      actionProps: {
        openMineView: actions.openMineView,
        openAuthModal: auth.openAuthModal,
      },
    },
  };
}

export function buildForumGridProps(dependencies) {
  return {
    leftRailProps: buildLeftRailProps(dependencies),
    feedProps: buildFeedProps(dependencies),
    rightRailProps: buildRightRailProps(dependencies),
  };
}
