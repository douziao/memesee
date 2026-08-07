import {
  executeMainPostMutationEffects,
} from "./mainPostMutationExecutionHelpers";
import { buildMainPostFeedSyncExecutionContext } from "./mainPostFeedSyncExecutionHelpers";
import {
  buildMainPostMutationFollowUpPlan,
  executeMainPostMutationFollowUp,
  resolveMainPostMutationInvalidationPlan,
} from "./mainPostMutationStrategyHelpers";
import { buildMainPostInvalidationExecutionRuntime } from "./mainPostInvalidationExecutionHelpers";
import {
  buildMainPostDetailQueryRuntime,
  buildMainPostFeedQueryRuntime,
} from "./mainPostQueryRuntimeHelpers";

export function resolveMainPostMutationShouldSyncFeed(mutationPlan) {
  const invalidationPlan = resolveMainPostMutationInvalidationPlan(mutationPlan);

  return Boolean(invalidationPlan?.syncFeed || invalidationPlan?.hydrateFeed);
}

export function buildMainPostMutationRuntime({
  currentDetailPostId,
  setPosts,
  setPostDetail,
  setSubPosts,
  loadPostDetail,
  reloadCurrentPostDetail,
  reloadCurrentPostThread,
  updatePostDetailCache,
  reloadCurrentFeed,
}) {
  return {
    feedQueryRuntime: buildMainPostFeedQueryRuntime({
      setPosts,
      reloadCurrentFeed,
    }),
    detailQueryRuntime: buildMainPostDetailQueryRuntime({
      currentDetailPostId,
      setPostDetail,
      setSubPosts,
      loadPostDetail,
      reloadCurrentPostDetail,
      reloadCurrentPostThread,
      updatePostDetailCache,
    }),
  };
}

export function buildMainPostMutationRuntimeFromQueryRuntimes({
  feedQueryRuntime,
  detailQueryRuntime,
}) {
  return {
    feedQueryRuntime,
    detailQueryRuntime,
  };
}

export function buildMainPostMutationExecutionContext({
  mutationPlan,
  mutationRuntime,
  buildNextPosts,
  buildNextDetail,
}) {
  return buildMainPostMutationCompatibilityContext({
    mutationPlan,
    mutationRuntime,
    buildNextPosts,
    buildNextDetail,
  });
}

export function buildMainPostMutationCompatibilityContext({
  mutationPlan,
  mutationRuntime,
  buildNextPosts,
  buildNextDetail,
}) {
  const effectsRuntime = buildMainPostMutationEffectsRuntime({
    mutationPlan,
    mutationRuntime,
    buildNextPosts,
    buildNextDetail,
  });

  return buildMainPostMutationCompatibilityContextFromEffectsRuntime(
    effectsRuntime,
  );
}

export function buildMainPostMutationEffectsRuntime({
  mutationPlan,
  mutationRuntime,
  buildNextPosts,
  buildNextDetail,
}) {
  const invalidationPlan = resolveMainPostMutationInvalidationPlan(mutationPlan);

  return {
    feedSyncRuntime: buildMainPostFeedSyncExecutionContext({
      shouldSyncFeed: resolveMainPostMutationShouldSyncFeed(mutationPlan),
      setPosts: mutationRuntime?.feedQueryRuntime?.setPosts,
      buildNextPosts,
    }),
    invalidationRuntime: buildMainPostInvalidationExecutionRuntime({
      invalidationPlan,
      feedQueryRuntime: mutationRuntime?.feedQueryRuntime,
      detailQueryRuntime: mutationRuntime?.detailQueryRuntime,
      buildNextDetail,
    }),
  };
}

export function buildMainPostMutationExecutionContextFromEffectsRuntime(
  effectsRuntime = {},
) {
  return buildMainPostMutationCompatibilityContextFromEffectsRuntime(
    effectsRuntime,
  );
}

export function buildMainPostMutationCompatibilityContextFromEffectsRuntime(
  effectsRuntime = {},
) {
  return {
    ...effectsRuntime,
    ...effectsRuntime.invalidationRuntime,
  };
}

export function buildMainPostMutationExecutionEnvelope({
  mutationEffectsRuntime,
  followUpPlan,
  followUpHandlers,
  includeCompatibilityContext = false,
} = {}) {
  const executionEnvelope = {
    mutationEffectsRuntime,
    followUpPlan,
    followUpHandlers,
  };

  if (includeCompatibilityContext) {
    executionEnvelope.mutationEffectsContext =
      buildMainPostMutationCompatibilityContextFromEffectsRuntime(
        mutationEffectsRuntime,
      );
  }

  return executionEnvelope;
}

export function buildMainPostMutationWorkflowEffectsRuntime({
  mutationWorkflow,
  mutationRuntime,
}) {
  return buildMainPostMutationEffectsRuntime({
    mutationPlan: mutationWorkflow?.mutationPlan,
    mutationRuntime,
    buildNextPosts: mutationWorkflow?.buildNextPosts,
    buildNextDetail: mutationWorkflow?.buildNextDetail,
  });
}

export function buildMainPostMutationStrategyEffectsRuntime({
  mutationStrategy,
  mutationRuntime,
}) {
  return buildMainPostMutationEffectsRuntime({
    mutationPlan: mutationStrategy?.mutationPlan,
    mutationRuntime,
    buildNextPosts: mutationStrategy?.effectBuilders?.buildNextPosts,
    buildNextDetail: mutationStrategy?.effectBuilders?.buildNextDetail,
  });
}

