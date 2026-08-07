import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMainPost as getContentMainPost,
  listSubPostPage as listContentSubPostPage,
} from "../../content/api/contentApi";
import {
  normalizePostPayload,
  normalizeSubPostPayload,
} from "../state/mainPostModel";
import { buildPostDetailViewModel } from "../state/postDetailViewModelHelpers";
import {
  applyActivePostDetailRouteStartState,
  applyInactivePostDetailRouteState,
  applyLoadedMoreSubPostsPage,
  buildPostDetailCacheKey,
  fetchNormalizeAndRememberPostDetail,
  fetchNormalizeSubPostPage,
  buildPostDetailRequestKey,
  buildPostThreadMessageHandlers,
  buildPostThreadRuntimeCallbacks,
  getOrCreatePostDetailRequest,
  isPostDetailUnavailableError,
  isActivePostRoute,
  resolvePostDetailFromCacheOrRequest,
  reloadCurrentPostDetailState,
  reloadCurrentPostThreadState,
  reloadCurrentSubPostsState,
  runPostThreadReload,
  runSubPostLoadMore,
  shouldApplySubPostPageResponse,
  updateCachedPostDetails,
} from "../state/postDetailQueryRuntimeHelpers";
import { normalizeMainPostId } from "../state/mainPostIdentityHelpers";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";

const POST_DETAIL_PREFETCH_TTL_MS = 15000;
const POST_DETAIL_PREFETCH_LIMIT = 24;
const SUB_POST_PAGE_SIZE = 30;

