import {
  buildMainPostDetailIntentExecutionContext,
  executeMainPostDetailIntent,
} from "./mainPostDetailIntentHelpers";
import {
  buildFeedRefreshExecutionContext,
  executeFeedRefreshIntent,
} from "./mainPostInvalidationHelpers";
import { resolveMainPostMutationInvalidationPlan } from "./mainPostMutationStrategyHelpers";

export function buildMainPostInvalidationExecutionRuntime({
  invalidationPlan,
  feedQueryRuntime,
  detailQueryRuntime,
  buildNextDetail,
} = {}) {
  return {
    detailExecutionRuntime: buildMainPostDetailIntentExecutionContext({
      detailIntent: invalidationPlan?.detailIntent,
      currentDetailPostId: detailQueryRuntime?.currentDetailPostId,
      setPostDetail: detailQueryRuntime?.setPostDetail,
      setSubPosts: detailQueryRuntime?.setSubPosts,
      buildNextDetail,
      loadPostDetail: detailQueryRuntime?.loadPostDetail,
      reloadCurrentPostDetail: detailQueryRuntime?.reloadCurrentPostDetail,
      reloadCurrentPostThread: detailQueryRuntime?.reloadCurrentPostThread,
      updatePostDetailCache: detailQueryRuntime?.updatePostDetailCache,
    }),
    feedRefreshRuntime: buildFeedRefreshExecutionContext({
      feedRefreshIntent: invalidationPlan?.feedRefreshIntent,
      reloadCurrentFeed: feedQueryRuntime?.reloadCurrentFeed,
    }),
  };
}

export function buildMainPostInvalidationExecutionContext({
  mutationPlan,
  mutationRuntime,
  buildNextDetail,
} = {}) {
  return buildMainPostInvalidationCompatibilityContext({
    mutationPlan,
    mutationRuntime,
    buildNextDetail,
  });
}

export function buildMainPostInvalidationCompatibilityContext({
  mutationPlan,
  mutationRuntime,
  buildNextDetail,
} = {}) {
  const invalidationPlan = resolveMainPostMutationInvalidationPlan(mutationPlan);

  return buildMainPostInvalidationExecutionRuntime({
    invalidationPlan,
    feedQueryRuntime: mutationRuntime?.feedQueryRuntime,
    detailQueryRuntime: mutationRuntime?.detailQueryRuntime,
    buildNextDetail,
  });
}

export function normalizeMainPostInvalidationExecutionRuntime({
  invalidationRuntime,
  detailExecutionRuntime,
  feedRefreshRuntime,
} = {}) {
  return normalizeMainPostInvalidationCompatibilityRuntime({
    invalidationRuntime,
    detailExecutionRuntime,
    feedRefreshRuntime,
  });
}

export function normalizeMainPostInvalidationCompatibilityRuntime({
  invalidationRuntime,
  detailExecutionRuntime,
  feedRefreshRuntime,
} = {}) {
  if (invalidationRuntime) {
    return invalidationRuntime;
  }

  return {
    detailExecutionRuntime,
    feedRefreshRuntime,
  };
}

export async function executeMainPostInvalidationExecutionContext({
  detailExecutionRuntime,
  feedRefreshRuntime,
} = {}) {
  return executeMainPostInvalidationCompatibilityContext({
    detailExecutionRuntime,
    feedRefreshRuntime,
  });
}

export async function executeMainPostInvalidationCompatibilityContext({
  detailExecutionRuntime,
  feedRefreshRuntime,
} = {}) {
  const didExecuteDetailIntent = detailExecutionRuntime
    ? await executeMainPostDetailIntent(detailExecutionRuntime)
    : false;
  const didExecuteFeedRefreshIntent = feedRefreshRuntime
    ? await executeFeedRefreshIntent(feedRefreshRuntime)
    : false;

  return {
    didExecuteDetailIntent,
    didExecuteFeedRefreshIntent,
  };
}
