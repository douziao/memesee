import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCollapsedSubPostBranches,
  buildOrderedSubPostFloors,
  buildSubPostThreadNodeMap,
  buildSubPostSharePost,
  buildTargetSubPostLocatedPreview,
  buildTargetSubPostPageRequestKey,
  buildTargetSubPostStatus,
  calculateSubPostFloorScrollTop,
  findSubPostNodeById,
  highlightSubPostFloor,
  resolveSubPostId,
  resolveTargetSubPostNavigationState,
  resolveSubPostJumpBranchAnchorId,
  scheduleSubPostFloorScroll,
  shouldRequestTargetSubPostPage,
  updatePostDetailAfterSubPostCreated,
  updatePostDetailAfterSubPostDeleted,
  updateSubPostInteraction,
} from "./subPostThreadHelpers";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("resolveSubPostId", () => {
  it("resolves sub-post ids across id aliases without malformed preferred fields blocking fallbacks", () => {
    expect(resolveSubPostId({ id: 42 })).toBe(42);
    expect(resolveSubPostId({ subPostId: "42" })).toBe(42);
    expect(resolveSubPostId({ targetSubPostId: "42" })).toBe(42);
    expect(resolveSubPostId({ id: "draft", subPostId: 42 })).toBe(42);
    expect(resolveSubPostId({
      id: "draft",
      subPostId: "pending",
      targetSubPostId: 42,
    })).toBe(42);
    expect(resolveSubPostId({ id: 0, subPostId: "bad" })).toBe(0);
  });
});

describe("updatePostDetailAfterSubPostCreated", () => {
  it("increments the current main post sub-post count when API and UI id types differ", () => {
    const postDetail = {
      id: "42",
      title: "主帖",
      viewCount: 10,
      subPostCount: 3,
      likeCount: 2,
      favoriteCount: 1,
      latestActivityAt: "2026-01-01T00:00:00.000Z",
    };
    const latestActivityAt = "2026-01-02T00:00:00.000Z";

    const nextDetail = updatePostDetailAfterSubPostCreated(
      postDetail,
      42,
      latestActivityAt,
    );

    expect(nextDetail.subPostCount).toBe(4);
    expect(nextDetail.latestActivityAt).toBe(latestActivityAt);
    expect(Number.isFinite(nextDetail.hotScore)).toBe(true);
  });

  it("updates sub-post rows that only expose subPostId aliases", () => {
    const targetSubPost = {
      subPostId: "42",
      likeCount: 1,
      likedByMe: false,
    };
    const otherSubPost = {
      id: 43,
      likeCount: 0,
      likedByMe: false,
    };

    expect(updateSubPostInteraction([
      targetSubPost,
      otherSubPost,
    ], 42, {
      likeCount: 2,
      likedByMe: true,
    })).toEqual([
      {
        subPostId: "42",
        likeCount: 2,
        likedByMe: true,
      },
      otherSubPost,
    ]);
  });
});

describe("updatePostDetailAfterSubPostDeleted", () => {
  it("decrements the current main post sub-post count after a sub-post is deleted", () => {
    const postDetail = {
      id: 42,
      title: "主帖",
      viewCount: 10,
      subPostCount: 3,
      likeCount: 2,
      favoriteCount: 1,
      latestActivityAt: "2026-01-01T00:00:00.000Z",
    };

    const nextDetail = updatePostDetailAfterSubPostDeleted(postDetail, 42);

    expect(nextDetail.subPostCount).toBe(2);
    expect(Number.isFinite(nextDetail.hotScore)).toBe(true);
  });

  it("does not decrement below zero", () => {
    expect(updatePostDetailAfterSubPostDeleted({
      id: 42,
      subPostCount: 0,
    }, 42).subPostCount).toBe(0);
  });

  it("leaves other main posts unchanged", () => {
    const postDetail = {
      id: 42,
      subPostCount: 3,
    };

    expect(updatePostDetailAfterSubPostDeleted(postDetail, 7)).toBe(postDetail);
  });

  it("decrements when API and UI main post id types differ", () => {
    expect(updatePostDetailAfterSubPostDeleted({
      id: "42",
      subPostCount: 3,
    }, 42).subPostCount).toBe(2);
  });
});