export function usePostDetailView({
  route,
  token,
  client,
  apiBase,
  setMessage,
  onPostDetailLoaded,
}) {
  const [postDetail, setPostDetail] = useState(null);
  const [loadingPostDetail, setLoadingPostDetail] = useState(false);
  const [subPosts, setSubPosts] = useState([]);
  const [loadingSubPosts, setLoadingSubPosts] = useState(false);
  const [subPostsError, setSubPostsError] = useState("");
  const [loadingMoreSubPosts, setLoadingMoreSubPosts] = useState(false);
  const [loadingMoreSubPostsError, setLoadingMoreSubPostsError] = useState("");
  const [subPostCursor, setSubPostCursor] = useState("");
  const [subPostsHasMore, setSubPostsHasMore] = useState(false);
  const [postDetailErrorType, setPostDetailErrorType] = useState("");
  const onPostDetailLoadedRef = useRef(onPostDetailLoaded);
  const postDetailCacheRef = useRef(new Map());
  const postDetailRequestCacheRef = useRef(new Map());
  const locallyDeletedMainPostIdsRef = useRef(new Set());
  const subPostCursorRef = useRef("");
  const subPostsHasMoreRef = useRef(false);
  const loadingMoreSubPostsRef = useRef(false);
  const routeRef = useRef(route);

  useEffect(() => {
    onPostDetailLoadedRef.current = onPostDetailLoaded;
  }, [onPostDetailLoaded]);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  const loadPostDetail = useCallback(async (mainPostId, authToken = token, options = {}) => {
    const trackView = options?.trackView !== false;
    const forceRefresh = Boolean(options?.forceRefresh);
    const normalizedMainPostId = normalizeMainPostId(mainPostId);
    const cacheKey = buildPostDetailCacheKey(mainPostId, authToken);
    const startRequest = () => {
      const requestKey = buildPostDetailRequestKey(mainPostId, authToken, trackView);
      return getOrCreatePostDetailRequest(
        postDetailRequestCacheRef.current,
        requestKey,
        () => fetchNormalizeAndRememberPostDetail({
          fetchPostDetail: () => getContentMainPost(client, {
            token: authToken,
            mainPostId,
            trackView,
          }),
          normalizePostDetail: (post) => normalizePostPayload(post, apiBase),
          accept: () => !locallyDeletedMainPostIdsRef.current.has(normalizedMainPostId),
          cache: postDetailCacheRef.current,
          cacheKey,
          cacheOptions: {
            limit: POST_DETAIL_PREFETCH_LIMIT,
          },
        }),
      );
    };
    return resolvePostDetailFromCacheOrRequest({
      cache: postDetailCacheRef.current,
      cacheKey,
      ttlMs: POST_DETAIL_PREFETCH_TTL_MS,
      trackView,
      forceRefresh,
      startRequest,
    });
  }, [apiBase, client, token]);

  const updatePostDetailCache = useCallback((mainPostId, buildNextDetail) =>
    updateCachedPostDetails(
      postDetailCacheRef.current,
      mainPostId,
      buildNextDetail,
    ), []);

  const markDeletedPost = useCallback((mainPostId) => {
    const normalizedMainPostId = normalizeMainPostId(mainPostId);
    if (!normalizedMainPostId) {
      return;
    }
    locallyDeletedMainPostIdsRef.current.add(normalizedMainPostId);
    updateCachedPostDetails(
      postDetailCacheRef.current,
      normalizedMainPostId,
      () => null,
    );
  }, []);

  const prefetchPostDetail = useCallback((mainPostId, authToken = token) => {
    const normalizedMainPostId = Number(mainPostId || 0);
    if (!Number.isFinite(normalizedMainPostId) || normalizedMainPostId <= 0) {
      return;
    }
    loadPostDetail(normalizedMainPostId, authToken, { trackView: false }).catch(() => {});
  }, [loadPostDetail, token]);

  const loadSubPosts = useCallback(async (mainPostId, authToken = token) => {
    return fetchNormalizeSubPostPage({
      fetchSubPostPage: () => listContentSubPostPage(client, {
        token: authToken,
        mainPostId,
        limit: SUB_POST_PAGE_SIZE,
      }),
      normalizeSubPost: normalizeSubPostPayload,
      subPostCursorRef,
      subPostsHasMoreRef,
      setSubPostCursor,
      setSubPostsHasMore,
    });
  }, [client, token]);

  const loadMoreSubPosts = useCallback(async (authToken = token) => {
    const requestMainPostId = route?.mainPostId;
    const requestCursor = subPostCursorRef.current;
    const shouldApplyLoadMoreResponse = () => shouldApplySubPostPageResponse({
      requestMainPostId,
      currentRoute: routeRef.current,
    });
    return runSubPostLoadMore({
      route,
      hasMore: subPostsHasMoreRef.current,
      loadingMoreSubPosts: loadingMoreSubPostsRef.current,
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
      setLoadingMoreSubPostsError,
      shouldApplyResponse: shouldApplyLoadMoreResponse,
      loadSubPostPage: () => fetchNormalizeSubPostPage({
        fetchSubPostPage: () => listContentSubPostPage(client, {
          token: authToken,
          mainPostId: requestMainPostId,
          cursor: requestCursor,
          limit: SUB_POST_PAGE_SIZE,
        }),
        normalizeSubPost: normalizeSubPostPayload,
        shouldApplyPage: shouldApplyLoadMoreResponse,
        applySubPostsPage: ({ pageState, nextSubPosts }) => applyLoadedMoreSubPostsPage({
          pageState,
          nextSubPosts,
          subPostCursorRef,
          subPostsHasMoreRef,
          setSubPostCursor,
          setSubPostsHasMore,
          setSubPosts,
        }),
      }),
      formatError: (error) => readableError(error, UI_MESSAGES.subPostsLoadFailed),
      setMessage,
    });
  }, [client, route, setMessage, token]);

  const postThreadMessageHandlers = useMemo(() => buildPostThreadMessageHandlers({
    setPostDetail,
    setPostDetailErrorType,
    setSubPosts,
    setSubPostsError,
    setMessage,
    formatPostDetailError: (error) =>
      isPostDetailUnavailableError(error)
        ? UI_MESSAGES.mainPostUnavailable
        : readableError(error, UI_MESSAGES.mainPostDetailLoadFailed),
    formatSubPostsError: (error) =>
      readableError(error, UI_MESSAGES.subPostsLoadFailed),
  }), [setMessage]);

  const reloadCurrentPostDetail = useCallback(async (authToken = token) => {
    return runPostThreadReload({
      route,
      getCurrentRoute: () => routeRef.current,
      inactiveResult: null,
      reloadPostDetail: true,
      setLoadingPostDetail,
      runReload: async ({ shouldApply }) => {
        const runtimeCallbacks = buildPostThreadRuntimeCallbacks({
          isActive: shouldApply,
          setPostDetail,
          setPostDetailErrorType,
          onPostDetailLoaded: onPostDetailLoadedRef.current,
        });
        return reloadCurrentPostDetailState({
          route,
          authToken,
          loadPostDetail: (mainPostId, nextAuthToken) =>
            loadPostDetail(mainPostId, nextAuthToken, { forceRefresh: true }),
          setPostDetail: runtimeCallbacks.setPostDetail,
          setPostDetailErrorType: runtimeCallbacks.setPostDetailErrorType,
          onPostDetailLoaded: runtimeCallbacks.onPostDetailLoaded,
        });
      },
    });
  }, [loadPostDetail, route, token]);

  const reloadCurrentSubPosts = useCallback(async (authToken = token) => {
    return runPostThreadReload({
      route,
      getCurrentRoute: () => routeRef.current,
      inactiveResult: [],
      reloadSubPosts: true,
      clearSubPostErrors: true,
      setLoadingSubPosts,
      setSubPostsError,
      setLoadingMoreSubPostsError,
      runReload: async ({ shouldApply }) => {
        const runtimeCallbacks = buildPostThreadRuntimeCallbacks({
          isActive: shouldApply,
          setSubPosts,
          setSubPostsError,
          messageHandlers: postThreadMessageHandlers,
        });
        try {
          return await reloadCurrentSubPostsState({
            route,
            authToken,
            loadSubPosts,
            setSubPosts: runtimeCallbacks.setSubPosts,
            setSubPostsError: runtimeCallbacks.setSubPostsError,
          });
        } catch (error) {
          runtimeCallbacks.onSubPostsError(error);
          return [];
        }
      },
    });
  }, [loadSubPosts, postThreadMessageHandlers, route, token]);

  const reloadCurrentPostThread = useCallback(async (authToken = token) => {
    return runPostThreadReload({
      route,
      getCurrentRoute: () => routeRef.current,
      inactiveResult: () => ({
        postDetail: null,
        subPosts: [],
      }),
      reloadPostDetail: true,
      reloadSubPosts: true,
      clearSubPostErrors: true,
      setLoadingPostDetail,
      setLoadingSubPosts,
      setSubPostsError,
      setLoadingMoreSubPostsError,
      runReload: async ({ shouldApply }) => {
        const runtimeCallbacks = buildPostThreadRuntimeCallbacks({
          isActive: shouldApply,
          setPostDetail,
          setPostDetailErrorType,
          onPostDetailLoaded: onPostDetailLoadedRef.current,
          setSubPosts,
          setSubPostsError,
          messageHandlers: postThreadMessageHandlers,
        });
        return reloadCurrentPostThreadState({
          route,
          authToken,
          loadPostDetail: (mainPostId, nextAuthToken) =>
            loadPostDetail(mainPostId, nextAuthToken, { forceRefresh: true }),
          loadSubPosts,
          ...runtimeCallbacks,
        });
      },
    });
  }, [loadPostDetail, loadSubPosts, postThreadMessageHandlers, route, setPostDetail, setSubPosts, token]);

  useEffect(() => {
    if (!isActivePostRoute(route)) {
      applyInactivePostDetailRouteState({
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
      });
      return;
    }
    let active = true;
    setSubPosts([]);
    applyActivePostDetailRouteStartState({
      setSubPostsError,
      setLoadingMoreSubPostsError,
      setLoadingPostDetail,
      setLoadingSubPosts,
      subPostCursorRef,
      subPostsHasMoreRef,
      setSubPostCursor,
      setSubPostsHasMore,
    });
    const runtimeCallbacks = buildPostThreadRuntimeCallbacks({
      isActive: () => active,
      setPostDetail,
      setPostDetailErrorType,
      onPostDetailLoaded: (nextPostDetail) => {
        onPostDetailLoadedRef.current?.(nextPostDetail);
      },
      setSubPosts,
      setSubPostsError,
      messageHandlers: postThreadMessageHandlers,
    });
    runPostThreadReload({
      route,
      getCurrentRoute: () => (active ? route : null),
      inactiveResult: {
        postDetail: null,
        subPosts: [],
      },
      reloadPostDetail: true,
      reloadSubPosts: true,
      applyStartState: false,
      setLoadingPostDetail,
      setLoadingSubPosts,
      runReload: () => reloadCurrentPostThreadState({
        route,
        loadPostDetail,
        loadSubPosts,
        ...runtimeCallbacks,
      }),
    });
    return () => {
      active = false;
    };
  }, [loadPostDetail, loadSubPosts, postThreadMessageHandlers, route, setPostDetail, setSubPosts]);

  const postDetailViewModel = useMemo(() => buildPostDetailViewModel({
    route,
    postDetail,
    subPosts,
  }), [postDetail, route, subPosts]);
  const {
    selectedPost,
    selectedLikeCount,
    selectedFavoriteCount,
    richDetailImages,
    richOriginalImages,
    richImageSources,
    subPostNodeMap,
    orderedSubPostFloors,
  } = postDetailViewModel;

  return {
    postDetail,
    setPostDetail,
    subPosts,
    setSubPosts,
    loadingPostDetail,
    loadingSubPosts,
    subPostsError,
    loadingMoreSubPosts,
    loadingMoreSubPostsError,
    postDetailErrorType,
    subPostCursor,
    subPostsHasMore,
    selectedPost,
    selectedLikeCount,
    selectedFavoriteCount,
    richDetailImages,
    richOriginalImages,
    richImageSources,
    subPostNodeMap,
    orderedSubPostFloors,
    loadPostDetail,
    prefetchPostDetail,
    updatePostDetailCache,
    markDeletedPost,
    reloadCurrentPostDetail,
    loadSubPosts,
    loadMoreSubPosts,
    reloadCurrentSubPosts,
    reloadCurrentPostThread,
  };
}
