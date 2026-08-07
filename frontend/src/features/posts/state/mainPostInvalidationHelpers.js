export function buildNoopFeedRefreshIntent() {
  return {
    type: "none",
    overrides: {},
  };
}

export function buildReloadCurrentFeedIntent(overrides = {}) {
  return {
    type: "reload_current_feed",
    overrides: { ...overrides },
  };
}

export function buildFeedRefreshExecutionContext({
  feedRefreshIntent,
  reloadCurrentFeed,
} = {}) {
  return {
    intent: feedRefreshIntent,
    reloadCurrentFeed,
  };
}

export function shouldExecuteFeedRefreshIntent(intent) {
  return intent?.type === "reload_current_feed";
}

export async function executeFeedRefreshIntent(
  reloadCurrentFeedOrExecutionContext,
  intent,
) {
  const executionContext =
    arguments.length === 1 && reloadCurrentFeedOrExecutionContext
      ? reloadCurrentFeedOrExecutionContext
      : buildFeedRefreshExecutionContext({
          feedRefreshIntent: intent,
          reloadCurrentFeed: reloadCurrentFeedOrExecutionContext,
        });

  if (
    typeof executionContext.reloadCurrentFeed !== "function"
    || !shouldExecuteFeedRefreshIntent(executionContext.intent)
  ) {
    return false;
  }

  await executionContext.reloadCurrentFeed(executionContext.intent?.overrides || {});
  return true;
}