describe("updateSubPostInteraction", () => {
  it("updates sub-post interaction state when API and UI id types differ", () => {
    const firstSubPost = {
      id: "42",
      likeCount: 1,
      likedByMe: false,
    };
    const secondSubPost = {
      id: 43,
      likeCount: 0,
      likedByMe: false,
    };

    expect(updateSubPostInteraction([
      firstSubPost,
      secondSubPost,
    ], 42, {
      likeCount: 2,
      likedByMe: true,
    })).toEqual([
      {
        id: "42",
        likeCount: 2,
        likedByMe: true,
      },
      secondSubPost,
    ]);
  });

  it("updates sub-post rows that only expose targetSubPostId aliases", () => {
    const targetSubPost = {
      targetSubPostId: "42",
      likeCount: 1,
      likedByMe: false,
    };
    const otherSubPost = {
      targetSubPostId: "43",
      likeCount: 0,
      likedByMe: false,
    };

    expect(updateSubPostInteraction([
      targetSubPost,
      otherSubPost,
    ], 42, {
      likeCount: 2,
      likedByMe: true,
    })).toEqual([
      {
        targetSubPostId: "42",
        likeCount: 2,
        likedByMe: true,
      },
      otherSubPost,
    ]);
  });
});

describe("buildSubPostThreadNodeMap", () => {
  it("builds branch nodes with quoted parent metadata", () => {
    const map = buildSubPostThreadNodeMap([
      {
        id: 1,
        authorUsername: "parent-user",
        content: "父级内容",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        parentId: 1,
        author: "child-user",
        content: "子级内容",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
    ]);

    expect(map.get(1).branchSubPosts.map((item) => item.id)).toEqual([2]);
    expect(map.get(2)).toMatchObject({
      targetSubPostAuthor: "parent-user",
      targetSubPostAuthorUsername: "parent-user",
      targetSubPostPreview: "父级内容",
      targetSubPostDeleted: false,
    });
  });

  it("uses media summaries for quoted media-only parent sub-posts", () => {
    const map = buildSubPostThreadNodeMap([
      {
        id: 1,
        authorUsername: "parent-user",
        content: "",
        mediaAssets: [{ id: 99 }],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        parentId: 1,
        author: "child-user",
        content: "子级内容",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
    ]);

    expect(map.get(2)).toMatchObject({
      targetSubPostAuthor: "parent-user",
      targetSubPostPreview: "1张图",
      targetSubPostDeleted: false,
    });
  });

  it("keeps references visible when the parent sub-post is missing", () => {
    const map = buildSubPostThreadNodeMap([
      {
        id: 2,
        parentId: 1,
        parentSubPostAuthorUsername: "deleted-parent",
        author: "child-user",
        content: "子级内容",
      },
    ]);

    expect(map.get(2)).toMatchObject({
      targetSubPostAuthor: "deleted-parent",
      targetSubPostAuthorUsername: "deleted-parent",
      targetSubPostPreview: "该子帖已删除。",
      targetSubPostDeleted: true,
    });
  });

  it("ignores malformed parent ids instead of showing deleted references", () => {
    const map = buildSubPostThreadNodeMap([
      {
        id: 2,
        parentId: "-1",
        parentSubPostAuthorUsername: "bad-parent",
        author: "child-user",
        content: "子级内容",
      },
      {
        id: 3,
        parentId: "1.5",
        parentSubPostAuthorUsername: "fraction-parent",
        author: "child-user",
        content: "另一条子级内容",
      },
    ]);

    expect(map.get(2)).toMatchObject({
      targetSubPostAuthor: null,
      targetSubPostAuthorUsername: "",
      targetSubPostPreview: "",
      targetSubPostDeleted: false,
    });
    expect(map.get(3)).toMatchObject({
      targetSubPostAuthor: null,
      targetSubPostAuthorUsername: "",
      targetSubPostPreview: "",
      targetSubPostDeleted: false,
    });
  });

  it("builds branch nodes when sub-post payloads use subPostId aliases", () => {
    const map = buildSubPostThreadNodeMap([
      {
        subPostId: "1",
        author: "parent-user",
        content: "父级内容",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        subPostId: "2",
        parentId: "1",
        author: "child-user",
        content: "子级内容",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
    ]);

    expect(map.get(1).branchSubPosts.map((item) => item.subPostId)).toEqual(["2"]);
    expect(map.get(2)).toMatchObject({
      targetSubPostAuthor: "parent-user",
      targetSubPostPreview: "父级内容",
      targetSubPostDeleted: false,
    });
  });

  it("builds branch nodes when sub-post payloads only expose targetSubPostId aliases", () => {
    const map = buildSubPostThreadNodeMap([
      {
        targetSubPostId: "1",
        author: "parent-user",
        content: "父级内容",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        targetSubPostId: "2",
        parentId: "1",
        author: "child-user",
        content: "子级内容",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
    ]);

    expect(map.get(1).branchSubPosts.map((item) => item.targetSubPostId)).toEqual(["2"]);
    expect(map.get(2)).toMatchObject({
      targetSubPostAuthor: "parent-user",
      targetSubPostPreview: "父级内容",
      targetSubPostDeleted: false,
    });
  });

  it("uses targetSubPostId for stable ordering when preferred ids are absent", () => {
    const map = buildSubPostThreadNodeMap([
      {
        targetSubPostId: "1",
        author: "parent",
        content: "父级",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        targetSubPostId: "4",
        parentId: 1,
        content: "late",
        createdAt: "2026-01-01T00:02:00.000Z",
      },
      {
        targetSubPostId: "3",
        parentId: 1,
        content: "same-2",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      {
        targetSubPostId: "2",
        parentId: 1,
        content: "same-1",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
    ]);

    expect(map.get(1).branchSubPosts.map((item) => item.targetSubPostId)).toEqual([
      "2",
      "3",
      "4",
    ]);
  });

  it("sorts branch sub-posts by time and then id", () => {
    const map = buildSubPostThreadNodeMap([
      { id: 1, author: "parent", content: "父级", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: 4, parentId: 1, content: "late", createdAt: "2026-01-01T00:02:00.000Z" },
      { id: 3, parentId: 1, content: "same-2", createdAt: "2026-01-01T00:01:00.000Z" },
      { id: 2, parentId: 1, content: "same-1", createdAt: "2026-01-01T00:01:00.000Z" },
    ]);

    expect(map.get(1).branchSubPosts.map((item) => item.id)).toEqual([2, 3, 4]);
  });
});

describe("buildCollapsedSubPostBranches", () => {
  it("keeps collapsed state by resolved sub-post id aliases", () => {
    const previous = { 7: false };
    const next = buildCollapsedSubPostBranches(previous, [
      {
        subPostId: "7",
        branchSubPosts: [{ subPostId: "8", parentId: 7 }],
      },
    ]);

    expect(next).toBe(previous);
  });
});

describe("buildOrderedSubPostFloors", () => {
  it("returns top-level and branch nodes in stable time order", () => {
    const map = buildSubPostThreadNodeMap([
      { id: 3, content: "third", createdAt: "2026-01-01T00:02:00.000Z" },
      { id: 1, content: "first", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: 2, parentId: 1, content: "branch", createdAt: "2026-01-01T00:01:00.000Z" },
    ]);

    expect(buildOrderedSubPostFloors(map).map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("returns an empty list for unusable maps", () => {
    expect(buildOrderedSubPostFloors(null)).toEqual([]);
  });
});

describe("highlightSubPostFloor", () => {
  function createMockFloorElement() {
    const classes = new Set();
    return {
      offsetWidth: 120,
      classList: {
        add: (className) => classes.add(className),
        remove: (className) => classes.delete(className),
        contains: (className) => classes.has(className),
      },
    };
  }

  it("adds a temporary target highlight class to the matched sub-post floor", () => {
    vi.useFakeTimers();
    const target = createMockFloorElement();
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal("document", {
      getElementById: vi.fn((id) => (id === "sub-post-floor-42" ? target : null)),
    });

    expect(highlightSubPostFloor(42, 1000)).toBe(true);

    expect(target.classList.contains("is-target-highlight")).toBe(true);

    vi.advanceTimersByTime(1000);

    expect(target.classList.contains("is-target-highlight")).toBe(false);
  });

  it("returns false when the target floor is unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal("document", {
      getElementById: vi.fn(() => null),
    });

    expect(highlightSubPostFloor(42, 1000)).toBe(false);
    expect(highlightSubPostFloor(0, 1000)).toBe(false);
  });
});

describe("calculateSubPostFloorScrollTop", () => {
  it("keeps target sub-posts below the sticky topbar with a safe gap", () => {
    expect(calculateSubPostFloorScrollTop({
      scrollY: 500,
      targetTop: 320,
      topbarHeight: 72,
      safeGap: 12,
    })).toBe(736);
  });

  it("clamps upward scroll targets and tolerates missing topbar measurements", () => {
    expect(calculateSubPostFloorScrollTop({
      scrollY: 20,
      targetTop: 4,
      topbarHeight: 80,
      safeGap: 12,
    })).toBe(0);

    expect(calculateSubPostFloorScrollTop({
      scrollY: 100,
      targetTop: 64,
      topbarHeight: undefined,
    })).toBe(152);
  });
});

describe("scheduleSubPostFloorScroll", () => {
  function createMockFloorElement({ top = 320 } = {}) {
    const classes = new Set();
    return {
      offsetWidth: 120,
      getBoundingClientRect: () => ({ top }),
      classList: {
        add: (className) => classes.add(className),
        remove: (className) => classes.delete(className),
        contains: (className) => classes.has(className),
      },
    };
  }

  function flushAnimationFrameQueue(callbacks, limit = 20) {
    let runs = 0;
    while (callbacks.length > 0 && runs < limit) {
      const callback = callbacks.shift();
      callback();
      runs += 1;
    }
  }

  it("waits for a freshly expanded branch sub-post before scrolling", () => {
    vi.useFakeTimers();
    const callbacks = [];
    const scrollTo = vi.fn();
    const target = createMockFloorElement();
    const getElementById = vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValue(target);
    vi.stubGlobal("window", {
      scrollY: 500,
      requestAnimationFrame: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      scrollTo,
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal("document", {
      getElementById,
    });

    scheduleSubPostFloorScroll(42, {
      current: {
        getBoundingClientRect: () => ({ height: 72 }),
      },
    });
    flushAnimationFrameQueue(callbacks);

    expect(getElementById).toHaveBeenCalledWith("sub-post-floor-42");
    expect(getElementById).toHaveBeenCalledTimes(3);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 736,
      behavior: "smooth",
    });
    expect(target.classList.contains("is-target-highlight")).toBe(true);
  });
});

describe("findSubPostNodeById", () => {
  it("finds target sub-posts inside loaded branch previews", () => {
    const branchNode = { id: 42, parentId: 7 };

    expect(findSubPostNodeById([
      {
        id: 7,
        branchSubPosts: [
          { id: 11, parentId: 7 },
          branchNode,
        ],
      },
    ], 42)).toBe(branchNode);
  });

  it("finds target sub-posts that only expose subPostId aliases", () => {
    const branchNode = { subPostId: "42", parentId: 7 };

    expect(findSubPostNodeById([
      {
        id: 7,
        branchSubPosts: [branchNode],
      },
    ], 42)).toBe(branchNode);
  });

  it("finds target sub-posts that only expose targetSubPostId aliases", () => {
    const branchNode = { targetSubPostId: "42", parentId: 7 };

    expect(findSubPostNodeById([
      {
        id: 7,
        branchSubPosts: [branchNode],
      },
    ], 42)).toBe(branchNode);
  });

  it("returns null for invalid or missing targets", () => {
    expect(findSubPostNodeById([{ id: 7 }], 0)).toBeNull();
    expect(findSubPostNodeById([{ id: 7 }], 42)).toBeNull();
  });
});

describe("resolveSubPostJumpBranchAnchorId", () => {
  it("expands the parent branch before jumping to a branch sub-post", () => {
    expect(resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors: [
        {
          id: 7,
          branchSubPosts: [
            { id: 42, parentId: 7 },
          ],
        },
      ],
      subPostId: 42,
    })).toBe(7);
  });

  it("expands the parent branch when the target node only exposes subPostId", () => {
    expect(resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors: [
        {
          id: 7,
          branchSubPosts: [
            { subPostId: "42", parentId: 7 },
          ],
        },
      ],
      subPostId: 42,
    })).toBe(7);
  });

  it("expands the parent branch when the target node only exposes targetSubPostId", () => {
    expect(resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors: [
        {
          id: 7,
          branchSubPosts: [
            { targetSubPostId: "42", parentId: 7 },
          ],
        },
      ],
      subPostId: 42,
    })).toBe(7);
  });

  it("uses the target itself for top-level or unavailable sub-posts", () => {
    expect(resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors: [{ id: 42 }],
      subPostId: 42,
    })).toBe(42);

    expect(resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors: [],
      subPostId: 99,
    })).toBe(99);

    expect(resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors: [],
      subPostId: 0,
    })).toBe(0);
  });

  it("uses the target itself when a matched node has a malformed parent id", () => {
    expect(resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors: [
        {
          id: 7,
          branchSubPosts: [
            { id: 42, parentId: "-7" },
          ],
        },
      ],
      subPostId: 42,
    })).toBe(42);

    expect(resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors: [
        {
          id: 7,
          branchSubPosts: [
            { id: 42, parentId: "7.5" },
          ],
        },
      ],
      subPostId: 42,
    })).toBe(42);
  });
});

