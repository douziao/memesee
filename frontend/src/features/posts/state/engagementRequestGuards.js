import { normalizeMainPostId } from "./mainPostIdentityHelpers";

export function buildEngagementRequestKey({ targetId, action } = {}) {
  const normalizedTargetId = normalizeMainPostId(targetId);
  const normalizedAction = String(action || "").trim().toLowerCase();
  if (!normalizedTargetId || !normalizedAction) {
    return "";
  }
  return `${normalizedAction}:${normalizedTargetId}`;
}

export function shouldApplyLatestEngagementRequestResult({
  requestKey,
  requestId,
  latestRequestIds,
} = {}) {
  if (!requestKey || !requestId || !latestRequestIds) {
    return false;
  }
  const latestRequestId = typeof latestRequestIds.get === "function"
    ? latestRequestIds.get(requestKey)
    : latestRequestIds[requestKey];
  return Number(latestRequestId || 0) === Number(requestId || 0);
}
