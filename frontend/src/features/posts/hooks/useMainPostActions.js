import { useRef, useState } from "react";
import { deleteMainPost as deleteContentMainPost } from "../../content/api/contentApi";
import { buildDeletedMainPostMutationStrategy } from "../state/mainPostMutationStrategyHelpers";
import {
  navigateToHome,
  navigateToPost,
} from "../../../shared/state/appHelpers";
import { confirmInBrowser } from "../../../shared/platform/browserDialog";
import { POST_SHARE_RESULTS } from "../../../shared/platform/postShareResults";
import { buildPostShareUrl } from "../../../shared/platform/postShareUrl";
import {
  buildSubPostSharePost,
  findSubPostNodeById,
} from "../state/subPostThreadHelpers";
import {
  beginShareRequest,
  buildMainPostShareContextKey,
  finalizeShareRequest,
  shouldApplyMainPostShareResult,
} from "../state/postShareResultGuards";
import {
  buildPostRouteInteractionContextKey,
  shouldApplyMainPostDetailActionResult as shouldApplyMainPostDetailActionRouteResult,
} from "../state/postInteractionResultGuards";
import { resolvePostShareResultMessage } from "../state/postShareResultMessages";
import { canPrefetchImages } from "../../../shared/media/ResponsiveImage";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";
import { notifyAuthRequired } from "../../../shared/state/authInteractionHelpers";
import { resolveMainPostId } from "../state/mainPostIdentityHelpers";

const MAIN_POST_PREFETCH_COOLDOWN_MS = 1200;
const MAIN_POST_PREFETCH_TRACK_LIMIT = 80;

function loadPostShareLink() {
  return import("../../../shared/platform/sharePostLink");
}

export function normalizeMainPostPrefetchId(post) {
  return resolveMainPostId(post);
}

export function shouldPrefetchMainPostDetail({
  post,
  canPrefetch = true,
  now = Date.now(),
  lastPrefetchedAt = 0,
  cooldownMs = MAIN_POST_PREFETCH_COOLDOWN_MS,
}) {
  const postId = normalizeMainPostPrefetchId(post);
  if (!postId || !canPrefetch) {
    return false;
  }
  const elapsedMs = Number(now || 0) - Number(lastPrefetchedAt || 0);
  return !lastPrefetchedAt || elapsedMs >= Number(cooldownMs || 0);
}

export function resolveMainPostShareTarget({ route, post, subPosts }) {
  const targetSubPostId = route?.type === "post"
    ? normalizeMainPostPrefetchId({ id: route.targetSubPostId })
    : 0;
  if (!targetSubPostId) {
    return {
      post,
      targetSubPostId: 0,
      sharedMessage: UI_MESSAGES.postShared,
      copiedMessage: UI_MESSAGES.postLinkCopied,
    };
  }
  const targetSubPost = findSubPostNodeById(subPosts, targetSubPostId);
  if (!targetSubPost) {
    return {
      post,
      targetSubPostId: 0,
      sharedMessage: UI_MESSAGES.postShared,
      copiedMessage: UI_MESSAGES.postLinkCopied,
    };
  }
  return {
    post: buildSubPostSharePost({
      mainPost: post,
      subPost: targetSubPost,
    }) || post,
    targetSubPostId,
    sharedMessage: UI_MESSAGES.subPostShared,
    copiedMessage: UI_MESSAGES.subPostLinkCopied,
  };
}