describe("resolveTargetSubPostNavigationState", () => {
  it("returns the matched target sub-post node", () => {
    const targetNode = { id: 42, parentId: 7 };

    expect(resolveTargetSubPostNavigationState({
      routeType: "post",
      targetSubPostId: 42,
      orderedSubPostFloors: [{ id: 1 }, targetNode],
      loadingSubPosts: false,
      loadingMoreSubPosts: false,
      subPostsHasMore: false,
    })).toEqual({
      targetSubPostId: 42,
      targetNode,
      shouldLoadMore: false,
      isMissing: false,
      errorMessage: "",
    });
  });

  it("requests another page when the target is not loaded yet", () => {
    expect(resolveTargetSubPostNavigationState({
      routeType: "post",
      targetSubPostId: 42,
      orderedSubPostFloors: [{ id: 1 }],
      loadingSubPosts: false,
      loadingMoreSubPosts: false,
      subPostsHasMore: true,
    })).toMatchObject({
      targetSubPostId: 42,
      targetNode: null,
      shouldLoadMore: true,
      isMissing: false,
    });
  });

  it("does not request more pages when the target is already loaded in a branch", () => {
    const branchNode = { id: 42, parentId: 7 };

    expect(resolveTargetSubPostNavigationState({
      routeType: "post",
      targetSubPostId: 42,
      orderedSubPostFloors: [
        {
          id: 7,
          branchSubPosts: [branchNode],
        },
      ],
      loadingSubPosts: false,
      loadingMoreSubPosts: false,
      subPostsHasMore: true,
    })).toEqual({
      targetSubPostId: 42,
      targetNode: branchNode,
      shouldLoadMore: false,
      isMissing: false,
      errorMessage: "",
    });
  });

  it("does not request more pages when a loaded branch only exposes targetSubPostId", () => {
    const branchNode = { targetSubPostId: "42", parentId: 7 };

    expect(resolveTargetSubPostNavigationState({
      routeType: "post",
      targetSubPostId: 42,
      orderedSubPostFloors: [
        {
          id: 7,
          branchSubPosts: [branchNode],
        },
      ],
      loadingSubPosts: false,
      loadingMoreSubPosts: false,
      subPostsHasMore: true,
    })).toEqual({
      targetSubPostId: 42,
      targetNode: branchNode,
      shouldLoadMore: false,
      isMissing: false,
      errorMessage: "",
    });
  });

  it("marks the target missing only after loading is idle and pagination is exhausted", () => {
    expect(resolveTargetSubPostNavigationState({
      routeType: "post",
      targetSubPostId: 42,
      orderedSubPostFloors: [{ id: 1 }],
      loadingSubPosts: false,
      loadingMoreSubPosts: false,
      subPostsHasMore: false,
    })).toMatchObject({
      targetSubPostId: 42,
      targetNode: null,
      shouldLoadMore: false,
      isMissing: true,
    });

    expect(resolveTargetSubPostNavigationState({
      routeType: "post",
      targetSubPostId: 42,
      orderedSubPostFloors: [{ id: 1 }],
      loadingSubPosts: true,
      loadingMoreSubPosts: false,
      subPostsHasMore: false,
    }).isMissing).toBe(false);
  });

  it("reports target location errors instead of leaving stale loading state", () => {
    expect(resolveTargetSubPostNavigationState({
      routeType: "post",
      targetSubPostId: 42,
      orderedSubPostFloors: [{ id: 1 }],
      loadingSubPosts: false,
      loadingMoreSubPosts: false,
      subPostsHasMore: true,
      loadingMoreSubPostsError: "更多子帖加载失败，请稍后重试。",
    })).toMatchObject({
      targetSubPostId: 42,
      targetNode: null,
      shouldLoadMore: false,
      isMissing: false,
      errorMessage: "更多子帖加载失败，请稍后重试。",
    });
  });
});

