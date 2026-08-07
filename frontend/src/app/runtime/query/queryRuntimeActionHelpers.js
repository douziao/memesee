import {
  getQueryRuntimeActionPolicy,
  isQueryRuntimeActionBlocked,
} from "./queryRuntimeActionPolicyHelpers";

export async function executeQueryRuntimeAction({
  event,
  beforeAction,
  action,
}) {
  event?.stopPropagation?.();

  if (typeof beforeAction === "function") {
    beforeAction();
  }

  if (typeof action !== "function") {
    return false;
  }

  await action();
  return true;
}

export async function executeQueryRuntimePolicyAction({
  event,
  policyName,
  runtimeState = {},
}) {
  const policy = getQueryRuntimeActionPolicy(policyName);
  if (!policy || isQueryRuntimeActionBlocked(policyName, runtimeState)) {
    return false;
  }

  return executeQueryRuntimeAction({
    event,
    beforeAction: policy.shouldBackToTop ? runtimeState.backToTop : null,
    action: runtimeState[policy.actionKey],
  });
}
