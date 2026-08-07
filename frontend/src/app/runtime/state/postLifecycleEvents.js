export function buildPostLifecycleEventHandlers({
  profileViewState: profile,
  notificationsState: notifications,
} = {}) {
  return {
    handleMainPostSnapshotSynced(postSnapshot) {
      profile?.syncProfilePostSnapshot?.(postSnapshot);
      notifications?.syncNotificationPostSnapshot?.(postSnapshot);
    },

    handleMainPostSaved(savedPost) {
      profile?.upsertProfilePost?.(savedPost);
      notifications?.syncNotificationPostSnapshot?.(savedPost);
    },

    handleMainPostDeleted(mainPostId) {
      profile?.removeProfilePost?.(mainPostId);
      notifications?.markNotificationPostUnavailable?.(mainPostId);
    },

    handleMainPostInteractionSynced(interactionChange) {
      profile?.syncProfilePostSnapshot?.(interactionChange?.post);
      profile?.syncProfilePostInteraction?.(interactionChange);
    },

    handleSubPostInteractionSynced(interactionChange) {
      profile?.syncProfileSubPostInteraction?.(interactionChange);
    },

    handleSubPostDeleted(subPostId) {
      profile?.removeProfileSubPost?.(subPostId);
      notifications?.markNotificationSubPostUnavailable?.(subPostId);
    },
  };
}
