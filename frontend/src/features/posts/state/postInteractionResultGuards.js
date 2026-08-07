import { normalizeMainPostId, resolveMainPostId } from "./mainPostIdentityHelpers";

export function buildPostRouteInteractionContextKey({ routeType, mainPostId } = {}) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  if (routeType !== "post" || !normalizedMainPostId) {
    return "";
  }
  return `post:${normalizedMainPostId}`;
}

export function shouldApplyPostRouteInteractionResult({
  requestContextKey,
  currentRouteType,
  currentMainPostId,
} = {}) {
  if (!requestContextKey) {
    return false;
  }
  return requestContextKey === buildPostRouteInteractionContextKey({
    routeType: currentRouteType,
    mainPostId: currentMainPostId,
  });
}

export function shouldFinalizePostRouteInteractionRequest({
  requestContextKey,
  currentRouteType,
  currentMainPostId,
  requestId,
  currentRequestId,
} = {}) {
  return Number(requestId || 0) === Number(currentRequestId || 0)
    && shouldApplyPostRouteInteractionResult({
      requestContextKey,
      currentRouteType,
      currentMainPostId,
    });
}

export function shouldApplyMainPostDetailActionResult({
  requestContextKey,
  currentRoute,
  post,
} = {}) {
  return normalizeMainPostId(currentRoute?.mainPostId) === resolveMainPostId(post)
    && shouldApplyPostRouteInteractionResult({
      requestContextKey,
      currentRouteType: currentRoute?.type,
      currentMainPostId: currentRoute?.mainPostId,
    });
}