describe("buildTargetSubPostPageRequestKey", () => {
  it("builds a stable pagination request key for target sub-post lookup", () => {
    expect(buildTargetSubPostPageRequestKey({
      mainPostId: 7,
      targetSubPostId: 42,
      subPostCursor: "cursor-2",
      orderedSubPostFloors: [{ id: 1 }, { id: 2 }],
    })).toBe("7:42:cursor-2:2");
  });

  it("refuses unusable target ids", () => {
    expect(buildTargetSubPostPageRequestKey({
      mainPostId: 7,
      targetSubPostId: 0,
      subPostCursor: "cursor-2",
      orderedSubPostFloors: [{ id: 1 }],
    })).toBe("");
  });
});

describe("shouldRequestTargetSubPostPage", () => {
  it("requests only new target lookup pages when loading is available", () => {
    expect(shouldRequestTargetSubPostPage({
      previousRequestKey: "7:42:cursor-1:1",
      requestKey: "7:42:cursor-2:2",
      canLoadMore: true,
    })).toBe(true);

    expect(shouldRequestTargetSubPostPage({
      previousRequestKey: "7:42:cursor-2:2",
      requestKey: "7:42:cursor-2:2",
      canLoadMore: true,
    })).toBe(false);
  });

  it("does not mark a target page as requested when the loader is unavailable", () => {
    expect(shouldRequestTargetSubPostPage({
      previousRequestKey: "",
      requestKey: "7:42:cursor-2:2",
      canLoadMore: false,
    })).toBe(false);
  });
});

