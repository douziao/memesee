import { describe, expect, it, vi } from "vitest";
import {
  applyActivePostDetailRouteStartState,
  applyInactivePostDetailRouteState,
  applyLoadedMoreSubPostsPage,
  applyLoadedSubPosts,
  applyLoadedPostDetail,
  applyPostThreadReloadStartState,
  applySubPostLoadMoreError,
  applySubPostPaginationState,
  beginSubPostLoadMoreState,
  buildPostDetailCacheKey,
  buildPostDetailRequestKey,
  buildPostThreadMessageHandlers,
  buildPostThreadRuntimeCallbacks,
  classifyPostDetailError,
  fetchNormalizeAndRememberPostDetail,
  fetchNormalizeSubPostPage,
  getOrCreatePostDetailRequest,
  getFreshCachedPostDetail,
  isPostDetailUnavailableError,
  mergeSubPostPages,
  normalizeSubPostPageRuntimeState,
  POST_DETAIL_ERROR_TYPES,
  rememberPostDetail,
  finalizeSubPostLoadMoreState,
  finalizePostThreadReloadState,
  reloadCurrentPostThreadState,
  resolvePostDetailFromCacheOrRequest,
  runPostThreadReload,
  runSubPostLoadMore,
  shouldApplyPostRouteResponse,
  shouldLoadMoreSubPosts,
  shouldApplySubPostPageResponse,
  updateCachedPostDetails,
} from "./postDetailQueryRuntimeHelpers";

function httpError(status) {
  return {
    response: {
      status,
      data: {
        message: "error",
      },
    },
  };
}

