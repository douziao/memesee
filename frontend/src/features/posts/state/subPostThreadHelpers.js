import { formatTime } from "../../../shared/state/appHelpers";
import {
  buildSubPostSummaryText,
  compactPostSummaryText,
} from "../../../shared/platform/postSummaryText";
import { normalizeMainPostId } from "./mainPostIdentityHelpers";
import { mergeMainPostState } from "./mainPostStateHelpers";

const TARGET_SUB_POST_STATUS_PREVIEW_MAX_LENGTH = 72;

export const resolveSubPostId = (subPost) =>
  normalizeMainPostId(subPost?.id)
  || normalizeMainPostId(subPost?.subPostId)
  || normalizeMainPostId(subPost?.targetSubPostId);

function compareSubPostsByTimeAsc(a, b) {
  const timeGap = (Date.parse(a?.createdAt) || 0) - (Date.parse(b?.createdAt) || 0);
  if (timeGap !== 0) {
    return timeGap;
  }
  const aId = resolveSubPostId(a);
  const bId = resolveSubPostId(b);
  if (aId && bId && aId !== bId) {
    return aId - bId;
  }
  return String(a?.id || a?.subPostId || a?.targetSubPostId || "").localeCompare(
    String(b?.id || b?.subPostId || b?.targetSubPostId || ""),
  );
}

export function buildSubPostThreadNodeMap(subPosts) {
  const posts = Array.isArray(subPosts) ? subPosts : [];
  if (posts.length === 0) {
    return new Map();
  }

  const map = new Map(
    posts.map((subPost) => [
      resolveSubPostId(subPost) || subPost.id,
      {
        ...subPost,
        branchSubPosts: [],
        targetSubPostAuthor: null,
        targetSubPostAuthorUsername: "",
        targetSubPostPreview: "",
        targetSubPostDeleted: false,
      },
    ]),
  );

  posts.forEach((subPost) => {
    const subPostId = resolveSubPostId(subPost) || subPost.id;
    const node = map.get(subPostId);
    if (!node) {
      return;
    }
    const parentId = normalizeMainPostId(subPost.parentId);
    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId);
      const parentAuthor = parent.author || parent.authorUsername || "";
      node.targetSubPostAuthor = parentAuthor;
      node.targetSubPostAuthorUsername = parentAuthor;
      node.targetSubPostPreview = buildSubPostSummaryText({ subPost: parent });
      parent.branchSubPosts.push(node);
      return;
    }
    if (parentId) {
      const parentAuthor =
        subPost.parentSubPostAuthor || subPost.parentSubPostAuthorUsername || "";
      node.targetSubPostAuthor = parentAuthor;
      node.targetSubPostAuthorUsername = parentAuthor;
      node.targetSubPostDeleted = true;
      node.targetSubPostPreview = "该子帖已删除。";
    }
  });

  map.forEach((node) => {
    if (Array.isArray(node.branchSubPosts) && node.branchSubPosts.length > 0) {
      node.branchSubPosts.sort(compareSubPostsByTimeAsc);
    }
  });

  return map;
}

export function buildOrderedSubPostFloors(subPostNodeMap) {
  if (!(subPostNodeMap instanceof Map)) {
    return [];
  }
  return Array.from(subPostNodeMap.values()).sort(compareSubPostsByTimeAsc);
}

export function buildCollapsedSubPostBranches(prevState, orderedSubPostFloors) {
  const previous = prevState && typeof prevState === "object" ? prevState : {};
  const floors = Array.isArray(orderedSubPostFloors) ? orderedSubPostFloors : [];

  if (floors.length === 0) {
    return {};
  }

  const next = {};
  floors.forEach((subPost) => {
    const subPostId = resolveSubPostId(subPost) || subPost.id;
    const branchSubPosts = Array.isArray(subPost.branchSubPosts)
      ? subPost.branchSubPosts
      : [];
    if (branchSubPosts.length > 0) {
      next[subPostId] = Object.prototype.hasOwnProperty.call(previous, subPostId)
        ? Boolean(previous[subPostId])
        : true;
    }
  });

  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  const isSame =
    previousKeys.length === nextKeys.length &&
    previousKeys.every((key) => previous[key] === next[key]);

  return isSame ? previous : next;
}

export function updateSubPostInteraction(subPosts, subPostId, patch) {
  const targetId = Number(subPostId || 0);
  return (Array.isArray(subPosts) ? subPosts : []).map((subPost) =>
    resolveSubPostId(subPost) == targetId ? { ...subPost, ...patch } : subPost,
  );
}

export function updatePostDetailAfterSubPostCreated(postDetail, selectedPostId, latestActivityAt) {
  if (!postDetail || postDetail.id != selectedPostId) {
    return postDetail;
  }
  return mergeMainPostState(
    postDetail,
    {
      subPostCount: Number(postDetail.subPostCount || 0) + 1,
      latestActivityAt,
      latestActivityAtText: formatTime(latestActivityAt),
    },
    { recalculateHotScore: true },
  );
}

