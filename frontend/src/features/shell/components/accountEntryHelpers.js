export function shouldOpenNotificationsFromAccountEntry({
  isLoggedIn,
  notificationUnreadCount,
}) {
  const unreadCount = Number(notificationUnreadCount || 0);
  return Boolean(isLoggedIn && Number.isFinite(unreadCount) && unreadCount > 0);
}

export function buildAccountEntryOpenOptions(input) {
  return shouldOpenNotificationsFromAccountEntry(input)
    ? { openNotifications: true }
    : {};
}