describe("post detail query runtime helpers", () => {
  it("builds stable post detail cache and request keys", () => {
    expect(buildPostDetailCacheKey(42, "")).toBe("anonymous:42");
    expect(buildPostDetailCacheKey("42", "token")).toBe("token:42");
    expect(buildPostDetailRequestKey(42, "token", true)).toBe("token:42:view");
    expect(buildPostDetailRequestKey(42, "token", false)).toBe("token:42:prefetch");
  });

  it("reuses an existing in-flight post detail request", async () => {
    const existingRequest = Promise.resolve({ id: 42 });
    const requestCache = new Map([["token:42:view", existingRequest]]);
    const createRequest = vi.fn();

    const result = getOrCreatePostDetailRequest(
      requestCache,
      "token:42:view",
      createRequest,
    );

    expect(result).toBe(existingRequest);
    expect(createRequest).not.toHaveBeenCalled();
    await expect(result).resolves.toEqual({ id: 42 });
    expect(requestCache.has("token:42:view")).toBe(true);
  });

  it("stores a new post detail request and removes it after resolution", async () => {
    const requestCache = new Map();
    const createRequest = vi.fn().mockResolvedValue({ id: 42 });

    const request = getOrCreatePostDetailRequest(
      requestCache,
      "token:42:view",
      createRequest,
    );

    expect(requestCache.get("token:42:view")).toBe(request);
    await expect(request).resolves.toEqual({ id: 42 });
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(requestCache.has("token:42:view")).toBe(false);
  });

  it("removes failed post detail requests from the in-flight cache", async () => {
    const requestCache = new Map();
    const error = new Error("network");
    const createRequest = vi.fn().mockRejectedValue(error);

    const request = getOrCreatePostDetailRequest(
      requestCache,
      "token:42:view",
      createRequest,
    );

    expect(requestCache.get("token:42:view")).toBe(request);
    await expect(request).rejects.toBe(error);
    expect(requestCache.has("token:42:view")).toBe(false);
  });

  it("still runs post detail request creators when no request cache is available", async () => {
    const createRequest = vi.fn().mockResolvedValue({ id: 42 });

    await expect(getOrCreatePostDetailRequest(
      null,
      "token:42:view",
      createRequest,
    )).resolves.toEqual({ id: 42 });

    expect(createRequest).toHaveBeenCalledTimes(1);
  });

  it("returns fresh cached post details without prefetch background refreshes", () => {
    const cachedPost = { id: 42 };
    const cache = new Map([[
      "token:42",
      {
        value: cachedPost,
        cachedAt: Date.now(),
      },
    ]]);
    const startRequest = vi.fn();

    expect(resolvePostDetailFromCacheOrRequest({
      cache,
      cacheKey: "token:42",
      ttlMs: 1000,
      trackView: false,
      startRequest,
    })).toBe(cachedPost);

    expect(startRequest).not.toHaveBeenCalled();
  });

  it("returns fresh cached post details and starts view refreshes in the background", () => {
    const cachedPost = { id: 42, content: "cached" };
    const cache = new Map([[
      "token:42",
      {
        value: cachedPost,
        cachedAt: Date.now(),
      },
    ]]);
    const backgroundRequest = Promise.resolve({ id: 42, content: "fresh" });
    const startRequest = vi.fn(() => backgroundRequest);

    const result = resolvePostDetailFromCacheOrRequest({
      cache,
      cacheKey: "token:42",
      ttlMs: 1000,
      trackView: true,
      startRequest,
    });

    expect(result).toBe(cachedPost);
    expect(startRequest).toHaveBeenCalledTimes(1);
  });

  it("bypasses fresh cached post details when a forced refresh is requested", async () => {
    const cachedPost = { id: 42, content: "cached" };
    const freshPost = { id: 42, content: "fresh" };
    const cache = new Map([[
      "token:42",
      {
        value: cachedPost,
        cachedAt: Date.now(),
      },
    ]]);
    const startRequest = vi.fn().mockResolvedValue(freshPost);

    await expect(resolvePostDetailFromCacheOrRequest({
      cache,
      cacheKey: "token:42",
      ttlMs: 1000,
      forceRefresh: true,
      startRequest,
    })).resolves.toBe(freshPost);

    expect(startRequest).toHaveBeenCalledTimes(1);
  });

  it("suppresses background refresh failures while returning cached post details", async () => {
    const cachedPost = { id: 42, content: "cached" };
    const cache = new Map([[
      "token:42",
      {
        value: cachedPost,
        cachedAt: Date.now(),
      },
    ]]);
    const backgroundRequest = Promise.reject(new Error("network"));
    const catchSpy = vi.spyOn(backgroundRequest, "catch");

    const result = resolvePostDetailFromCacheOrRequest({
      cache,
      cacheKey: "token:42",
      ttlMs: 1000,
      trackView: true,
      startRequest: () => backgroundRequest,
    });

    expect(result).toBe(cachedPost);
    expect(catchSpy).toHaveBeenCalledTimes(1);
    await catchSpy.mock.results[0].value;
  });

  it("starts a foreground request when no fresh cached post detail is available", async () => {
    const cache = new Map();
    const startRequest = vi.fn().mockResolvedValue({ id: 42 });

    await expect(resolvePostDetailFromCacheOrRequest({
      cache,
      cacheKey: "token:42",
      ttlMs: 1000,
      trackView: true,
      startRequest,
    })).resolves.toEqual({ id: 42 });

    expect(startRequest).toHaveBeenCalledTimes(1);
  });

  it("fetches, normalizes, and remembers post details", async () => {
    const cache = new Map();
    const fetchedPost = { id: 42, body: "raw" };
    const normalizedPost = { id: 42, content: "normalized" };
    const fetchPostDetail = vi.fn().mockResolvedValue(fetchedPost);
    const normalizePostDetail = vi.fn(() => normalizedPost);

    await expect(fetchNormalizeAndRememberPostDetail({
      fetchPostDetail,
      normalizePostDetail,
      cache,
      cacheKey: "token:42",
      cacheOptions: {
        nowMs: 2000,
        limit: 2,
      },
    })).resolves.toBe(normalizedPost);

    expect(fetchPostDetail).toHaveBeenCalledTimes(1);
    expect(normalizePostDetail).toHaveBeenCalledWith(fetchedPost);
    expect(cache.get("token:42")).toEqual({
      value: normalizedPost,
      cachedAt: 2000,
    });
  });

  it("remembers fetched post details directly when no normalizer is provided", async () => {
    const cache = new Map();
    const fetchedPost = { id: 42, content: "raw" };

    await expect(fetchNormalizeAndRememberPostDetail({
      fetchPostDetail: vi.fn().mockResolvedValue(fetchedPost),
      cache,
      cacheKey: "token:42",
      cacheOptions: {
        nowMs: 2000,
      },
    })).resolves.toBe(fetchedPost);

    expect(cache.get("token:42")).toEqual({
      value: fetchedPost,
      cachedAt: 2000,
    });
  });

  it("does not remember post details when fetching fails", async () => {
    const cache = new Map();
    const error = new Error("network");

    await expect(fetchNormalizeAndRememberPostDetail({
      fetchPostDetail: vi.fn().mockRejectedValue(error),
      normalizePostDetail: vi.fn(),
      cache,
      cacheKey: "token:42",
    })).rejects.toBe(error);

    expect(cache.has("token:42")).toBe(false);
  });

  it("rejects locally unavailable post details before they can re-enter the cache", async () => {
    const cache = new Map();

    await expect(fetchNormalizeAndRememberPostDetail({
      fetchPostDetail: vi.fn().mockResolvedValue({ id: 42, content: "stale" }),
      normalizePostDetail: (post) => ({ ...post, contentLoaded: true }),
      accept: () => false,
      cache,
      cacheKey: "token:42",
    })).rejects.toMatchObject({
      response: {
        status: 410,
      },
    });

    expect(cache.has("token:42")).toBe(false);
  });

  it("builds unavailable post detail errors that classify as missing content", () => {
    expect(classifyPostDetailError({ response: { status: 410 } })).toBe(
      POST_DETAIL_ERROR_TYPES.notFound,
    );
  });

  it("returns null without touching cache when no post detail fetcher is provided", async () => {
    const cache = new Map();

    await expect(fetchNormalizeAndRememberPostDetail({
      cache,
      cacheKey: "token:42",
    })).resolves.toBeNull();

    expect(cache.has("token:42")).toBe(false);
  });

  it("returns fresh cached post details and evicts stale entries", () => {
    const cache = new Map([
      ["fresh", { value: { id: 42 }, cachedAt: 1000 }],
      ["stale", { value: { id: 7 }, cachedAt: 1000 }],
    ]);

    expect(getFreshCachedPostDetail(cache, "fresh", {
      nowMs: 1500,
      ttlMs: 1000,
    })).toEqual({ id: 42 });
    expect(getFreshCachedPostDetail(cache, "stale", {
      nowMs: 2501,
      ttlMs: 1000,
    })).toBeNull();
    expect(cache.has("stale")).toBe(false);
    expect(getFreshCachedPostDetail(cache, "missing", {
      nowMs: 1500,
      ttlMs: 1000,
    })).toBeNull();
  });

  it("remembers post details and trims the oldest cache entries", () => {
    const cache = new Map([
      ["one", { value: { id: 1 }, cachedAt: 100 }],
      ["two", { value: { id: 2 }, cachedAt: 200 }],
    ]);

    rememberPostDetail(cache, "three", { id: 3 }, {
      nowMs: 300,
      limit: 2,
    });

    expect(Array.from(cache.keys())).toEqual(["two", "three"]);
    expect(cache.get("three")).toEqual({
      value: { id: 3 },
      cachedAt: 300,
    });
  });

  it("updates all cached post detail entries for a main post id", () => {
    const cache = new Map([
      ["anonymous:42", { value: { id: 42, title: "旧标题" }, cachedAt: 100 }],
      ["token:42", { value: { id: 42, title: "旧标题" }, cachedAt: 100 }],
      ["token:7", { value: { id: 7, title: "其他" }, cachedAt: 100 }],
    ]);

    expect(updateCachedPostDetails(cache, 42, (post) => ({
      ...post,
      title: "新标题",
    }), 300)).toBe(2);

    expect(cache.get("anonymous:42")).toEqual({
      value: { id: 42, title: "新标题" },
      cachedAt: 300,
    });
    expect(cache.get("token:42")).toEqual({
      value: { id: 42, title: "新标题" },
      cachedAt: 300,
    });
    expect(cache.get("token:7").value.title).toBe("其他");
  });

  it("removes cached post detail entries when the updater returns no value", () => {
    const cache = new Map([
      ["anonymous:42", { value: { id: 42 }, cachedAt: 100 }],
      ["token:42", { value: { id: 42 }, cachedAt: 100 }],
      ["token:7", { value: { id: 7 }, cachedAt: 100 }],
    ]);

    expect(updateCachedPostDetails(cache, 42, () => null)).toBe(2);

    expect(cache.has("anonymous:42")).toBe(false);
    expect(cache.has("token:42")).toBe(false);
    expect(cache.has("token:7")).toBe(true);
  });

  it("merges sub-post pages by id while letting newer page data win", () => {
    expect(mergeSubPostPages([
      { id: 1, content: "old-1" },
      { id: 2, content: "old-2" },
    ], [
      { id: 2, content: "new-2" },
      { id: 3, content: "new-3" },
    ])).toEqual([
      { id: 1, content: "old-1" },
      { id: 2, content: "new-2" },
      { id: 3, content: "new-3" },
    ]);
  });

  it("merges sub-post pages by subPostId aliases when id is missing or malformed", () => {
    expect(mergeSubPostPages([
      { subPostId: "1", content: "old-1" },
      { id: "draft", subPostId: "2", content: "old-2" },
    ], [
      { id: "draft", subPostId: "2", content: "new-2" },
      { subPostId: "3", content: "new-3" },
    ])).toEqual([
      { subPostId: "1", content: "old-1" },
      { id: "draft", subPostId: "2", content: "new-2" },
      { subPostId: "3", content: "new-3" },
    ]);
  });

  it("merges sub-post pages by targetSubPostId aliases when preferred ids are missing or malformed", () => {
    expect(mergeSubPostPages([
      { subPostId: "1", content: "old-1" },
      { id: "draft", subPostId: "pending", targetSubPostId: "2", content: "old-2" },
    ], [
      { id: "draft", subPostId: "pending", targetSubPostId: "2", content: "new-2" },
      { targetSubPostId: "3", content: "new-3" },
    ])).toEqual([
      { subPostId: "1", content: "old-1" },
      { id: "draft", subPostId: "pending", targetSubPostId: "2", content: "new-2" },
      { targetSubPostId: "3", content: "new-3" },
    ]);
  });

  it("ignores sub-post page items without usable positive integer ids", () => {
    expect(mergeSubPostPages([
      { id: -1, content: "bad-negative" },
      { id: 1.5, content: "bad-fraction" },
      { id: 1, content: "old-1" },
    ], [
      { id: "draft", subPostId: "-2", content: "bad-alias-negative" },
      { id: "draft", subPostId: "2.5", content: "bad-alias-fraction" },
      { id: "draft", subPostId: "pending", targetSubPostId: "-3", content: "bad-target" },
      { subPostId: "2", content: "new-2" },
    ])).toEqual([
      { id: 1, content: "old-1" },
      { subPostId: "2", content: "new-2" },
    ]);
  });

  it("normalizes sub-post pagination runtime state", () => {
    expect(normalizeSubPostPageRuntimeState({
      nextCursor: "cursor-2",
      hasMore: true,
    })).toEqual({
      nextCursor: "cursor-2",
      hasMore: true,
    });
    expect(normalizeSubPostPageRuntimeState({
      nextCursor: 42,
      hasMore: 1,
    })).toEqual({
      nextCursor: "",
      hasMore: true,
    });
    expect(normalizeSubPostPageRuntimeState(null)).toEqual({
      nextCursor: "",
      hasMore: false,
    });
  });

  it("fetches, normalizes, and applies sub-post page pagination", async () => {
    const subPostCursorRef = { current: "" };
    const subPostsHasMoreRef = { current: false };
    const setSubPostCursor = vi.fn();
    const setSubPostsHasMore = vi.fn();
    const rawSubPosts = [
      { id: 1, body: "raw-1" },
      { id: 2, body: "raw-2" },
    ];
    const fetchSubPostPage = vi.fn().mockResolvedValue({
      subPosts: rawSubPosts,
      nextCursor: "cursor-2",
      hasMore: true,
    });
    const normalizeSubPost = vi.fn((subPost) => ({
      id: subPost.id,
      content: subPost.body,
    }));

    await expect(fetchNormalizeSubPostPage({
      fetchSubPostPage,
      normalizeSubPost,
      subPostCursorRef,
      subPostsHasMoreRef,
      setSubPostCursor,
      setSubPostsHasMore,
    })).resolves.toEqual([
      { id: 1, content: "raw-1" },
      { id: 2, content: "raw-2" },
    ]);

    expect(fetchSubPostPage).toHaveBeenCalledTimes(1);
    expect(normalizeSubPost).toHaveBeenCalledTimes(2);
    expect(subPostCursorRef.current).toBe("cursor-2");
    expect(subPostsHasMoreRef.current).toBe(true);
    expect(setSubPostCursor).toHaveBeenCalledWith("cursor-2");
    expect(setSubPostsHasMore).toHaveBeenCalledWith(true);
  });

  it("returns raw sub-posts when no sub-post normalizer is provided", async () => {
    const rawSubPosts = [{ id: 1, content: "raw" }];

    await expect(fetchNormalizeSubPostPage({
      fetchSubPostPage: vi.fn().mockResolvedValue({
        subPosts: rawSubPosts,
        nextCursor: "",
        hasMore: false,
      }),
    })).resolves.toEqual(rawSubPosts);
  });

  it("returns an empty sub-post list for malformed page payloads after applying pagination", async () => {
    const subPostCursorRef = { current: "old" };
    const subPostsHasMoreRef = { current: true };

    await expect(fetchNormalizeSubPostPage({
      fetchSubPostPage: vi.fn().mockResolvedValue({
        subPosts: null,
        nextCursor: "cursor-2",
        hasMore: false,
      }),
      subPostCursorRef,
      subPostsHasMoreRef,
    })).resolves.toEqual([]);

    expect(subPostCursorRef.current).toBe("cursor-2");
    expect(subPostsHasMoreRef.current).toBe(false);
  });

  it("does not normalize or apply sub-post pages rejected by the response guard", async () => {
    const subPostCursorRef = { current: "old-cursor" };
    const subPostsHasMoreRef = { current: true };
    const setSubPostCursor = vi.fn();
    const setSubPostsHasMore = vi.fn();
    const normalizeSubPost = vi.fn((subPost) => subPost);
    const applySubPostsPage = vi.fn();

    await expect(fetchNormalizeSubPostPage({
      fetchSubPostPage: vi.fn().mockResolvedValue({
        subPosts: [{ id: 1, content: "late" }],
        nextCursor: "cursor-2",
        hasMore: false,
      }),
      normalizeSubPost,
      shouldApplyPage: () => false,
      applySubPostsPage,
      subPostCursorRef,
      subPostsHasMoreRef,
      setSubPostCursor,
      setSubPostsHasMore,
    })).resolves.toEqual([]);

    expect(normalizeSubPost).not.toHaveBeenCalled();
    expect(applySubPostsPage).not.toHaveBeenCalled();
    expect(subPostCursorRef.current).toBe("old-cursor");
    expect(subPostsHasMoreRef.current).toBe(true);
    expect(setSubPostCursor).not.toHaveBeenCalled();
    expect(setSubPostsHasMore).not.toHaveBeenCalled();
  });

  it("lets callers apply normalized sub-post pages for load-more merging", async () => {
    const pageState = {
      subPosts: [
        { id: 2, body: "raw-2" },
        { id: 3, body: "raw-3" },
      ],
      nextCursor: "cursor-3",
      hasMore: true,
    };
    const applySubPostsPage = vi.fn(({ pageState: receivedPage, nextSubPosts }) => ({
      pageState: receivedPage,
      merged: [
        { id: 1, content: "old-1" },
        ...nextSubPosts,
      ],
    }));

    await expect(fetchNormalizeSubPostPage({
      fetchSubPostPage: vi.fn().mockResolvedValue(pageState),
      normalizeSubPost: (subPost) => ({
        id: subPost.id,
        content: subPost.body,
      }),
      shouldApplyPage: () => true,
      applySubPostsPage,
    })).resolves.toEqual({
      pageState,
      merged: [
        { id: 1, content: "old-1" },
        { id: 2, content: "raw-2" },
        { id: 3, content: "raw-3" },
      ],
    });

    expect(applySubPostsPage).toHaveBeenCalledWith({
      pageState,
      nextSubPosts: [
        { id: 2, content: "raw-2" },
        { id: 3, content: "raw-3" },
      ],
    });
  });

  it("does not apply sub-post pagination when fetching the page fails", async () => {
    const subPostCursorRef = { current: "old-cursor" };
    const subPostsHasMoreRef = { current: true };
    const setSubPostCursor = vi.fn();
    const setSubPostsHasMore = vi.fn();
    const error = new Error("network");

    await expect(fetchNormalizeSubPostPage({
      fetchSubPostPage: vi.fn().mockRejectedValue(error),
      subPostCursorRef,
      subPostsHasMoreRef,
      setSubPostCursor,
      setSubPostsHasMore,
    })).rejects.toBe(error);

    expect(subPostCursorRef.current).toBe("old-cursor");
    expect(subPostsHasMoreRef.current).toBe(true);
    expect(setSubPostCursor).not.toHaveBeenCalled();
    expect(setSubPostsHasMore).not.toHaveBeenCalled();
  });

  it("returns an empty sub-post list when no sub-post page fetcher is provided", async () => {
    const setSubPostCursor = vi.fn();
    const setSubPostsHasMore = vi.fn();

    await expect(fetchNormalizeSubPostPage({
      setSubPostCursor,
      setSubPostsHasMore,
    })).resolves.toEqual([]);

    expect(setSubPostCursor).not.toHaveBeenCalled();
    expect(setSubPostsHasMore).not.toHaveBeenCalled();
  });

  it("applies sub-post pagination state to refs and setters consistently", () => {
    const subPostCursorRef = { current: "old-cursor" };
    const subPostsHasMoreRef = { current: false };
    const setSubPostCursor = vi.fn();
    const setSubPostsHasMore = vi.fn();

    expect(applySubPostPaginationState({
      pageState: {
        nextCursor: "cursor-2",
        hasMore: true,
      },
      subPostCursorRef,
      subPostsHasMoreRef,
      setSubPostCursor,
      setSubPostsHasMore,
    })).toEqual({
      nextCursor: "cursor-2",
      hasMore: true,
    });

    expect(subPostCursorRef.current).toBe("cursor-2");
    expect(subPostsHasMoreRef.current).toBe(true);
    expect(setSubPostCursor).toHaveBeenCalledWith("cursor-2");
    expect(setSubPostsHasMore).toHaveBeenCalledWith(true);
  });

  it("allows loading more sub-posts only for active routes with idle pagination", () => {
    expect(shouldLoadMoreSubPosts({
      route: { type: "post", mainPostId: 42 },
      hasMore: true,
      loadingMoreSubPosts: false,
    })).toBe(true);

    expect(shouldLoadMoreSubPosts({
      route: { type: "post", mainPostId: 42 },
      hasMore: false,
      loadingMoreSubPosts: false,
    })).toBe(false);
    expect(shouldLoadMoreSubPosts({
      route: { type: "post", mainPostId: 42 },
      hasMore: true,
      loadingMoreSubPosts: true,
    })).toBe(false);
    expect(shouldLoadMoreSubPosts({
      route: { type: "home" },
      hasMore: true,
      loadingMoreSubPosts: false,
    })).toBe(false);
  });

  it("marks load-more requests busy and clears the previous local load-more error", () => {
    const loadingMoreSubPostsRef = { current: false };
    const setLoadingMoreSubPosts = vi.fn();
    const setLoadingMoreSubPostsError = vi.fn();

    beginSubPostLoadMoreState({
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
      setLoadingMoreSubPostsError,
    });

    expect(loadingMoreSubPostsRef.current).toBe(true);
    expect(setLoadingMoreSubPosts).toHaveBeenCalledWith(true);
    expect(setLoadingMoreSubPostsError).toHaveBeenCalledWith("");
  });

  it("applies loaded load-more pages by updating pagination and merging sub-posts", () => {
    const subPostCursorRef = { current: "cursor-1" };
    const subPostsHasMoreRef = { current: true };
    const setSubPostCursor = vi.fn();
    const setSubPostsHasMore = vi.fn();
    const setSubPosts = vi.fn((updater) => {
      expect(updater([
        { id: 1, content: "old-1" },
        { id: 2, content: "old-2" },
      ])).toEqual([
        { id: 1, content: "old-1" },
        { id: 2, content: "new-2" },
        { id: 3, content: "new-3" },
      ]);
    });

    expect(applyLoadedMoreSubPostsPage({
      pageState: {
        nextCursor: "cursor-2",
        hasMore: true,
      },
      nextSubPosts: [
        { id: 2, content: "new-2" },
        { id: 3, content: "new-3" },
      ],
      subPostCursorRef,
      subPostsHasMoreRef,
      setSubPostCursor,
      setSubPostsHasMore,
      setSubPosts,
    })).toEqual([
      { id: 2, content: "new-2" },
      { id: 3, content: "new-3" },
    ]);

    expect(subPostCursorRef.current).toBe("cursor-2");
    expect(subPostsHasMoreRef.current).toBe(true);
    expect(setSubPostCursor).toHaveBeenCalledWith("cursor-2");
    expect(setSubPostsHasMore).toHaveBeenCalledWith(true);
    expect(setSubPosts).toHaveBeenCalledTimes(1);
  });

  it("stores load-more error messages locally and globally", () => {
    const setLoadingMoreSubPostsError = vi.fn();
    const setMessage = vi.fn();

    expect(applySubPostLoadMoreError({
      message: " 更多子帖加载失败，请稍后重试。 ",
      setLoadingMoreSubPostsError,
      setMessage,
    })).toBe("更多子帖加载失败，请稍后重试。");

    expect(setLoadingMoreSubPostsError).toHaveBeenCalledWith(
      "更多子帖加载失败，请稍后重试。",
    );
    expect(setMessage).toHaveBeenCalledWith("更多子帖加载失败，请稍后重试。");
  });

  it("finalizes load-more state only while the request still matches the active route", () => {
    const loadingMoreSubPostsRef = { current: true };
    const setLoadingMoreSubPosts = vi.fn();

    expect(finalizeSubPostLoadMoreState({
      shouldApply: false,
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
    })).toBe(false);
    expect(loadingMoreSubPostsRef.current).toBe(true);
    expect(setLoadingMoreSubPosts).not.toHaveBeenCalled();

    expect(finalizeSubPostLoadMoreState({
      shouldApply: true,
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
    })).toBe(true);
    expect(loadingMoreSubPostsRef.current).toBe(false);
    expect(setLoadingMoreSubPosts).toHaveBeenCalledWith(false);
  });

  it("skips load-more runtime when pagination is not eligible", async () => {
    const loadingMoreSubPostsRef = { current: false };
    const loadSubPostPage = vi.fn();
    const setLoadingMoreSubPosts = vi.fn();
    const setLoadingMoreSubPostsError = vi.fn();

    await expect(runSubPostLoadMore({
      route: { type: "post", mainPostId: 42 },
      hasMore: false,
      loadingMoreSubPosts: false,
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
      setLoadingMoreSubPostsError,
      loadSubPostPage,
    })).resolves.toEqual([]);

    expect(loadSubPostPage).not.toHaveBeenCalled();
    expect(loadingMoreSubPostsRef.current).toBe(false);
    expect(setLoadingMoreSubPosts).not.toHaveBeenCalled();
    expect(setLoadingMoreSubPostsError).not.toHaveBeenCalled();
  });

  it("runs load-more runtime through busy and finalized states on success", async () => {
    const loadingMoreSubPostsRef = { current: false };
    const setLoadingMoreSubPosts = vi.fn();
    const setLoadingMoreSubPostsError = vi.fn();
    const loadSubPostPage = vi.fn().mockResolvedValue([{ id: 42, content: "reply" }]);

    await expect(runSubPostLoadMore({
      route: { type: "post", mainPostId: 42 },
      hasMore: true,
      loadingMoreSubPosts: false,
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
      setLoadingMoreSubPostsError,
      loadSubPostPage,
      shouldApplyResponse: () => true,
    })).resolves.toEqual([{ id: 42, content: "reply" }]);

    expect(loadSubPostPage).toHaveBeenCalledTimes(1);
    expect(loadingMoreSubPostsRef.current).toBe(false);
    expect(setLoadingMoreSubPosts).toHaveBeenNthCalledWith(1, true);
    expect(setLoadingMoreSubPosts).toHaveBeenNthCalledWith(2, false);
    expect(setLoadingMoreSubPostsError).toHaveBeenCalledWith("");
  });

  it("stores load-more runtime errors and finalizes matching requests", async () => {
    const loadingMoreSubPostsRef = { current: false };
    const setLoadingMoreSubPosts = vi.fn();
    const setLoadingMoreSubPostsError = vi.fn();
    const setMessage = vi.fn();
    const error = new Error("network");

    await expect(runSubPostLoadMore({
      route: { type: "post", mainPostId: 42 },
      hasMore: true,
      loadingMoreSubPosts: false,
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
      setLoadingMoreSubPostsError,
      setMessage,
      loadSubPostPage: vi.fn().mockRejectedValue(error),
      shouldApplyResponse: () => true,
      formatError: () => "子帖加载失败",
    })).resolves.toEqual([]);

    expect(setLoadingMoreSubPostsError).toHaveBeenCalledWith("");
    expect(setLoadingMoreSubPostsError).toHaveBeenCalledWith("子帖加载失败");
    expect(setMessage).toHaveBeenCalledWith("子帖加载失败");
    expect(loadingMoreSubPostsRef.current).toBe(false);
    expect(setLoadingMoreSubPosts).toHaveBeenLastCalledWith(false);
  });

  it("does not store or finalize load-more runtime errors for stale responses", async () => {
    const loadingMoreSubPostsRef = { current: false };
    const setLoadingMoreSubPosts = vi.fn();
    const setLoadingMoreSubPostsError = vi.fn();
    const setMessage = vi.fn();
    const error = new Error("network");

    await expect(runSubPostLoadMore({
      route: { type: "post", mainPostId: 42 },
      hasMore: true,
      loadingMoreSubPosts: false,
      loadingMoreSubPostsRef,
      setLoadingMoreSubPosts,
      setLoadingMoreSubPostsError,
      setMessage,
      loadSubPostPage: vi.fn().mockRejectedValue(error),
      shouldApplyResponse: () => false,
      formatError: () => "子帖加载失败",
    })).resolves.toEqual([]);

    expect(setLoadingMoreSubPostsError).toHaveBeenCalledTimes(1);
    expect(setLoadingMoreSubPostsError).toHaveBeenCalledWith("");
    expect(setMessage).not.toHaveBeenCalled();
    expect(loadingMoreSubPostsRef.current).toBe(true);
    expect(setLoadingMoreSubPosts).toHaveBeenCalledTimes(1);
    expect(setLoadingMoreSubPosts).toHaveBeenCalledWith(true);
  });

  it("clears all post detail runtime state when leaving post routes", () => {
    const subPostCursorRef = { current: "cursor-2" };
    const subPostsHasMoreRef = { current: true };
    const loadingMoreSubPostsRef = { current: true };
    const calls = {
      setPostDetail: vi.fn(),
      setSubPosts: vi.fn(),
      setLoadingPostDetail: vi.fn(),
      setLoadingSubPosts: vi.fn(),
      setLoadingMoreSubPosts: vi.fn(),
      setPostDetailErrorType: vi.fn(),
      setSubPostsError: vi.fn(),
      setLoadingMoreSubPostsError: vi.fn(),
      setSubPostCursor: vi.fn(),
      setSubPostsHasMore: vi.fn(),
    };

    applyInactivePostDetailRouteState({
      ...calls,
      subPostCursorRef,
      subPostsHasMoreRef,
      loadingMoreSubPostsRef,
    });

    expect(calls.setPostDetail).toHaveBeenCalledWith(null);
    expect(calls.setSubPosts).toHaveBeenCalledWith([]);
    expect(calls.setLoadingPostDetail).toHaveBeenCalledWith(false);
    expect(calls.setLoadingSubPosts).toHaveBeenCalledWith(false);
    expect(calls.setLoadingMoreSubPosts).toHaveBeenCalledWith(false);
    expect(calls.setPostDetailErrorType).toHaveBeenCalledWith("");
    expect(calls.setSubPostsError).toHaveBeenCalledWith("");
    expect(calls.setLoadingMoreSubPostsError).toHaveBeenCalledWith("");
    expect(calls.setSubPostCursor).toHaveBeenCalledWith("");
    expect(calls.setSubPostsHasMore).toHaveBeenCalledWith(false);
    expect(subPostCursorRef.current).toBe("");
    expect(subPostsHasMoreRef.current).toBe(false);
    expect(loadingMoreSubPostsRef.current).toBe(false);
  });

  it("resets pagination and starts initial loading for active post routes", () => {
    const subPostCursorRef = { current: "cursor-2" };
    const subPostsHasMoreRef = { current: true };
    const calls = {
      setSubPostsError: vi.fn(),
      setLoadingMoreSubPostsError: vi.fn(),
      setLoadingPostDetail: vi.fn(),
      setLoadingSubPosts: vi.fn(),
      setSubPostCursor: vi.fn(),
      setSubPostsHasMore: vi.fn(),
    };

    applyActivePostDetailRouteStartState({
      ...calls,
      subPostCursorRef,
      subPostsHasMoreRef,
    });

    expect(calls.setSubPostsError).toHaveBeenCalledWith("");
    expect(calls.setLoadingMoreSubPostsError).toHaveBeenCalledWith("");
    expect(calls.setLoadingPostDetail).toHaveBeenCalledWith(true);
    expect(calls.setLoadingSubPosts).toHaveBeenCalledWith(true);
    expect(calls.setSubPostCursor).toHaveBeenCalledWith("");
    expect(calls.setSubPostsHasMore).toHaveBeenCalledWith(false);
    expect(subPostCursorRef.current).toBe("");
    expect(subPostsHasMoreRef.current).toBe(false);
  });

  it("starts only the requested post thread reload loading states", () => {
    const calls = {
      setLoadingPostDetail: vi.fn(),
      setLoadingSubPosts: vi.fn(),
      setSubPostsError: vi.fn(),
      setLoadingMoreSubPostsError: vi.fn(),
    };

    applyPostThreadReloadStartState({
      reloadPostDetail: true,
      reloadSubPosts: false,
      clearSubPostErrors: false,
      ...calls,
    });

    expect(calls.setLoadingPostDetail).toHaveBeenCalledWith(true);
    expect(calls.setLoadingSubPosts).not.toHaveBeenCalled();
    expect(calls.setSubPostsError).not.toHaveBeenCalled();
    expect(calls.setLoadingMoreSubPostsError).not.toHaveBeenCalled();
  });

  it("clears sub-post errors when a sub-post reload starts", () => {
    const calls = {
      setLoadingPostDetail: vi.fn(),
      setLoadingSubPosts: vi.fn(),
      setSubPostsError: vi.fn(),
      setLoadingMoreSubPostsError: vi.fn(),
    };

    applyPostThreadReloadStartState({
      reloadSubPosts: true,
      clearSubPostErrors: true,
      ...calls,
    });

    expect(calls.setLoadingPostDetail).not.toHaveBeenCalled();
    expect(calls.setLoadingSubPosts).toHaveBeenCalledWith(true);
    expect(calls.setSubPostsError).toHaveBeenCalledWith("");
    expect(calls.setLoadingMoreSubPostsError).toHaveBeenCalledWith("");
  });

  it("finalizes only matching post thread reload loading states", () => {
    const calls = {
      setLoadingPostDetail: vi.fn(),
      setLoadingSubPosts: vi.fn(),
    };

    expect(finalizePostThreadReloadState({
      shouldApply: false,
      reloadPostDetail: true,
      reloadSubPosts: true,
      ...calls,
    })).toBe(false);
    expect(calls.setLoadingPostDetail).not.toHaveBeenCalled();
    expect(calls.setLoadingSubPosts).not.toHaveBeenCalled();

    expect(finalizePostThreadReloadState({
      shouldApply: true,
      reloadPostDetail: true,
      reloadSubPosts: false,
      ...calls,
    })).toBe(true);
    expect(calls.setLoadingPostDetail).toHaveBeenCalledWith(false);
    expect(calls.setLoadingSubPosts).not.toHaveBeenCalled();
  });

  it("skips post thread reload runtime for inactive post routes", async () => {
    const runReload = vi.fn();
    const setLoadingPostDetail = vi.fn();

    await expect(runPostThreadReload({
      route: { type: "home" },
      inactiveResult: () => ({ postDetail: null, subPosts: [] }),
      reloadPostDetail: true,
      setLoadingPostDetail,
      runReload,
    })).resolves.toEqual({
      postDetail: null,
      subPosts: [],
    });

    expect(runReload).not.toHaveBeenCalled();
    expect(setLoadingPostDetail).not.toHaveBeenCalled();
  });

  it("runs post thread reload runtime through start and finalize states", async () => {
    const setLoadingPostDetail = vi.fn();
    const setLoadingSubPosts = vi.fn();
    const setSubPostsError = vi.fn();
    const setLoadingMoreSubPostsError = vi.fn();
    const runReload = vi.fn().mockResolvedValue({ id: 42 });

    await expect(runPostThreadReload({
      route: { type: "post", mainPostId: 42 },
      getCurrentRoute: () => ({ type: "post", mainPostId: 42 }),
      reloadPostDetail: true,
      reloadSubPosts: true,
      clearSubPostErrors: true,
      setLoadingPostDetail,
      setLoadingSubPosts,
      setSubPostsError,
      setLoadingMoreSubPostsError,
      runReload,
    })).resolves.toEqual({ id: 42 });

    expect(runReload).toHaveBeenCalledTimes(1);
    expect(runReload.mock.calls[0][0].shouldApply()).toBe(true);
    expect(setLoadingPostDetail).toHaveBeenNthCalledWith(1, true);
    expect(setLoadingPostDetail).toHaveBeenNthCalledWith(2, false);
    expect(setLoadingSubPosts).toHaveBeenNthCalledWith(1, true);
    expect(setLoadingSubPosts).toHaveBeenNthCalledWith(2, false);
    expect(setSubPostsError).toHaveBeenCalledWith("");
    expect(setLoadingMoreSubPostsError).toHaveBeenCalledWith("");
  });

  it("does not finalize post thread reload runtime for stale routes", async () => {
    const setLoadingPostDetail = vi.fn();
    const runReload = vi.fn().mockResolvedValue(null);

    await expect(runPostThreadReload({
      route: { type: "post", mainPostId: 42 },
      getCurrentRoute: () => ({ type: "post", mainPostId: 43 }),
      reloadPostDetail: true,
      setLoadingPostDetail,
      runReload,
    })).resolves.toBeNull();

    expect(runReload).toHaveBeenCalledTimes(1);
    expect(runReload.mock.calls[0][0].shouldApply()).toBe(false);
    expect(setLoadingPostDetail).toHaveBeenCalledTimes(1);
    expect(setLoadingPostDetail).toHaveBeenCalledWith(true);
  });

  it("can skip post thread reload start state while still finalizing matching requests", async () => {
    const setLoadingPostDetail = vi.fn();
    const setLoadingSubPosts = vi.fn();

    await expect(runPostThreadReload({
      route: { type: "post", mainPostId: 42 },
      getCurrentRoute: () => ({ type: "post", mainPostId: 42 }),
      reloadPostDetail: true,
      reloadSubPosts: true,
      applyStartState: false,
      setLoadingPostDetail,
      setLoadingSubPosts,
      runReload: vi.fn().mockResolvedValue({ postDetail: { id: 42 }, subPosts: [] }),
    })).resolves.toEqual({
      postDetail: { id: 42 },
      subPosts: [],
    });

    expect(setLoadingPostDetail).toHaveBeenCalledTimes(1);
    expect(setLoadingPostDetail).toHaveBeenCalledWith(false);
    expect(setLoadingSubPosts).toHaveBeenCalledTimes(1);
    expect(setLoadingSubPosts).toHaveBeenCalledWith(false);
  });

  it("finalizes matching post thread reload runtime after failures", async () => {
    const setLoadingPostDetail = vi.fn();
    const error = new Error("network");

    await expect(runPostThreadReload({
      route: { type: "post", mainPostId: 42 },
      getCurrentRoute: () => ({ type: "post", mainPostId: 42 }),
      reloadPostDetail: true,
      setLoadingPostDetail,
      runReload: vi.fn().mockRejectedValue(error),
    })).rejects.toBe(error);

    expect(setLoadingPostDetail).toHaveBeenNthCalledWith(1, true);
    expect(setLoadingPostDetail).toHaveBeenNthCalledWith(2, false);
  });

  it("classifies missing posts separately from transient load failures", () => {
    expect(classifyPostDetailError(httpError(404))).toBe(POST_DETAIL_ERROR_TYPES.notFound);
    expect(classifyPostDetailError(httpError(410))).toBe(POST_DETAIL_ERROR_TYPES.notFound);
    expect(classifyPostDetailError(httpError(500))).toBe(POST_DETAIL_ERROR_TYPES.loadFailed);
    expect(classifyPostDetailError(new Error("Network Error"))).toBe(
      POST_DETAIL_ERROR_TYPES.loadFailed,
    );
  });

  it("identifies unavailable post detail errors for user-facing copy", () => {
    expect(isPostDetailUnavailableError(httpError(404))).toBe(true);
    expect(isPostDetailUnavailableError(httpError(410))).toBe(true);
    expect(isPostDetailUnavailableError(httpError(500))).toBe(false);
  });

  it("builds guarded post thread runtime callbacks with message handlers", () => {
    const setPostDetail = vi.fn();
    const setPostDetailErrorType = vi.fn();
    const onPostDetailLoaded = vi.fn();
    const setSubPosts = vi.fn();
    const setSubPostsError = vi.fn();
    const onPostDetailError = vi.fn();
    const onSubPostsError = vi.fn();
    const post = { id: 42 };
    const subPosts = [{ id: 7 }];

    const runtimeCallbacks = buildPostThreadRuntimeCallbacks({
      isActive: () => true,
      setPostDetail,
      setPostDetailErrorType,
      onPostDetailLoaded,
      setSubPosts,
      setSubPostsError,
      messageHandlers: {
        onPostDetailError,
        onSubPostsError,
      },
    });

    runtimeCallbacks.setPostDetail(post);
    runtimeCallbacks.setPostDetailErrorType("");
    runtimeCallbacks.onPostDetailLoaded(post);
    runtimeCallbacks.setSubPosts(subPosts);
    runtimeCallbacks.setSubPostsError("");
    runtimeCallbacks.onPostDetailError(new Error("detail"));
    runtimeCallbacks.onSubPostsError(new Error("sub-posts"));

    expect(setPostDetail).toHaveBeenCalledWith(post);
    expect(setPostDetailErrorType).toHaveBeenCalledWith("");
    expect(onPostDetailLoaded).toHaveBeenCalledWith(post);
    expect(setSubPosts).toHaveBeenCalledWith(subPosts);
    expect(setSubPostsError).toHaveBeenCalledWith("");
    expect(onPostDetailError).toHaveBeenCalledTimes(1);
    expect(onSubPostsError).toHaveBeenCalledTimes(1);
  });

  it("keeps composed post thread runtime callbacks guarded when inactive", () => {
    const setPostDetail = vi.fn();
    const onPostDetailLoaded = vi.fn();
    const onSubPostsError = vi.fn();

    const runtimeCallbacks = buildPostThreadRuntimeCallbacks({
      isActive: () => false,
      setPostDetail,
      onPostDetailLoaded,
      messageHandlers: {
        onSubPostsError,
      },
    });

    runtimeCallbacks.setPostDetail({ id: 42 });
    runtimeCallbacks.onPostDetailLoaded({ id: 42 });
    runtimeCallbacks.onSubPostsError(new Error("sub-posts"));

    expect(setPostDetail).not.toHaveBeenCalled();
    expect(onPostDetailLoaded).not.toHaveBeenCalled();
    expect(onSubPostsError).not.toHaveBeenCalled();
  });

  it("applies async post route responses only to the matching active post route", () => {
    expect(shouldApplyPostRouteResponse({
      requestMainPostId: 42,
      currentRoute: { type: "post", mainPostId: 42 },
    })).toBe(true);

    expect(shouldApplyPostRouteResponse({
      requestMainPostId: 42,
      currentRoute: { type: "post", mainPostId: 43 },
    })).toBe(false);

    expect(shouldApplyPostRouteResponse({
      requestMainPostId: 42,
      currentRoute: { type: "home" },
    })).toBe(false);

    expect(shouldApplyPostRouteResponse({
      requestMainPostId: "bad",
      currentRoute: { type: "post", mainPostId: 42 },
    })).toBe(false);
  });

  it("keeps the sub-post page response guard aligned with the generic post route guard", () => {
    const options = {
      requestMainPostId: 42,
      currentRoute: { type: "post", mainPostId: 42 },
    };

    expect(shouldApplySubPostPageResponse(options)).toBe(shouldApplyPostRouteResponse(options));
  });

  it("clears previous detail error state when post detail loads", () => {
    const setPostDetail = vi.fn();
    const onPostDetailLoaded = vi.fn();
    const setPostDetailErrorType = vi.fn();
    const post = { id: 42, contentLoaded: true };

    const result = applyLoadedPostDetail(
      setPostDetail,
      onPostDetailLoaded,
      post,
      setPostDetailErrorType,
    );

    expect(result).toBe(post);
    expect(setPostDetail).toHaveBeenCalledWith(post);
    expect(setPostDetailErrorType).toHaveBeenCalledWith("");
    expect(onPostDetailLoaded).toHaveBeenCalledWith(post);
  });

  it("stores a missing-post detail error for post detail failures", () => {
    const setPostDetail = vi.fn();
    const setSubPosts = vi.fn();
    const setSubPostsError = vi.fn();
    const setPostDetailErrorType = vi.fn();
    const setMessage = vi.fn();
    const handlers = buildPostThreadMessageHandlers({
      setPostDetail,
      setSubPosts,
      setSubPostsError,
      setPostDetailErrorType,
      setMessage,
      formatPostDetailError: () => "主帖详情加载失败，请稍后重试。",
    });

    handlers.onPostDetailError(httpError(404));

    expect(setPostDetail).toHaveBeenCalledWith(null);
    expect(setSubPosts).not.toHaveBeenCalled();
    expect(setSubPostsError).not.toHaveBeenCalled();
    expect(setPostDetailErrorType).toHaveBeenCalledWith(POST_DETAIL_ERROR_TYPES.notFound);
    expect(setMessage).toHaveBeenCalledWith("主帖详情加载失败，请稍后重试。");
  });

  it("clears sub-posts when thread detail fails even if sub-posts resolve", async () => {
    const setPostDetail = vi.fn();
    const setPostDetailErrorType = vi.fn();
    const setSubPosts = vi.fn();
    const onPostDetailError = vi.fn();
    const error = httpError(404);

    const result = await reloadCurrentPostThreadState({
      route: { type: "post", mainPostId: 42 },
      loadPostDetail: vi.fn().mockRejectedValue(error),
      setPostDetail,
      setPostDetailErrorType,
      loadSubPosts: vi.fn().mockResolvedValue([{ id: 7, content: "stale reply" }]),
      setSubPosts,
      onPostDetailError,
    });

    expect(result).toEqual({
      postDetail: null,
      subPosts: [],
    });
    expect(onPostDetailError).toHaveBeenCalledWith(error);
    expect(setSubPosts).toHaveBeenCalledWith([{ id: 7, content: "stale reply" }]);
    expect(setSubPosts).toHaveBeenLastCalledWith([]);
  });

  it("does not call malformed optional sub-post setters during failed thread reload cleanup", async () => {
    const error = httpError(404);

    await expect(reloadCurrentPostThreadState({
      route: { type: "post", mainPostId: 42 },
      loadPostDetail: vi.fn().mockRejectedValue(error),
      loadSubPosts: vi.fn().mockResolvedValue([{ id: 7, content: "stale reply" }]),
      setSubPosts: { stale: true },
      onPostDetailError: vi.fn(),
    })).resolves.toEqual({
      postDetail: null,
      subPosts: [],
    });
  });

  it("clears detail error state after a successful thread reload", async () => {
    const setPostDetail = vi.fn();
    const setPostDetailErrorType = vi.fn();
    const setSubPosts = vi.fn();
    const post = { id: 42, contentLoaded: true };

    const result = await reloadCurrentPostThreadState({
      route: { type: "post", mainPostId: 42 },
      loadPostDetail: vi.fn().mockResolvedValue(post),
      setPostDetail,
      setPostDetailErrorType,
      loadSubPosts: vi.fn().mockResolvedValue([]),
      setSubPosts,
    });

    expect(result.postDetail).toBe(post);
    expect(setPostDetailErrorType).toHaveBeenCalledWith("");
    expect(setPostDetail).toHaveBeenCalledWith(post);
    expect(setSubPosts).toHaveBeenCalledWith([]);
  });

  it("clears previous sub-post error state when sub-posts load", () => {
    const setSubPosts = vi.fn();
    const setSubPostsError = vi.fn();
    const subPosts = [{ id: 7, content: "reply" }];

    const result = applyLoadedSubPosts(setSubPosts, subPosts, setSubPostsError);

    expect(result).toEqual(subPosts);
    expect(setSubPosts).toHaveBeenCalledWith(subPosts);
    expect(setSubPostsError).toHaveBeenCalledWith("");
  });

  it("stores a local sub-post error for sub-post failures", () => {
    const setSubPosts = vi.fn();
    const setSubPostsError = vi.fn();
    const setMessage = vi.fn();
    const handlers = buildPostThreadMessageHandlers({
      setSubPosts,
      setSubPostsError,
      setMessage,
      formatSubPostsError: () => "子帖加载失败，请稍后重试。",
    });

    handlers.onSubPostsError(new Error("network"));

    expect(setSubPosts).toHaveBeenCalledWith([]);
    expect(setSubPostsError).toHaveBeenCalledWith("子帖加载失败，请稍后重试。");
    expect(setMessage).toHaveBeenCalledWith("子帖加载失败，请稍后重试。");
  });
});