describe("buildTargetSubPostStatus", () => {
  it("builds a clear loading status for target sub-post deep links", () => {
    expect(buildTargetSubPostStatus({
      targetState: {
        targetSubPostId: 42,
        shouldLoadMore: true,
      },
    })).toEqual({
      kind: "loading",
      message: "正在定位目标子帖...",
      description: "系统会继续加载后续讨论，找到后会自动滚动到对应位置。",
    });
  });

  it("keeps target location retry visible as loading while a retry request is in flight", () => {
    expect(buildTargetSubPostStatus({
      targetState: {
        targetSubPostId: 42,
        targetNode: null,
        isLoading: true,
        shouldLoadMore: false,
      },
    })).toEqual({
      kind: "loading",
      message: "正在定位目标子帖...",
      description: "系统会继续加载后续讨论，找到后会自动滚动到对应位置。",
    });
  });

  it("builds a success status after the target sub-post is located", () => {
    expect(buildTargetSubPostStatus({
      targetState: {
        targetSubPostId: 42,
        targetNode: {
          id: 42,
          author: "@alice",
          content: "目标子帖",
        },
      },
    })).toEqual({
      kind: "located",
      targetSubPostId: 42,
      message: "已定位到目标子帖。",
      description: "目标子帖已标记显示，可以继续查看上下文讨论。",
      targetAuthor: "alice",
      targetPreview: "目标子帖",
      actionLabel: "回到目标子帖",
      copyActionLabel: "复制定位链接",
      retryAction: "scrollToTarget",
    });
  });

  it("builds a retryable status for target location errors", () => {
    expect(buildTargetSubPostStatus({
      targetState: {
        targetSubPostId: 42,
        errorMessage: "更多子帖加载失败，请稍后重试。",
      },
      subPostsError: "",
    })).toEqual({
      kind: "error",
      message: "更多子帖加载失败，请稍后重试。",
      description: "目标子帖暂时没有定位成功，主帖内容仍可继续阅读。",
      actionLabel: "重试定位",
      retryAction: "loadMore",
    });

    expect(buildTargetSubPostStatus({
      targetState: {
        targetSubPostId: 42,
        errorMessage: "子帖加载失败，请稍后重试。",
      },
      subPostsError: "子帖加载失败，请稍后重试。",
    }).retryAction).toBe("reload");
  });

  it("builds a graceful missing status without hiding the main post", () => {
    expect(buildTargetSubPostStatus({
      targetState: {
        targetSubPostId: 42,
        isMissing: true,
      },
      unavailableMessage: "未找到这条子帖，可能已被删除或暂不可见。",
    })).toEqual({
      kind: "missing",
      message: "未找到这条子帖，可能已被删除或暂不可见。",
      description: "这条分享定位已失效，主帖内容仍可继续阅读。",
      actionLabel: "查看主帖",
      retryAction: "clearTarget",
    });
  });

  it("does not build a status when there is no target sub-post", () => {
    expect(buildTargetSubPostStatus({
      targetState: {
        targetSubPostId: 0,
      },
    })).toBeNull();
  });
});

