import {
  syncCreatedSubPostIntoDetail,
  syncDeletedMainPostIntoFeed,
  syncDeletedSubPostIntoDetail,
  syncDeletedSubPostIntoFeed,
  syncMainPostEngagementIntoDetail,
  syncMainPostEngagementIntoFeed,
  syncSavedMainPostIntoDetail,
  syncSavedMainPostIntoFeed,
  shouldHydrateSavedMainPostIntoFeed,
} from "./mainPostQuerySyncHelpers";
import {
  buildClearCurrentMainPostDetailIntent,
  buildNoopMainPostDetailIntent,
  buildReloadCurrentMainPostThreadIntent,
  buildSyncCurrentMainPostDetailIntent,
} from "./mainPostDetailIntentHelpers";
import {
  buildNoopFeedRefreshIntent,
  buildReloadCurrentFeedIntent,
} from "./mainPostInvalidationHelpers";

export function buildMainPostMutationInvalidationPlan(invalidationPolicy = {}) {
  return {
    ...(invalidationPolicy || {}),
  };
}

export function buildMainPostMutationPlan({
  invalidationPolicy,
  followUpPlan,
} = {}) {
  const invalidationPlan = buildMainPostMutationInvalidationPlan(
    invalidationPolicy,
  );

  return {
    ...invalidationPlan,
    invalidationPlan,
    ...(followUpPlan || {}),
  };
}

export function resolveMainPostMutationInvalidationPlan(mutationPlan = {}) {
  return mutationPlan?.invalidationPlan || mutationPlan || {};
}

export function buildDeletedMainPostFollowUpPlan({
  route,
  selectedPostId,
  editingMainPostId,
  deletedPostId,
} = {}) {
  const normalizedDeletedPostId = Number(deletedPostId || 0);
  const isActiveDetailPost =
    route?.type === "post" &&
    Number(selectedPostId || 0) === normalizedDeletedPostId;
  const isEditingDeletedPost =
    Number(editingMainPostId || 0) === normalizedDeletedPostId;

  return {
    navigateHome: isActiveDetailPost || isEditingDeletedPost,
    resetComposer: isEditingDeletedPost,
  };
}

export function buildMainPostMutationFollowUpPlan(mutationPlan = {}) {
  return {
    navigateHome: Boolean(mutationPlan?.navigateHome),
    resetComposer: Boolean(mutationPlan?.resetComposer),
  };
}

export function executeMainPostMutationFollowUp(
  followUpPlan = {},
  {
    navigateHome,
    resetComposerForm,
  } = {},
) {
  const didNavigateHome =
    followUpPlan.navigateHome && typeof navigateHome === "function";
  const didResetComposer =
    followUpPlan.resetComposer && typeof resetComposerForm === "function";

  if (didNavigateHome) {
    navigateHome();
  }
  if (didResetComposer) {
    resetComposerForm();
  }

  return {
    didNavigateHome,
    didResetComposer,
  };
}

export function buildMainPostSaveInvalidationPolicy(feedQueryState, savedPost) {
  const hydrateFeed = shouldHydrateSavedMainPostIntoFeed(feedQueryState, savedPost);
  return {
    hydrateFeed,
    detailIntent: buildSyncCurrentMainPostDetailIntent(savedPost?.id),
    feedRefreshIntent: hydrateFeed
      ? buildNoopFeedRefreshIntent()
      : buildReloadCurrentFeedIntent(),
  };
}

export function buildMainPostDeleteInvalidationPolicy({
  deletedPostId,
}) {
  const normalizedDeletedPostId = Number(deletedPostId || 0);

  return {
    syncFeed: normalizedDeletedPostId > 0,
    detailIntent: normalizedDeletedPostId > 0
      ? buildClearCurrentMainPostDetailIntent(normalizedDeletedPostId)
      : buildNoopMainPostDetailIntent(),
    feedRefreshIntent: buildNoopFeedRefreshIntent(),
  };
}

export function buildSubPostCreateInvalidationPolicy({
  selectedPostId,
  targetMainPostId,
}) {
  const normalizedSelectedPostId = Number(selectedPostId || 0);
  const normalizedTargetMainPostId = Number(targetMainPostId || 0);
  const isCurrentDetailTarget =
    normalizedSelectedPostId > 0 &&
    normalizedSelectedPostId === normalizedTargetMainPostId;

  return {
    detailIntent: isCurrentDetailTarget
      ? buildReloadCurrentMainPostThreadIntent(normalizedTargetMainPostId)
      : buildNoopMainPostDetailIntent(),
    feedRefreshIntent: buildNoopFeedRefreshIntent(),
    syncFeed: false,
  };
}

