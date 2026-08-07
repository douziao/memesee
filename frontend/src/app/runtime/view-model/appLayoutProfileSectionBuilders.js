import { navigateToPost } from "../../../shared/state/appHelpers";

function createPostNavigator(setRoute) {
  return (mainPostId, options = {}) => navigateToPost(mainPostId, setRoute, options);
}

function buildProfileIdentityProps({ profile, helpers }) {
  return {
    profile: profile.profile,
    formatDateTime: helpers.formatDateTime,
  };
}

function buildProfileStatsProps({ profile, actions }) {
  return {
    profilePostsCount: profile.profilePosts.length,
    profileSubPostsCount: profile.profileSubPosts.length,
    profilePosts: profile.profilePosts,
    profileSubPosts: profile.profileSubPosts,
    openProfileLibraryPage: actions.openProfileLibraryPage,
  };
}

function buildProfileLevelProps({ profile }) {
  return {
    levelProgress: profile.levelProgress,
    dashboardPercent: profile.dashboardPercent,
    dashboardCurrentLevel: profile.dashboardCurrentLevel,
    dashboardNextLevel: profile.dashboardNextLevel,
    dashboardCriteria: profile.dashboardCriteria,
    pendingDashboardCriteria: profile.pendingDashboardCriteria,
    profileLevelExpanded: profile.profileLevelExpanded,
    setProfileLevelExpanded: profile.setProfileLevelExpanded,
  };
}

function buildProfileNotificationProps({ shell, notifications, actions, refs, helpers }) {
  const navigateToMainPost = createPostNavigator(shell.setRoute);

  return {
    isLoggedIn: shell.isLoggedIn,
    notifications: notifications.notifications,
    notificationUnreadCount: notifications.notificationUnreadCount,
    openProfileNotificationPage: actions.openProfileNotificationPage,
    navigateToPost: navigateToMainPost,
    formatTime: helpers.formatTime,
  };
}

function buildProfileInteractionProps({ shell, profile, helpers }) {
  const navigateToMainPost = createPostNavigator(shell.setRoute);

  return {
    postInteractions: Array.isArray(profile.profileInteractions?.postInteractions)
      ? profile.profileInteractions.postInteractions
      : [],
    subPostInteractions: Array.isArray(profile.profileInteractions?.subPostInteractions)
      ? profile.profileInteractions.subPostInteractions
      : [],
    navigateToPost: navigateToMainPost,
    formatTime: helpers.formatTime,
  };
}

export function buildProfileStatusProps({ shell, profile }) {
  return {
    loadingProfile: profile.loadingProfile,
    isLoggedIn: shell.isLoggedIn,
    profile: profile.profile,
    profileError: profile.profileError,
    retryProfile: profile.retryProfile,
  };
}

export function buildProfileOverviewProps(dependencies) {
  const { actions } = dependencies;

  return {
    identityProps: buildProfileIdentityProps(dependencies),
    statsProps: buildProfileStatsProps(dependencies),
    levelProps: buildProfileLevelProps(dependencies),
    notificationProps: buildProfileNotificationProps(dependencies),
    interactionProps: buildProfileInteractionProps(dependencies),
    actionProps: {
      logout: actions.logout,
    },
  };
}

export function buildProfileCommunityPostsProps({ profile, actions, helpers }) {
  return {
    activeProfileCommunity: profile.activeProfileCommunity,
    backToProfileOverview: actions.backToProfileOverview,
    logout: actions.logout,
    openPostDetail: actions.openPostDetail,
    sharePost: actions.sharePost,
    isSharingPost: actions.isSharingPost,
    formatTime: helpers.formatTime,
  };
}

export function buildProfileLibraryPageProps({ profile, actions, helpers, shell }) {
  const navigateToMainPost = createPostNavigator(shell.setRoute);

  return {
    activeProfileLibraryPage: profile.activeProfileLibraryPage,
    profilePosts: profile.profilePosts,
    profileSubPosts: profile.profileSubPosts,
    postInteractions: Array.isArray(profile.profileInteractions?.postInteractions)
      ? profile.profileInteractions.postInteractions
      : [],
    subPostInteractions: Array.isArray(profile.profileInteractions?.subPostInteractions)
      ? profile.profileInteractions.subPostInteractions
      : [],
    backToProfileOverview: actions.backToProfileOverview,
    logout: actions.logout,
    openPostDetail: actions.openPostDetail,
    sharePost: actions.sharePost,
    isSharingPost: actions.isSharingPost,
    navigateToPost: navigateToMainPost,
    formatTime: helpers.formatTime,
    clampText: helpers.clampText,
    formatHeatScore: helpers.formatHeatScore,
  };
}

export function buildProfileNotificationPageProps({ profile, actions, notifications, helpers, shell }) {
  const navigateToMainPost = createPostNavigator(shell.setRoute);

  return {
    activeProfileNotificationPage: profile.activeProfileNotificationPage,
    notifications: notifications.notifications,
    notificationUnreadCount: notifications.notificationUnreadCount,
    loadNotifications: notifications.loadNotifications,
    markNotificationsRead: notifications.markNotificationsRead,
    markNotificationReadLocally: notifications.markNotificationReadLocally,
    backToProfileOverview: actions.backToProfileOverview,
    logout: actions.logout,
    navigateToPost: navigateToMainPost,
    formatTime: helpers.formatTime,
  };
}