describe("buildTargetSubPostLocatedPreview", () => {
  it("strips visible @ prefixes from the target author", () => {
    expect(buildTargetSubPostLocatedPreview({
      author: "@@alice",
      content: "目标子帖",
    })).toEqual({
      author: "alice",
      preview: "目标子帖",
    });
  });

  it("uses authorUsername and preview field fallbacks across payload shapes", () => {
    expect(buildTargetSubPostLocatedPreview({
      authorUsername: "bob",
      preview: "来自 preview 的摘要",
    })).toEqual({
      author: "bob",
      preview: "来自 preview 的摘要",
    });

    expect(buildTargetSubPostLocatedPreview({
      subPostPreview: "来自 subPostPreview 的摘要",
    })).toEqual({
      author: "",
      preview: "来自 subPostPreview 的摘要",
    });
  });

  it("uses media summaries when located target sub-posts have no text", () => {
    expect(buildTargetSubPostLocatedPreview({
      author: "alice",
      content: "",
      mediaAssets: [{ id: 1 }, { id: 2 }],
    })).toEqual({
      author: "alice",
      preview: "2张图",
    });
  });

  it("compacts long target previews for the status bar", () => {
    expect(buildTargetSubPostLocatedPreview({
      content: "x".repeat(80),
    }).preview).toBe(`${"x".repeat(71)}…`);
  });
});

