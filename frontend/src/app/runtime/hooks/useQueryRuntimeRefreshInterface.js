import { useCallback } from "react";
import { executeQueryRuntimePolicyAction } from "../query/queryRuntimeActionHelpers";
import { buildQueryRuntimeRefreshInterface } from "../query/queryRuntimeRefreshInterfaceHelpers";

export function useQueryRuntimeRefreshInterface({
  queryRuntimeActionRuntime,
}) {
  const executePolicyAction = useCallback(async (policyName, event) => {
    return executeQueryRuntimePolicyAction({
      event,
      policyName,
      runtimeState: queryRuntimeActionRuntime,
    });
  }, [queryRuntimeActionRuntime]);

  const refreshHomeFeed = useCallback(async (event) => {
    return executePolicyAction("refresh_home_feed", event);
  }, [executePolicyAction]);

  const refreshCurrentCommunity = useCallback(async (event) => {
    return executePolicyAction("refresh_current_community", event);
  }, [executePolicyAction]);

  const refreshCurrentPostThread = useCallback(async (event) => {
    return executePolicyAction("refresh_current_post_thread", event);
  }, [executePolicyAction]);

  return buildQueryRuntimeRefreshInterface({
    queryRuntimeActionRuntime,
    refreshHomeFeed,
    refreshCurrentCommunity,
    refreshCurrentPostThread,
  });
}
