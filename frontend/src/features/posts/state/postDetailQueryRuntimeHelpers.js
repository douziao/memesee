import { getHttpErrorStatus } from "../../../shared/api/httpError";
import { normalizeMainPostId } from "./mainPostIdentityHelpers";

export const POST_DETAIL_ERROR_TYPES = {
  loadFailed: "load_failed",
  notFound: "not_found",
};

function callPostDetailRuntimeHandler(handler, ...args) {
  if (typeof handler === "function") {
    handler(...args);
  }
}

export function buildPostDetailCacheKey(mainPostId, authToken) {
  return `${authToken || "anonymous"}:${Number(mainPostId || 0)}`;
}

export function buildPostDetailRequestKey(mainPostId, authToken, trackView) {
  return `${buildPostDetailCacheKey(mainPostId, authToken)}:${trackView ? "view" : "prefetch"}`;
}

export function getOrCreatePostDetailRequest(requestCache, requestKey, createRequest) {
  const cachedRequest = requestCache?.get?.(requestKey);
  if (cachedRequest) {
    return cachedRequest;
  }
  const request = Promise.resolve()
    .then(() => {
      if (typeof createRequest !== "function") {
        return null;
      }
      return createRequest();
    })
    .finally(() => {
      requestCache?.delete?.(requestKey);
    });
  requestCache?.set?.(requestKey, request);
  return request;
}

export function resolvePostDetailFromCacheOrRequest({
  cache,
  cacheKey,
  ttlMs,
  trackView = true,
  forceRefresh = false,
  startRequest,
} = {}) {
  if (forceRefresh && typeof startRequest === "function") {
    return startRequest();
  }
  const cachedPostDetail = getFreshCachedPostDetail(cache, cacheKey, {
    ttlMs,
  });
  if (cachedPostDetail) {
    if (trackView && typeof startRequest === "function") {
      const backgroundRequest = startRequest();
      if (backgroundRequest && typeof backgroundRequest.catch === "function") {
        backgroundRequest.catch(() => {});
      }
    }
    return cachedPostDetail;
  }
  if (typeof startRequest !== "function") {
    return null;
  }
  return startRequest();
}

export async function fetchNormalizeAndRememberPostDetail({
  fetchPostDetail,
  normalizePostDetail,
  accept,
  cache,
  cacheKey,
  cacheOptions,
} = {}) {
  if (typeof fetchPostDetail !== "function") {
    return null;
  }
  const postDetail = await fetchPostDetail();
  const normalizedPostDetail = typeof normalizePostDetail === "function"
    ? normalizePostDetail(postDetail)
    : postDetail;
  if (
    typeof accept === "function" &&
    !accept(normalizedPostDetail)
  ) {
    throw { response: { status: 410 } };
  }
  rememberPostDetail(cache, cacheKey, normalizedPostDetail, cacheOptions);
  return normalizedPostDetail;
}

export async function fetchNormalizeSubPostPage({
  fetchSubPostPage,
  normalizeSubPost,
  shouldApplyPage,
  applySubPostsPage,
  subPostCursorRef,
  subPostsHasMoreRef,
  setSubPostCursor,
  setSubPostsHasMore,
} = {}) {
  if (typeof fetchSubPostPage !== "function") {
    return [];
  }
  const page = await fetchSubPostPage();
  const canApplyPage = typeof shouldApplyPage === "function" ? shouldApplyPage(page) : true;
  if (!canApplyPage) {
    return [];
  }
  applySubPostPaginationState({
    pageState: page,
    subPostCursorRef,
    subPostsHasMoreRef,
    setSubPostCursor,
    setSubPostsHasMore,
  });
  const subPosts = Array.isArray(page?.subPosts) ? page.subPosts : [];
  const nextSubPosts = subPosts.map((subPost) => (
    typeof normalizeSubPost === "function" ? normalizeSubPost(subPost) : subPost
  ));
  if (typeof applySubPostsPage === "function") {
    return applySubPostsPage({
      pageState: page,
      nextSubPosts,
    });
  }
  return nextSubPosts;
}