export function updatePostDetailAfterSubPostDeleted(postDetail, selectedPostId) {
  if (!postDetail || postDetail.id != selectedPostId) {
    return postDetail;
  }
  return mergeMainPostState(
    postDetail,
    {
      subPostCount: Math.max(0, Number(postDetail.subPostCount || 0) - 1),
    },
    {
      allowMetricRegression: true,
      recalculateHotScore: true,
    },
  );
}

export function toggleSubPostBranchState(prevState, subPostId) {
  return {
    ...(prevState && typeof prevState === "object" ? prevState : {}),
    [subPostId]: !prevState?.[subPostId],
  };
}

export function toggleSubPostMenuState(currentMenuId, nextMenuId) {
  return currentMenuId === nextMenuId ? "" : nextMenuId;
}

export function buildSubPostSharePost({ mainPost, subPost }) {
  if (!mainPost?.id) {
    return null;
  }
  const subPostText = buildSubPostSummaryText({ subPost });
  const subPostAuthor = String(subPost?.author || subPost?.authorUsername || "")
    .trim()
    .replace(/^@+/, "");
  const mainTitle = String(mainPost.title || "").trim();
  const subPostTitle = subPostAuthor ? `@${subPostAuthor} 的子帖` : "子帖";
  return {
    ...mainPost,
    title: mainTitle ? `${mainTitle} · ${subPostTitle}` : `MemeSee ${subPostTitle}`,
    ...(subPostText
      ? {
        preview: subPostText,
        content: subPostText,
        shareTargetPreview: subPostText,
      }
      : {}),
    ...(subPostAuthor ? { shareTargetAuthor: subPostAuthor } : {}),
  };
}

export function buildTargetSubPostLocatedPreview(targetNode) {
  const author = String(targetNode?.author || targetNode?.authorUsername || "")
    .trim()
    .replace(/^@+/, "");
  const preview = buildSubPostSummaryText({
    subPost: targetNode,
    maxLength: TARGET_SUB_POST_STATUS_PREVIEW_MAX_LENGTH,
  });
  return {
    author,
    preview,
  };
}

export function findSubPostNodeById(subPostNodes, targetSubPostId) {
  const normalizedTargetSubPostId = Number(targetSubPostId || 0);
  if (!Number.isInteger(normalizedTargetSubPostId) || normalizedTargetSubPostId <= 0) {
    return null;
  }
  const pending = Array.isArray(subPostNodes) ? [...subPostNodes] : [];
  const visited = new Set();
  while (pending.length > 0) {
    const node = pending.shift();
    const nodeId = resolveSubPostId(node);
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    if (nodeId === normalizedTargetSubPostId) {
      return node;
    }
    const branchSubPosts = Array.isArray(node?.branchSubPosts)
      ? node.branchSubPosts
      : [];
    pending.push(...branchSubPosts);
  }
  return null;
}

export function resolveSubPostJumpBranchAnchorId({ orderedSubPostFloors, subPostId } = {}) {
  const normalizedId = normalizeMainPostId(subPostId);
  if (!normalizedId) {
    return 0;
  }
  const targetNode = findSubPostNodeById(orderedSubPostFloors, normalizedId);
  return normalizeMainPostId(targetNode?.parentId) || normalizedId;
}

export function resolveTargetSubPostNavigationState({
  routeType,
  targetSubPostId,
  orderedSubPostFloors,
  loadingSubPosts,
  loadingMoreSubPosts,
  subPostsHasMore,
  subPostsError,
  loadingMoreSubPostsError,
}) {
  const normalizedTargetSubPostId = Number(targetSubPostId || 0);
  if (
    routeType !== "post" ||
    !Number.isInteger(normalizedTargetSubPostId) ||
    normalizedTargetSubPostId <= 0
  ) {
    return {
      targetSubPostId: 0,
      targetNode: null,
      shouldLoadMore: false,
      isMissing: false,
      errorMessage: "",
    };
  }
  const floors = Array.isArray(orderedSubPostFloors) ? orderedSubPostFloors : [];
  const targetNode = findSubPostNodeById(floors, normalizedTargetSubPostId);
  const isBusy = Boolean(loadingSubPosts || loadingMoreSubPosts);
  const errorMessage = String(subPostsError || loadingMoreSubPostsError || "").trim();
  const hasError = Boolean(errorMessage);
  return {
    targetSubPostId: normalizedTargetSubPostId,
    targetNode,
    shouldLoadMore: !targetNode && !isBusy && !hasError && Boolean(subPostsHasMore),
    isMissing: !targetNode && !isBusy && !hasError && !subPostsHasMore,
    errorMessage: !targetNode && !isBusy ? errorMessage : "",
  };
}