export function buildMainPostMutationWorkflowExecutionContext({
  mutationWorkflow,
  mutationRuntime,
  followUpHandlers,
  includeCompatibilityContext = false,
}) {
  const mutationEffectsRuntime = buildMainPostMutationWorkflowEffectsRuntime({
    mutationWorkflow,
    mutationRuntime,
  });

  return buildMainPostMutationExecutionEnvelope({
    mutationEffectsRuntime,
    followUpPlan: mutationWorkflow?.followUpPlan,
    followUpHandlers,
    includeCompatibilityContext,
  });
}

export function buildMainPostMutationStrategyExecutionContext({
  mutationStrategy,
  mutationRuntime,
  followUpHandlers,
  includeCompatibilityContext = false,
}) {
  const mutationEffectsRuntime = buildMainPostMutationStrategyEffectsRuntime({
    mutationStrategy,
    mutationRuntime,
  });

  return buildMainPostMutationExecutionEnvelope({
    mutationEffectsRuntime,
    followUpPlan: buildMainPostMutationFollowUpPlan(mutationStrategy?.mutationPlan),
    followUpHandlers,
    includeCompatibilityContext,
  });
}

export async function executeMainPostMutationExecutionEnvelope(
  executionEnvelope = {},
) {
  return executeMainPostMutationEffects(
    executionEnvelope?.mutationEffectsRuntime,
  );
}

export async function executeMainPostMutationExecutionEnvelopeWithFollowUp(
  executionEnvelope = {},
) {
  const mutationEffectsResult = await executeMainPostMutationExecutionEnvelope(
    executionEnvelope,
  );
  const followUpResult = executeMainPostMutationFollowUp(
    executionEnvelope?.followUpPlan,
    executionEnvelope?.followUpHandlers,
  );

  return {
    mutationEffectsResult,
    followUpResult,
  };
}

export async function executePlannedMainPostMutationEffects({
  mutationPlan,
  mutationRuntime,
  buildNextPosts,
  buildNextDetail,
}) {
  return executeMainPostMutationEffects(
    buildMainPostMutationEffectsRuntime({
      mutationPlan,
      mutationRuntime,
      buildNextPosts,
      buildNextDetail,
    }),
  );
}

export async function executeMainPostMutationWorkflow(
  mutationWorkflow,
  mutationRuntime,
) {
  const workflowExecutionContext = buildMainPostMutationWorkflowExecutionContext({
    mutationWorkflow,
    mutationRuntime,
  });

  return executeMainPostMutationExecutionEnvelope(
    workflowExecutionContext,
  );
}

export async function executeMainPostMutationWorkflowWithFollowUp(
  mutationWorkflow,
  mutationRuntime,
  followUpHandlers,
) {
  const workflowExecutionContext = buildMainPostMutationWorkflowExecutionContext({
    mutationWorkflow,
    mutationRuntime,
    followUpHandlers,
  });
  return executeMainPostMutationExecutionEnvelopeWithFollowUp(
    workflowExecutionContext,
  );
}

export async function executeMainPostMutationStrategy(
  mutationStrategy,
  mutationRuntime,
) {
  const strategyExecutionContext = buildMainPostMutationStrategyExecutionContext({
    mutationStrategy,
    mutationRuntime,
  });

  return executeMainPostMutationExecutionEnvelope(
    strategyExecutionContext,
  );
}

export async function executeMainPostMutationStrategyWithFollowUp(
  mutationStrategy,
  mutationRuntime,
  followUpHandlers,
) {
  const strategyExecutionContext = buildMainPostMutationStrategyExecutionContext({
    mutationStrategy,
    mutationRuntime,
    followUpHandlers,
  });
  return executeMainPostMutationExecutionEnvelopeWithFollowUp(
    strategyExecutionContext,
  );
}

export function buildMainPostMutationRuntimeExecutor(
  mutationRuntime,
  executeMutation,
) {
  return async function executeBoundMainPostMutation(payload) {
    return executeMutation(payload, mutationRuntime);
  };
}

export function buildMainPostMutationRuntimeWithFollowUpExecutor(
  mutationRuntime,
  executeMutationWithFollowUp,
) {
  return async function executeBoundMainPostMutationWithFollowUp(
    payload,
    followUpHandlers,
  ) {
    return executeMutationWithFollowUp(
      payload,
      mutationRuntime,
      followUpHandlers,
    );
  };
}

export function buildMainPostMutationWorkflowExecutor(mutationRuntime) {
  return buildMainPostMutationRuntimeExecutor(
    mutationRuntime,
    executeMainPostMutationWorkflow,
  );
}

export function buildMainPostMutationWorkflowWithFollowUpExecutor(mutationRuntime) {
  return buildMainPostMutationRuntimeWithFollowUpExecutor(
    mutationRuntime,
    executeMainPostMutationWorkflowWithFollowUp,
  );
}

export function buildMainPostMutationStrategyExecutor(mutationRuntime) {
  return buildMainPostMutationRuntimeExecutor(
    mutationRuntime,
    executeMainPostMutationStrategy,
  );
}

export function buildMainPostMutationStrategyWithFollowUpExecutor(mutationRuntime) {
  return buildMainPostMutationRuntimeWithFollowUpExecutor(
    mutationRuntime,
    executeMainPostMutationStrategyWithFollowUp,
  );
}