export function buildSubPostDeleteInvalidationPolicy({
  selectedPostId,
  targetMainPostId,
}) {
  const normalizedSelectedPostId = Number(selectedPostId || 0);
  const normalizedTargetMainPostId = Number(targetMainPostId || 0);
  const isCurrentDetailTarget =
    normalizedSelectedPostId > 0 &&
    normalizedSelectedPostId === normalizedTargetMainPostId;

  return {
    detailIntent: isCurrentDetailTarget
      ? buildReloadCurrentMainPostThreadIntent(normalizedTargetMainPostId)
      : buildNoopMainPostDetailIntent(),
    feedRefreshIntent: buildNoopFeedRefreshIntent(),
    syncFeed: normalizedTargetMainPostId > 0,
  };
}

export function buildMainPostEngagementInvalidationPolicy(mainPostId) {
  const normalizedMainPostId = Number(mainPostId || 0);
  return {
    detailIntent: buildSyncCurrentMainPostDetailIntent(normalizedMainPostId),
    feedRefreshIntent: buildNoopFeedRefreshIntent(),
    syncFeed: normalizedMainPostId > 0,
  };
}

export function buildMainPostSaveMutationPlan(feedQueryState, savedPost) {
  return buildMainPostMutationPlan({
    invalidationPolicy: buildMainPostSaveInvalidationPolicy(feedQueryState, savedPost),
  });
}

export function buildMainPostDeleteMutationPlan({
  route,
  selectedPostId,
  editingMainPostId,
  deletedPostId,
}) {
  return buildMainPostMutationPlan({
    invalidationPolicy: buildMainPostDeleteInvalidationPolicy({
      route,
      selectedPostId,
      deletedPostId,
    }),
    followUpPlan: buildDeletedMainPostFollowUpPlan({
      route,
      selectedPostId,
      editingMainPostId,
      deletedPostId,
    }),
  });
}

export function buildSubPostCreateMutationPlan({
  selectedPostId,
  targetMainPostId,
}) {
  return buildMainPostMutationPlan({
    invalidationPolicy: buildSubPostCreateInvalidationPolicy({
      selectedPostId,
      targetMainPostId,
    }),
  });
}

export function buildSubPostDeleteMutationPlan({
  selectedPostId,
  targetMainPostId,
}) {
  return buildMainPostMutationPlan({
    invalidationPolicy: buildSubPostDeleteInvalidationPolicy({
      selectedPostId,
      targetMainPostId,
    }),
  });
}

export function buildMainPostEngagementMutationPlan(mainPostId) {
  return buildMainPostMutationPlan({
    invalidationPolicy: buildMainPostEngagementInvalidationPolicy(mainPostId),
  });
}

export function buildSavedMainPostMutationEffectBuilders({
  savedPost,
  feedQueryState,
}) {
  return {
    buildNextPosts: (prev) =>
      syncSavedMainPostIntoFeed(prev, savedPost, feedQueryState),
    buildNextDetail: (prev) =>
      syncSavedMainPostIntoDetail(prev, savedPost),
  };
}

export function buildMainPostEngagementMutationEffectBuilders({
  mainPostId,
  engagementState,
  feedSortMode,
}) {
  return {
    buildNextPosts: (prev) =>
      syncMainPostEngagementIntoFeed(
        prev,
        mainPostId,
        engagementState,
        { feedSortMode },
      ),
    buildNextDetail: (prev) =>
      syncMainPostEngagementIntoDetail(prev, mainPostId, engagementState),
  };
}

export function buildCreatedSubPostMutationEffectBuilders({
  mainPostId,
  latestMessageAt,
}) {
  return {
    buildNextDetail: (prev) =>
      syncCreatedSubPostIntoDetail(prev, mainPostId, latestMessageAt),
  };
}

export function buildDeletedSubPostMutationEffectBuilders({
  mainPostId,
}) {
  return {
    buildNextPosts: (prev) =>
      syncDeletedSubPostIntoFeed(prev, mainPostId),
    buildNextDetail: (prev) =>
      syncDeletedSubPostIntoDetail(prev, mainPostId),
  };
}

