import { buildMainPostDetailIntentExecutionContext } from "./mainPostDetailIntentHelpers";
import {
  buildMainPostFeedSyncExecutionContext,
  executeMainPostFeedSyncExecutionContext,
} from "./mainPostFeedSyncExecutionHelpers";
import { buildFeedRefreshExecutionContext } from "./mainPostInvalidationHelpers";
import {
  buildMainPostInvalidationExecutionRuntime,
  normalizeMainPostInvalidationCompatibilityRuntime,
  executeMainPostInvalidationCompatibilityContext,
} from "./mainPostInvalidationExecutionHelpers";

export function buildMainPostFeedSyncRuntime({
  shouldSyncFeed,
  setPosts,
  buildNextPosts,
} = {}) {
  return buildMainPostFeedSyncExecutionContext({
    shouldSyncFeed,
    setPosts,
    buildNextPosts,
  });
}

export function buildMainPostDetailExecutionRuntime({
  detailIntent,
  currentDetailPostId,
  setPostDetail,
  setSubPosts,
  buildNextDetail,
  loadPostDetail,
  reloadCurrentPostDetail,
  reloadCurrentPostThread,
  updatePostDetailCache,
} = {}) {
  return buildMainPostCompatibilityDetailExecutionRuntime({
    detailIntent,
    currentDetailPostId,
    setPostDetail,
    setSubPosts,
    buildNextDetail,
    loadPostDetail,
    reloadCurrentPostDetail,
    reloadCurrentPostThread,
    updatePostDetailCache,
  });
}

export function buildMainPostCompatibilityDetailExecutionRuntime({
  detailIntent,
  currentDetailPostId,
  setPostDetail,
  setSubPosts,
  buildNextDetail,
  loadPostDetail,
  reloadCurrentPostDetail,
  reloadCurrentPostThread,
  updatePostDetailCache,
} = {}) {
  return buildMainPostDetailIntentExecutionContext({
    detailIntent,
    currentDetailPostId,
    setPostDetail,
    setSubPosts,
    buildNextDetail,
    loadPostDetail,
    reloadCurrentPostDetail,
    reloadCurrentPostThread,
    updatePostDetailCache,
  });
}

export function buildMainPostFeedRefreshRuntime({
  feedRefreshIntent,
  reloadCurrentFeed,
} = {}) {
  return buildMainPostCompatibilityFeedRefreshRuntime({
    feedRefreshIntent,
    reloadCurrentFeed,
  });
}

export function buildMainPostCompatibilityFeedRefreshRuntime({
  feedRefreshIntent,
  reloadCurrentFeed,
} = {}) {
  return buildFeedRefreshExecutionContext({
    feedRefreshIntent,
    reloadCurrentFeed,
  });
}

export function buildMainPostInvalidationRuntime({
  invalidationPlan,
  feedQueryRuntime,
  detailQueryRuntime,
  buildNextDetail,
} = {}) {
  return buildMainPostInvalidationExecutionRuntime({
    invalidationPlan,
    feedQueryRuntime,
    detailQueryRuntime,
    buildNextDetail,
  });
}

export function executeMainPostFeedSync(feedSyncRuntime = {}) {
  return executeMainPostFeedSyncExecutionContext(feedSyncRuntime);
}

export async function executeMainPostInvalidation(invalidationRuntime = {}) {
  return executeMainPostInvalidationCompatibilityContext(invalidationRuntime);
}

export async function executeMainPostDetailExecution(detailExecutionRuntime = {}) {
  return executeMainPostCompatibilityDetailExecution(detailExecutionRuntime);
}

export async function executeMainPostCompatibilityDetailExecution(
  detailExecutionRuntime = {},
) {
  const { didExecuteDetailIntent } = await executeMainPostInvalidation(
    normalizeMainPostInvalidationCompatibilityRuntime({
      detailExecutionRuntime,
    }),
  );
  return didExecuteDetailIntent;
}

export async function executeMainPostFeedRefresh(feedRefreshRuntime = {}) {
  return executeMainPostCompatibilityFeedRefresh(feedRefreshRuntime);
}

export async function executeMainPostCompatibilityFeedRefresh(
  feedRefreshRuntime = {},
) {
  const { didExecuteFeedRefreshIntent } = await executeMainPostInvalidation(
    normalizeMainPostInvalidationCompatibilityRuntime({
      feedRefreshRuntime,
    }),
  );
  return didExecuteFeedRefreshIntent;
}

export async function executeMainPostMutationEffects({
  feedSyncRuntime,
  invalidationRuntime,
  detailExecutionRuntime,
  feedRefreshRuntime,
} = {}) {
  const didSyncFeed = executeMainPostFeedSync(feedSyncRuntime);
  const {
    didExecuteDetailIntent,
    didExecuteFeedRefreshIntent,
  } = await executeMainPostInvalidation(
    normalizeMainPostInvalidationCompatibilityRuntime({
      invalidationRuntime,
      detailExecutionRuntime,
      feedRefreshRuntime,
    }),
  );

  return {
    didSyncFeed,
    didExecuteDetailIntent,
    didExecuteFeedRefreshIntent,
  };
}