export function useMainPostActions({
  client,
  token,
  isLoggedIn,
  currentUser,
  route,
  detailQueryRuntime,
  feedQueryRuntime,
  editingMainPostId,
  setMessage,
  onAuthRequired,
  resetComposerForm,
  onMainPostDeleted,
  setView,
  setRoute,
  confirmComposerNavigationLeave,
  mainPostMutationInterface,
}) {
  const selectedPost = detailQueryRuntime?.selectedPost;
  const subPosts = Array.isArray(detailQueryRuntime?.subPosts)
    ? detailQueryRuntime.subPosts
    : [];
  const commitSearch = feedQueryRuntime?.commitSearch;
  const prefetchPostDetail = detailQueryRuntime?.prefetchPostDetail;
  const mainPostPrefetchAtRef = useRef(new Map());
  const mainPostShareRequestKeysRef = useRef(new Set());
  const [activeMainPostShareKeys, setActiveMainPostShareKeys] = useState(() => new Set());
  const routeRef = useRef(route);
  routeRef.current = route;

  function buildMainPostDetailActionContextKey(post) {
    return buildPostRouteInteractionContextKey({
      routeType: route?.type,
      mainPostId: resolveMainPostId(post),
    });
  }

  function shouldApplyMainPostDetailActionResult(requestContextKey, post) {
    return shouldApplyMainPostDetailActionRouteResult({
      requestContextKey,
      currentRoute: routeRef.current,
      post,
    });
  }

  function feedSortLabel(mode) {
    switch (mode) {
      case "most_views":
        return "浏览最多";
      case "most_heat":
        return "热度最高";
      case "latest_message":
      default:
        return "最新活跃";
    }
  }

  function openPostDetail(post, options = {}) {
    const postId = resolveMainPostId(post);
    if (postId && typeof detailQueryRuntime?.setPostDetail === "function") {
      detailQueryRuntime.setPostDetail({ ...post, id: postId, postId });
    }
    if (typeof detailQueryRuntime?.setSubPosts === "function") {
      detailQueryRuntime.setSubPosts([]);
    }
    navigateToPost(postId, setRoute, options);
  }

  function prefetchMainPostDetail(post) {
    const postId = normalizeMainPostPrefetchId(post);
    const now = Date.now();
    const lastPrefetchedAt = mainPostPrefetchAtRef.current.get(postId) || 0;
    if (
      shouldPrefetchMainPostDetail({
        post,
        canPrefetch: canPrefetchImages(),
        now,
        lastPrefetchedAt,
      }) &&
      typeof prefetchPostDetail === "function"
    ) {
      mainPostPrefetchAtRef.current.delete(postId);
      mainPostPrefetchAtRef.current.set(postId, now);
      while (mainPostPrefetchAtRef.current.size > MAIN_POST_PREFETCH_TRACK_LIMIT) {
        const oldestKey = mainPostPrefetchAtRef.current.keys().next().value;
        mainPostPrefetchAtRef.current.delete(oldestKey);
      }
      prefetchPostDetail(postId);
    }
  }

  function syncActiveMainPostShareKeys() {
    setActiveMainPostShareKeys(new Set(mainPostShareRequestKeysRef.current));
  }

  function isSharingPost(post) {
    const requestContextKey = buildMainPostShareContextKey({ route, post });
    return Boolean(requestContextKey && activeMainPostShareKeys.has(requestContextKey));
  }

  async function sharePost(post) {
    const origin = typeof window !== "undefined" ? window.location?.origin : "";
    const requestContextKey = buildMainPostShareContextKey({ route, post });
    const shouldDeduplicate = Boolean(requestContextKey);
    if (
      shouldDeduplicate
      && !beginShareRequest(mainPostShareRequestKeysRef.current, requestContextKey)
    ) {
      return;
    }
    if (shouldDeduplicate) {
      syncActiveMainPostShareKeys();
    }
    const shareTarget = resolveMainPostShareTarget({
      route,
      post,
      subPosts,
    });
    const url = buildPostShareUrl({
      post,
      origin,
      targetSubPostId: shareTarget.targetSubPostId,
    });
    try {
      let result = POST_SHARE_RESULTS.failed;
      try {
        const { sharePostLink } = await loadPostShareLink();
        result = await sharePostLink({
          post: shareTarget.post,
          url,
          targetSubPostId: shareTarget.targetSubPostId,
        });
      } catch {
        result = POST_SHARE_RESULTS.failed;
      }
      if (!shouldApplyMainPostShareResult({
        requestContextKey,
        currentRoute: routeRef.current,
        post,
      })) {
        return;
      }
      const shareMessage = resolvePostShareResultMessage(result, {
        sharedMessage: shareTarget.sharedMessage,
        copiedMessage: shareTarget.copiedMessage,
      });
      if (shareMessage) {
        setMessage(shareMessage);
      }
    } finally {
      if (shouldDeduplicate) {
        finalizeShareRequest(mainPostShareRequestKeysRef.current, requestContextKey);
        syncActiveMainPostShareKeys();
      }
    }
  }

  async function deletePost(post) {
    const postId = resolveMainPostId(post);
    if (!post || !postId) {
      return;
    }
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    if (post.author !== currentUser) {
      setMessage(UI_MESSAGES.onlyAuthorCanDelete);
      return;
    }
    const requestContextKey = buildMainPostDetailActionContextKey(post);
    const confirmed = await confirmInBrowser(
      "确定要删除主帖《" +
      post.title +
      "》吗？此操作无法撤销。",
      {
        title: "删除主帖",
        confirmLabel: "删除",
        variant: "danger",
      },
    );
    if (!confirmed) {
      return;
    }
    if (!shouldApplyMainPostDetailActionResult(requestContextKey, post)) {
      return;
    }
    try {
      await deleteContentMainPost(client, {
          token,
          mainPostId: postId,
      });
      if (!shouldApplyMainPostDetailActionResult(requestContextKey, post)) {
        return;
      }
      detailQueryRuntime?.markDeletedPost?.(postId);
      const mutationStrategy = buildDeletedMainPostMutationStrategy({
        route,
        selectedPostId: resolveMainPostId(selectedPost),
        editingMainPostId,
        deletedPostId: postId,
      });
      await mainPostMutationInterface.executeMainPostMutationStrategyWithFollowUp(
        mutationStrategy,
        {
          navigateHome: () => navigateToHome(setRoute),
          resetComposerForm,
        },
      );
      onMainPostDeleted?.(postId);
      setMessage(UI_MESSAGES.mainPostDeleted);
    } catch (error) {
      if (!shouldApplyMainPostDetailActionResult(requestContextKey, post)) {
        return;
      }
      setMessage(readableError(error, UI_MESSAGES.mainPostDeleteFailed));
    }
  }

  async function applySearch() {
    if (route.type === "compose" && typeof confirmComposerNavigationLeave === "function") {
      const shouldLeave = await confirmComposerNavigationLeave();
      if (!shouldLeave) {
        return;
      }
    }
    commitSearch?.();
    setView("latest");
    navigateToHome(setRoute);
  }
  return {
    feedSortLabel,
    openPostDetail,
    prefetchMainPostDetail,
    sharePost,
    isSharingPost,
    deletePost,
    applySearch,
  };
}