describe("buildSubPostSharePost", () => {
  it("uses the sub-post content as the share summary while preserving the main post id", () => {
    expect(buildSubPostSharePost({
      mainPost: {
        id: 42,
        title: "主帖标题",
        preview: "主帖摘要",
      },
      subPost: {
        id: 7,
        author: "@alice",
        content: "这条子帖更适合直接转发。",
      },
    })).toMatchObject({
      id: 42,
      title: "主帖标题 · @alice 的子帖",
      preview: "这条子帖更适合直接转发。",
      content: "这条子帖更适合直接转发。",
      shareTargetAuthor: "alice",
      shareTargetPreview: "这条子帖更适合直接转发。",
    });
  });

  it("builds author-aware sub-post share titles across payload shapes", () => {
    expect(buildSubPostSharePost({
      mainPost: {
        id: 42,
        title: "主帖标题",
      },
      subPost: {
        id: 7,
        authorUsername: "bob",
        content: "子帖正文",
      },
    })).toMatchObject({
      title: "主帖标题 · @bob 的子帖",
      preview: "子帖正文",
    });

    expect(buildSubPostSharePost({
      mainPost: {
        id: 42,
        title: "",
      },
      subPost: {
        id: 7,
        authorUsername: "bob",
        content: "子帖正文",
      },
    })).toMatchObject({
      title: "MemeSee @bob 的子帖",
    });

    expect(buildSubPostSharePost({
      mainPost: {
        id: 42,
        title: "主帖标题",
      },
      subPost: {
        id: 7,
        content: "子帖正文",
      },
    })).toMatchObject({
      title: "主帖标题 · 子帖",
    });
  });

  it("uses media-only summaries in sub-post share payloads", () => {
    expect(buildSubPostSharePost({
      mainPost: {
        id: 42,
        title: "主帖标题",
        preview: "主帖摘要",
      },
      subPost: {
        id: 7,
        author: "alice",
        content: "",
        mediaAssets: [{ id: 99 }],
      },
    })).toMatchObject({
      title: "主帖标题 · @alice 的子帖",
      preview: "1张图",
      content: "1张图",
    });
  });

  it("does not build a share payload without a usable main post", () => {
    expect(buildSubPostSharePost({
      mainPost: null,
      subPost: {
        id: 7,
        content: "孤立子帖",
      },
    })).toBeNull();
  });
});