export function buildTargetSubPostPageRequestKey({
  mainPostId,
  targetSubPostId,
  subPostCursor,
  orderedSubPostFloors,
}) {
  const normalizedTargetSubPostId = Number(targetSubPostId || 0);
  if (!Number.isInteger(normalizedTargetSubPostId) || normalizedTargetSubPostId <= 0) {
    return "";
  }
  const loadedFloorCount = Array.isArray(orderedSubPostFloors)
    ? orderedSubPostFloors.length
    : 0;
  return [
    String(mainPostId || ""),
    String(normalizedTargetSubPostId),
    String(subPostCursor || ""),
    String(loadedFloorCount),
  ].join(":");
}

export function shouldRequestTargetSubPostPage({
  previousRequestKey,
  requestKey,
  canLoadMore,
}) {
  return Boolean(canLoadMore && requestKey && previousRequestKey !== requestKey);
}

export function buildTargetSubPostStatus({
  targetState,
  subPostsError,
  unavailableMessage = "未找到这条子帖，可能已被删除或暂不可见。",
} = {}) {
  if (!targetState?.targetSubPostId) {
    return null;
  }

  if (targetState.errorMessage) {
    return {
      kind: "error",
      message: targetState.errorMessage || "分享子帖定位失败。",
      description: "目标子帖暂时没有定位成功，主帖内容仍可继续阅读。",
      actionLabel: "重试定位",
      retryAction: subPostsError ? "reload" : "loadMore",
    };
  }

  if (targetState.targetNode) {
    const locatedPreview = buildTargetSubPostLocatedPreview(targetState.targetNode);
    return {
      kind: "located",
      targetSubPostId: targetState.targetSubPostId,
      message: "已定位到目标子帖。",
      description: "目标子帖已标记显示，可以继续查看上下文讨论。",
      targetAuthor: locatedPreview.author,
      targetPreview: locatedPreview.preview,
      actionLabel: "回到目标子帖",
      copyActionLabel: "复制定位链接",
      retryAction: "scrollToTarget",
    };
  }

  if (targetState.isLoading || targetState.shouldLoadMore) {
    return {
      kind: "loading",
      message: "正在定位目标子帖...",
      description: "系统会继续加载后续讨论，找到后会自动滚动到对应位置。",
    };
  }

  if (targetState.isMissing) {
    return {
      kind: "missing",
      message: unavailableMessage,
      description: "这条分享定位已失效，主帖内容仍可继续阅读。",
      actionLabel: "查看主帖",
      retryAction: "clearTarget",
    };
  }

  return null;
}

const subPostFloorHighlightTimers = new Map();

export function calculateSubPostFloorScrollTop({
  scrollY,
  targetTop,
  topbarHeight,
  safeGap = 12,
}) {
  const safeScrollY = Number.isFinite(Number(scrollY)) ? Number(scrollY) : 0;
  const safeTargetTop = Number.isFinite(Number(targetTop)) ? Number(targetTop) : 0;
  const safeTopbarHeight = Math.max(
    0,
    Number.isFinite(Number(topbarHeight)) ? Number(topbarHeight) : 0,
  );
  const safeGapValue = Math.max(
    0,
    Number.isFinite(Number(safeGap)) ? Number(safeGap) : 0,
  );
  return Math.max(0, safeScrollY + safeTargetTop - safeTopbarHeight - safeGapValue);
}

export function highlightSubPostFloor(subPostId, durationMs = 2200) {
  const normalizedId = Number(subPostId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return false;
  }
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }
  const target = document.getElementById(`sub-post-floor-${normalizedId}`);
  if (!target) {
    return false;
  }
  const className = "is-target-highlight";
  const existingTimer = subPostFloorHighlightTimers.get(normalizedId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
  const timerId = window.setTimeout(() => {
    target.classList.remove(className);
    subPostFloorHighlightTimers.delete(normalizedId);
  }, Math.max(0, Number(durationMs) || 0));
  subPostFloorHighlightTimers.set(normalizedId, timerId);
  return true;
}

export function scheduleSubPostFloorScroll(subPostId, topbarRef) {
  const normalizedId = Number(subPostId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const scrollWhenReady = (remainingAttempts) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`sub-post-floor-${normalizedId}`);
      if (!target) {
        if (remainingAttempts > 0) {
          scrollWhenReady(remainingAttempts - 1);
        }
        return;
      }
      const topbarHeight = topbarRef?.current?.getBoundingClientRect?.().height || 0;
      const targetTop = calculateSubPostFloorScrollTop({
        scrollY: window.scrollY,
        targetTop: target.getBoundingClientRect().top,
        topbarHeight,
      });
      window.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });
      highlightSubPostFloor(normalizedId);
    });
  };

  window.requestAnimationFrame(() => {
    scrollWhenReady(6);
  });
}