export function getFreshCachedPostDetail(cache, key, {
  nowMs = Date.now(),
  ttlMs = 0,
} = {}) {
  const entry = cache?.get?.(key);
  if (!entry) {
    return null;
  }
  if (Number(ttlMs || 0) > 0 && Number(nowMs || 0) - Number(entry.cachedAt || 0) > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value || null;
}

export function rememberPostDetail(cache, key, value, {
  nowMs = Date.now(),
  limit = 24,
} = {}) {
  if (!cache?.set || !key) {
    return;
  }
  cache.delete?.(key);
  cache.set(key, {
    value,
    cachedAt: nowMs,
  });
  const safeLimit = Math.max(1, Number(limit || 1));
  while (cache.size > safeLimit) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

export function updateCachedPostDetails(cache, mainPostId, buildNextValue, nowMs = Date.now()) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  if (
    !normalizedMainPostId ||
    !cache?.forEach ||
    !cache?.set ||
    typeof buildNextValue !== "function"
  ) {
    return 0;
  }
  let updatedCount = 0;
  cache.forEach((entry, key) => {
    if (!String(key || "").endsWith(`:${normalizedMainPostId}`)) {
      return;
    }
    const nextValue = buildNextValue(entry?.value || null);
    if (nextValue) {
      cache.set(key, {
        value: nextValue,
        cachedAt: nowMs,
      });
    } else {
      cache.delete?.(key);
    }
    updatedCount += 1;
  });
  return updatedCount;
}

function resolveSubPostPageItemId(item) {
  return normalizeMainPostId(item?.id)
    || normalizeMainPostId(item?.subPostId)
    || normalizeMainPostId(item?.targetSubPostId);
}

export function mergeSubPostPages(previous, nextPage) {
  const mergedById = new Map();
  (Array.isArray(previous) ? previous : []).forEach((item) => {
    const id = resolveSubPostPageItemId(item);
    if (id) {
      mergedById.set(id, item);
    }
  });
  (Array.isArray(nextPage) ? nextPage : []).forEach((item) => {
    const id = resolveSubPostPageItemId(item);
    if (id) {
      mergedById.set(id, item);
    }
  });
  return Array.from(mergedById.values());
}

export function normalizeSubPostPageRuntimeState(page) {
  return {
    nextCursor: typeof page?.nextCursor === "string" ? page.nextCursor : "",
    hasMore: Boolean(page?.hasMore),
  };
}

export function applySubPostPaginationState({
  pageState,
  subPostCursorRef,
  subPostsHasMoreRef,
  setSubPostCursor,
  setSubPostsHasMore,
} = {}) {
  const normalized = normalizeSubPostPageRuntimeState(pageState);
  if (subPostCursorRef && typeof subPostCursorRef === "object") {
    subPostCursorRef.current = normalized.nextCursor;
  }
  if (subPostsHasMoreRef && typeof subPostsHasMoreRef === "object") {
    subPostsHasMoreRef.current = normalized.hasMore;
  }
  if (typeof setSubPostCursor === "function") {
    setSubPostCursor(normalized.nextCursor);
  }
  if (typeof setSubPostsHasMore === "function") {
    setSubPostsHasMore(normalized.hasMore);
  }
  return normalized;
}

export function shouldLoadMoreSubPosts({
  route,
  hasMore,
  loadingMoreSubPosts,
} = {}) {
  return Boolean(isActivePostRoute(route) && hasMore && !loadingMoreSubPosts);
}

export function beginSubPostLoadMoreState({
  loadingMoreSubPostsRef,
  setLoadingMoreSubPosts,
  setLoadingMoreSubPostsError,
} = {}) {
  if (loadingMoreSubPostsRef && typeof loadingMoreSubPostsRef === "object") {
    loadingMoreSubPostsRef.current = true;
  }
  callPostDetailRuntimeHandler(setLoadingMoreSubPosts, true);
  callPostDetailRuntimeHandler(setLoadingMoreSubPostsError, "");
}

export function applyLoadedMoreSubPostsPage({
  pageState,
  nextSubPosts,
  subPostCursorRef,
  subPostsHasMoreRef,
  setSubPostCursor,
  setSubPostsHasMore,
  setSubPosts,
} = {}) {
  applySubPostPaginationState({
    pageState,
    subPostCursorRef,
    subPostsHasMoreRef,
    setSubPostCursor,
    setSubPostsHasMore,
  });
  if (typeof setSubPosts === "function") {
    setSubPosts((prev) => mergeSubPostPages(prev, nextSubPosts));
  }
  return Array.isArray(nextSubPosts) ? nextSubPosts : [];
}

export function applySubPostLoadMoreError({
  message,
  setLoadingMoreSubPostsError,
  setMessage,
} = {}) {
  const normalizedMessage = String(message || "").trim();
  callPostDetailRuntimeHandler(setLoadingMoreSubPostsError, normalizedMessage);
  callPostDetailRuntimeHandler(setMessage, normalizedMessage);
  return normalizedMessage;
}

export function finalizeSubPostLoadMoreState({
  shouldApply,
  loadingMoreSubPostsRef,
  setLoadingMoreSubPosts,
} = {}) {
  if (!shouldApply) {
    return false;
  }
  if (loadingMoreSubPostsRef && typeof loadingMoreSubPostsRef === "object") {
    loadingMoreSubPostsRef.current = false;
  }
  callPostDetailRuntimeHandler(setLoadingMoreSubPosts, false);
  return true;
}

export async function runSubPostLoadMore({
  route,
  hasMore,
  loadingMoreSubPosts,
  loadingMoreSubPostsRef,
  setLoadingMoreSubPosts,
  setLoadingMoreSubPostsError,
  loadSubPostPage,
  shouldApplyResponse,
  formatError,
  setMessage,
} = {}) {
  if (!shouldLoadMoreSubPosts({
    route,
    hasMore,
    loadingMoreSubPosts,
  })) {
    return [];
  }
  beginSubPostLoadMoreState({
    loadingMoreSubPostsRef,
    setLoadingMoreSubPosts,
    setLoadingMoreSubPostsError,
  });
  const shouldApply = typeof shouldApplyResponse === "function"
    ? shouldApplyResponse
    : () => true;
  try {
    if (typeof loadSubPostPage !== "function") {
      return [];
    }
    return await loadSubPostPage();
  } catch (error) {
    if (!shouldApply()) {
      return [];
    }
    const message = typeof formatError === "function" ? formatError(error) : error;
    applySubPostLoadMoreError({
      message,
      setLoadingMoreSubPostsError,
      setMessage,
    });
    return [];
  } finally {
    finalizeSubPostLoadMoreState({
      shouldApply: shouldApply(),
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
    });
  }
}

export function applyInactivePostDetailRouteState({
  setPostDetail,
  setSubPosts,
  setLoadingPostDetail,
  setLoadingSubPosts,
  setLoadingMoreSubPosts,
  setPostDetailErrorType,
  setSubPostsError,
  setLoadingMoreSubPostsError,
  loadingMoreSubPostsRef,
  subPostCursorRef,
  subPostsHasMoreRef,
  setSubPostCursor,
  setSubPostsHasMore,
} = {}) {
  callPostDetailRuntimeHandler(setPostDetail, null);
  callPostDetailRuntimeHandler(setSubPosts, []);
  callPostDetailRuntimeHandler(setLoadingPostDetail, false);
  callPostDetailRuntimeHandler(setLoadingSubPosts, false);
  callPostDetailRuntimeHandler(setLoadingMoreSubPosts, false);
  callPostDetailRuntimeHandler(setPostDetailErrorType, "");
  callPostDetailRuntimeHandler(setSubPostsError, "");
  callPostDetailRuntimeHandler(setLoadingMoreSubPostsError, "");
  applySubPostPaginationState({
    pageState: null,
    subPostCursorRef,
    subPostsHasMoreRef,
    setSubPostCursor,
    setSubPostsHasMore,
  });
  if (loadingMoreSubPostsRef && typeof loadingMoreSubPostsRef === "object") {
    loadingMoreSubPostsRef.current = false;
  }
}

export function applyActivePostDetailRouteStartState({
  setSubPostsError,
  setLoadingMoreSubPostsError,
  setLoadingPostDetail,
  setLoadingSubPosts,
  subPostCursorRef,
  subPostsHasMoreRef,
  setSubPostCursor,
  setSubPostsHasMore,
} = {}) {
  applySubPostPaginationState({
    pageState: null,
    subPostCursorRef,
    subPostsHasMoreRef,
    setSubPostCursor,
    setSubPostsHasMore,
  });
  callPostDetailRuntimeHandler(setSubPostsError, "");
  callPostDetailRuntimeHandler(setLoadingMoreSubPostsError, "");
  callPostDetailRuntimeHandler(setLoadingPostDetail, true);
  callPostDetailRuntimeHandler(setLoadingSubPosts, true);
}

export function applyPostThreadReloadStartState({
  reloadPostDetail = false,
  reloadSubPosts = false,
  clearSubPostErrors = false,
  setLoadingPostDetail,
  setLoadingSubPosts,
  setSubPostsError,
  setLoadingMoreSubPostsError,
} = {}) {
  if (reloadPostDetail) {
    callPostDetailRuntimeHandler(setLoadingPostDetail, true);
  }
  if (reloadSubPosts) {
    callPostDetailRuntimeHandler(setLoadingSubPosts, true);
  }
  if (clearSubPostErrors) {
    callPostDetailRuntimeHandler(setSubPostsError, "");
    callPostDetailRuntimeHandler(setLoadingMoreSubPostsError, "");
  }
}

export function finalizePostThreadReloadState({
  shouldApply,
  reloadPostDetail = false,
  reloadSubPosts = false,
  setLoadingPostDetail,
  setLoadingSubPosts,
} = {}) {
  if (!shouldApply) {
    return false;
  }
  if (reloadPostDetail) {
    callPostDetailRuntimeHandler(setLoadingPostDetail, false);
  }
  if (reloadSubPosts) {
    callPostDetailRuntimeHandler(setLoadingSubPosts, false);
  }
  return true;
}

export async function runPostThreadReload({
  route,
  getCurrentRoute,
  inactiveResult = null,
  reloadPostDetail = false,
  reloadSubPosts = false,
  clearSubPostErrors = false,
  applyStartState = true,
  setLoadingPostDetail,
  setLoadingSubPosts,
  setSubPostsError,
  setLoadingMoreSubPostsError,
  runReload,
} = {}) {
  if (!isActivePostRoute(route)) {
    return typeof inactiveResult === "function" ? inactiveResult() : inactiveResult;
  }
  const requestMainPostId = route.mainPostId;
  const shouldApply = () => shouldApplyPostRouteResponse({
    requestMainPostId,
    currentRoute: typeof getCurrentRoute === "function" ? getCurrentRoute() : route,
  });
  if (applyStartState) {
    applyPostThreadReloadStartState({
      reloadPostDetail,
      reloadSubPosts,
      clearSubPostErrors,
      setLoadingPostDetail,
      setLoadingSubPosts,
      setSubPostsError,
      setLoadingMoreSubPostsError,
    });
  }
  try {
    if (typeof runReload !== "function") {
      return typeof inactiveResult === "function" ? inactiveResult() : inactiveResult;
    }
    return await runReload({
      shouldApply,
      requestMainPostId,
    });
  } finally {
    finalizePostThreadReloadState({
      shouldApply: shouldApply(),
      reloadPostDetail,
      reloadSubPosts,
      setLoadingPostDetail,
      setLoadingSubPosts,
    });
  }
}

export function isActivePostRoute(route) {
  const mainPostId = Number(route?.mainPostId || 0);
  return route?.type === "post" && Number.isFinite(mainPostId) && mainPostId > 0;
}

export function shouldApplyPostRouteResponse({ requestMainPostId, currentRoute } = {}) {
  if (!isActivePostRoute(currentRoute)) {
    return false;
  }
  const requestedPostId = Number(requestMainPostId || 0);
  const currentPostId = Number(currentRoute?.mainPostId || 0);
  return Number.isInteger(requestedPostId) &&
    requestedPostId > 0 &&
    requestedPostId === currentPostId;
}

export function shouldApplySubPostPageResponse(options = {}) {
  return shouldApplyPostRouteResponse(options);
}

export function classifyPostDetailError(error) {
  const status = getHttpErrorStatus(error);
  if (status === 404 || status === 410) {
    return POST_DETAIL_ERROR_TYPES.notFound;
  }
  return POST_DETAIL_ERROR_TYPES.loadFailed;
}

export function isPostDetailUnavailableError(error) {
  return classifyPostDetailError(error) === POST_DETAIL_ERROR_TYPES.notFound;
}

export function applyLoadedPostDetail(
  setPostDetail,
  onPostDetailLoaded,
  postDetail,
  setPostDetailErrorType,
) {
  if (typeof setPostDetail === "function") {
    setPostDetail(postDetail);
  }
  if (typeof setPostDetailErrorType === "function") {
    setPostDetailErrorType("");
  }
  if (typeof onPostDetailLoaded === "function") {
    onPostDetailLoaded(postDetail);
  }
  return postDetail;
}

export function applyLoadedSubPosts(setSubPosts, subPosts, setSubPostsError) {
  if (typeof setSubPosts === "function") {
    setSubPosts(Array.isArray(subPosts) ? subPosts : []);
  }
  if (typeof setSubPostsError === "function") {
    setSubPostsError("");
  }
  return Array.isArray(subPosts) ? subPosts : [];
}

export function buildGuardedPostThreadRuntimeCallbacks({
  isActive,
  setPostDetail,
  setPostDetailErrorType,
  onPostDetailLoaded,
  setSubPosts,
  setSubPostsError,
  onPostDetailError,
  onSubPostsError,
}) {
  const shouldApply = typeof isActive === "function" ? isActive : () => true;

  return {
    setPostDetail: (nextPostDetail) => {
      if (shouldApply() && typeof setPostDetail === "function") {
        setPostDetail(nextPostDetail);
      }
    },
    setPostDetailErrorType: (nextErrorType) => {
      if (shouldApply() && typeof setPostDetailErrorType === "function") {
        setPostDetailErrorType(nextErrorType);
      }
    },
    onPostDetailLoaded: (nextPostDetail) => {
      if (shouldApply() && typeof onPostDetailLoaded === "function") {
        onPostDetailLoaded(nextPostDetail);
      }
    },
    setSubPosts: (nextSubPosts) => {
      if (shouldApply() && typeof setSubPosts === "function") {
        setSubPosts(nextSubPosts);
      }
    },
    setSubPostsError: (nextError) => {
      if (shouldApply() && typeof setSubPostsError === "function") {
        setSubPostsError(nextError);
      }
    },
    onPostDetailError: (error) => {
      if (shouldApply() && typeof onPostDetailError === "function") {
        onPostDetailError(error);
      }
    },
    onSubPostsError: (error) => {
      if (shouldApply() && typeof onSubPostsError === "function") {
        onSubPostsError(error);
      }
    },
  };
}

export function buildPostThreadRuntimeCallbacks({
  isActive,
  setPostDetail,
  setPostDetailErrorType,
  onPostDetailLoaded,
  setSubPosts,
  setSubPostsError,
  messageHandlers,
} = {}) {
  return buildGuardedPostThreadRuntimeCallbacks({
    isActive,
    setPostDetail,
    setPostDetailErrorType,
    onPostDetailLoaded,
    setSubPosts,
    setSubPostsError,
    ...(messageHandlers || {}),
  });
}

export function buildPostThreadMessageHandlers({
  setPostDetail,
  setSubPosts,
  setSubPostsError,
  setMessage,
  setPostDetailErrorType,
  formatPostDetailError,
  formatSubPostsError,
}) {
  return {
    onPostDetailError: (error) => {
      if (typeof setPostDetail === "function") {
        setPostDetail(null);
      }
      if (typeof setPostDetailErrorType === "function") {
        setPostDetailErrorType(classifyPostDetailError(error));
      }
      if (typeof setMessage === "function") {
        setMessage(
          typeof formatPostDetailError === "function"
            ? formatPostDetailError(error)
            : error,
        );
      }
    },
    onSubPostsError: (error) => {
      if (typeof setSubPosts === "function") {
        setSubPosts([]);
      }
      const message = typeof formatSubPostsError === "function"
        ? formatSubPostsError(error)
        : error;
      if (typeof setSubPostsError === "function") {
        setSubPostsError(message);
      }
      if (typeof setMessage === "function") {
        setMessage(message);
      }
    },
  };
}

export async function reloadCurrentPostDetailState({
  route,
  authToken,
  loadPostDetail,
  setPostDetail,
  onPostDetailLoaded,
  setPostDetailErrorType,
}) {
  if (!isActivePostRoute(route) || typeof loadPostDetail !== "function") {
    return null;
  }

  const nextPostDetail = await loadPostDetail(route.mainPostId, authToken);
  return applyLoadedPostDetail(
    setPostDetail,
    onPostDetailLoaded,
    nextPostDetail,
    setPostDetailErrorType,
  );
}

export async function reloadCurrentSubPostsState({
  route,
  authToken,
  loadSubPosts,
  setSubPosts,
  setSubPostsError,
}) {
  if (!isActivePostRoute(route) || typeof loadSubPosts !== "function") {
    return [];
  }

  const nextSubPosts = await loadSubPosts(route.mainPostId, authToken);
  return applyLoadedSubPosts(setSubPosts, nextSubPosts, setSubPostsError);
}

export async function reloadCurrentPostThreadState({
  route,
  authToken,
  loadPostDetail,
  setPostDetail,
  onPostDetailLoaded,
  setPostDetailErrorType,
  loadSubPosts,
  setSubPosts,
  setSubPostsError,
  onPostDetailError,
  onSubPostsError,
}) {
  if (!isActivePostRoute(route)) {
    return {
      postDetail: null,
      subPosts: [],
    };
  }

  let nextPostDetail = null;
  let nextSubPosts = [];

  const postDetailRequest = (typeof loadPostDetail === "function"
    ? loadPostDetail(route.mainPostId, authToken)
    : Promise.resolve(null))
    .then((postDetail) => {
      nextPostDetail = applyLoadedPostDetail(
        setPostDetail,
        onPostDetailLoaded,
        postDetail,
        setPostDetailErrorType,
      );
      return nextPostDetail;
    })
    .catch((error) => {
      if (typeof onPostDetailError === "function") {
        onPostDetailError(error);
      }
      return null;
    });

  const subPostsRequest = (typeof loadSubPosts === "function"
    ? loadSubPosts(route.mainPostId, authToken)
    : Promise.resolve([]))
    .then((subPosts) => {
      nextSubPosts = applyLoadedSubPosts(setSubPosts, subPosts, setSubPostsError);
      return nextSubPosts;
    })
    .catch((error) => {
      if (typeof onSubPostsError === "function") {
        onSubPostsError(error);
      }
      return [];
    });

  await Promise.allSettled([postDetailRequest, subPostsRequest]);

  if (!nextPostDetail) {
    callPostDetailRuntimeHandler(setSubPosts, []);
    nextSubPosts = [];
  }

  return {
    postDetail: nextPostDetail,
    subPosts: nextSubPosts,
  };
}