export function buildDeletedMainPostMutationEffectBuilders(mainPostId) {
  return {
    buildNextPosts: (prev) => syncDeletedMainPostIntoFeed(prev, mainPostId),
  };
}

export function buildMainPostMutationStrategy({
  mutationPlan,
  effectBuilders,
}) {
  return {
    mutationPlan,
    effectBuilders: effectBuilders || {},
  };
}

export function buildSavedMainPostMutationStrategy({
  feedQueryState,
  savedPost,
}) {
  return buildMainPostMutationStrategy({
    mutationPlan: buildMainPostSaveMutationPlan(feedQueryState, savedPost),
    effectBuilders: buildSavedMainPostMutationEffectBuilders({
      savedPost,
      feedQueryState,
    }),
  });
}

export function buildMainPostEngagementMutationStrategy({
  mainPostId,
  engagementState,
  feedSortMode,
}) {
  return buildMainPostMutationStrategy({
    mutationPlan: buildMainPostEngagementMutationPlan(mainPostId),
    effectBuilders: buildMainPostEngagementMutationEffectBuilders({
      mainPostId,
      engagementState,
      feedSortMode,
    }),
  });
}

export function buildCreatedSubPostMutationStrategy({
  selectedPostId,
  targetMainPostId,
  latestMessageAt,
}) {
  return buildMainPostMutationStrategy({
    mutationPlan: buildSubPostCreateMutationPlan({
      selectedPostId,
      targetMainPostId,
    }),
    effectBuilders: buildCreatedSubPostMutationEffectBuilders({
      mainPostId: targetMainPostId,
      latestMessageAt,
    }),
  });
}

export function buildDeletedSubPostMutationStrategy({
  selectedPostId,
  targetMainPostId,
}) {
  return buildMainPostMutationStrategy({
    mutationPlan: buildSubPostDeleteMutationPlan({
      selectedPostId,
      targetMainPostId,
    }),
    effectBuilders: buildDeletedSubPostMutationEffectBuilders({
      mainPostId: targetMainPostId,
    }),
  });
}

export function buildDeletedMainPostMutationStrategy({
  route,
  selectedPostId,
  editingMainPostId,
  deletedPostId,
}) {
  return buildMainPostMutationStrategy({
    mutationPlan: buildMainPostDeleteMutationPlan({
      route,
      selectedPostId,
      editingMainPostId,
      deletedPostId,
    }),
    effectBuilders: buildDeletedMainPostMutationEffectBuilders(deletedPostId),
  });
}

export function buildMainPostMutationWorkflow({
  mutationPlanOrStrategy,
  effectBuilders,
}) {
  const mutationPlan = mutationPlanOrStrategy?.mutationPlan || mutationPlanOrStrategy;
  const resolvedEffectBuilders =
    mutationPlanOrStrategy?.effectBuilders || effectBuilders || {};

  return {
    mutationPlan,
    followUpPlan: buildMainPostMutationFollowUpPlan(mutationPlan),
    ...resolvedEffectBuilders,
  };
}

export function buildSavedMainPostMutationWorkflow({
  feedQueryState,
  savedPost,
}) {
  return buildMainPostMutationWorkflow({
    mutationPlanOrStrategy: buildSavedMainPostMutationStrategy({
      savedPost,
      feedQueryState,
    }),
  });
}

export function buildMainPostEngagementMutationWorkflow({
  mainPostId,
  engagementState,
  feedSortMode,
}) {
  return buildMainPostMutationWorkflow({
    mutationPlanOrStrategy: buildMainPostEngagementMutationStrategy({
      mainPostId,
      engagementState,
      feedSortMode,
    }),
  });
}

export function buildCreatedSubPostMutationWorkflow({
  selectedPostId,
  targetMainPostId,
  latestMessageAt,
}) {
  return buildMainPostMutationWorkflow({
    mutationPlanOrStrategy: buildCreatedSubPostMutationStrategy({
      selectedPostId,
      targetMainPostId,
      latestMessageAt,
    }),
  });
}

export function buildDeletedMainPostMutationWorkflow({
  route,
  selectedPostId,
  editingMainPostId,
  deletedPostId,
}) {
  return buildMainPostMutationWorkflow({
    mutationPlanOrStrategy: buildDeletedMainPostMutationStrategy({
      route,
      selectedPostId,
      editingMainPostId,
      deletedPostId,
    }),
  });
}
