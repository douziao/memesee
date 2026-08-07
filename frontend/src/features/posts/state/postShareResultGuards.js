import {
  normalizeMainPostId,
  resolveMainPostId,
} from "./mainPostIdentityHelpers";

export function buildMainPostShareContextKey({ route, post } = {}) {
  const postId = resolveMainPostId(post);
  const routeType = route?.type || "";
  if (routeType === "post") {
    const routeMainPostId = normalizeMainPostId(route?.mainPostId);
    if (!routeMainPostId || !postId || routeMainPostId !== postId) {
      return "";
    }
    return [
      "post",
      routeMainPostId,
      normalizeMainPostId(route?.targetSubPostId),
    ].join(":");
  }
  if (!postId) {
    return "";
  }
  return [
    routeType || "unknown",
    postId,
    0,
  ].join(":");
}

export function shouldApplyMainPostShareResult({
  requestContextKey,
  currentRoute,
  post,
} = {}) {
  if (!requestContextKey) {
    return false;
  }
  return requestContextKey === buildMainPostShareContextKey({
    route: currentRoute,
    post,
  });
}

export function buildSubPostMenuShareContextKey({ routeType, mainPostId, subPostId } = {}) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  const normalizedSubPostId = normalizeMainPostId(subPostId);
  if (routeType !== "post" || !normalizedMainPostId || !normalizedSubPostId) {
    return "";
  }
  return [
    "sub-post-menu",
    normalizedMainPostId,
    normalizedSubPostId,
  ].join(":");
}

export function shouldApplySubPostMenuShareResult({
  requestContextKey,
  currentRouteType,
  currentMainPostId,
  subPostId,
} = {}) {
  if (!requestContextKey) {
    return false;
  }
  return requestContextKey === buildSubPostMenuShareContextKey({
    routeType: currentRouteType,
    mainPostId: currentMainPostId,
    subPostId,
  });
}

export function beginShareRequest(activeRequestKeys, requestContextKey) {
  if (!requestContextKey || !activeRequestKeys?.has || !activeRequestKeys?.add) {
    return false;
  }
  if (activeRequestKeys.has(requestContextKey)) {
    return false;
  }
  activeRequestKeys.add(requestContextKey);
  return true;
}

export function finalizeShareRequest(activeRequestKeys, requestContextKey) {
  activeRequestKeys?.delete?.(requestContextKey);
}
