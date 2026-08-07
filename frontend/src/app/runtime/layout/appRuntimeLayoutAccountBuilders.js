export function buildProfileLayoutInput({ authSession, profileViewState }) {
  return {
    loadingProfile: profileViewState.loadingProfile,
    profile: profileViewState.profile,
    profilePosts: profileViewState.profilePosts,
    profileSubPosts: profileViewState.profileSubPosts,
    profileInteractions: profileViewState.profileInteractions,
    profileLevelExpanded: profileViewState.profileLevelExpanded,
    dashboardPercent: profileViewState.dashboardPercent,
    dashboardCurrentLevel: profileViewState.dashboardCurrentLevel,
    dashboardNextLevel: profileViewState.dashboardNextLevel,
    dashboardCriteria: profileViewState.dashboardCriteria,
    pendingDashboardCriteria: profileViewState.pendingDashboardCriteria,
    profileCommunitySummaries: profileViewState.profileCommunitySummaries,
    activeProfileCommunity: profileViewState.activeProfileCommunity,
    activeProfileLibraryPage: profileViewState.activeProfileLibraryPage,
    activeProfileNotificationPage: profileViewState.activeProfileNotificationPage,
    levelProgress: authSession.levelProgress,
    setProfileLevelExpanded: profileViewState.setProfileLevelExpanded,
  };
}

export function buildNotificationsLayoutInput({ notificationsState }) {
  return {
    notificationUnreadCount: notificationsState.notificationUnreadCount,
    notifications: notificationsState.notifications,
    loadNotifications: notificationsState.loadNotifications,
    markNotificationsRead: notificationsState.markNotificationsRead,
    markNotificationReadLocally: notificationsState.markNotificationReadLocally,
  };
}
