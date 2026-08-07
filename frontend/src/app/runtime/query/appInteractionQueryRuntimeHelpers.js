import {
  buildMainPostMutationRuntimeFromQueryRuntimes,
  buildMainPostMutationStrategyExecutor,
  buildMainPostMutationStrategyWithFollowUpExecutor,
  buildMainPostMutationWorkflowExecutor,
  buildMainPostMutationWorkflowWithFollowUpExecutor,
} from "../../../features/posts/state/mainPostMutationRuntimeHelpers";
import { buildQueryRuntimeActionRuntime } from "./queryRuntimeActionRuntimeHelpers";

export function selectInteractionQueryRuntimes(queryRuntimes = {}) {
  return {
    feedQueryRuntime: queryRuntimes.feedQueryRuntime,
    detailQueryRuntime: queryRuntimes.detailQueryRuntime,
  };
}

export function buildMainPostMutationInterface(selectedQueryRuntimes = {}) {
  const mainPostMutationRuntime = buildMainPostMutationRuntimeFromQueryRuntimes(
    selectedQueryRuntimes,
  );

  return {
    loadMainPostDetail: selectedQueryRuntimes.detailQueryRuntime?.loadPostDetail,
    executeMainPostMutationStrategy:
      buildMainPostMutationStrategyExecutor(mainPostMutationRuntime),
    executeMainPostMutationStrategyWithFollowUp:
      buildMainPostMutationStrategyWithFollowUpExecutor(mainPostMutationRuntime),
  };
}

export function buildLegacyMainPostMutationWorkflowInterface(
  selectedQueryRuntimes = {},
) {
  const mainPostMutationRuntime = buildMainPostMutationRuntimeFromQueryRuntimes(
    selectedQueryRuntimes,
  );

  return {
    executeMainPostMutationWorkflow:
      buildMainPostMutationWorkflowExecutor(mainPostMutationRuntime),
    executeMainPostMutationWorkflowWithFollowUp:
      buildMainPostMutationWorkflowWithFollowUpExecutor(mainPostMutationRuntime),
  };
}

export function buildInteractionQueryRuntimeDependencies(queryRuntimes = {}) {
  const selectedQueryRuntimes = selectInteractionQueryRuntimes(queryRuntimes);

  return {
    ...selectedQueryRuntimes,
    mainPostMutationInterface: buildMainPostMutationInterface(selectedQueryRuntimes),
    queryRuntimeActionRuntime: buildQueryRuntimeActionRuntime(
      selectedQueryRuntimes,
    ),
  };
}
