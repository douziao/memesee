import { useCallback, useEffect, useRef } from "react";
import {
  toggleMainPostFavorite as toggleContentMainPostFavorite,
  toggleMainPostLike as toggleContentMainPostLike,
} from "../../content/api/contentApi";
import { buildMainPostEngagementMutationStrategy } from "../state/mainPostMutationStrategyHelpers";
import {
  resolveNextEngagementActive,
  resolveNextEngagementCount,
  resolveNextEngagementScore,
} from "../state/engagementResponseHelpers";
import {
  buildEngagementRequestKey,
  shouldApplyLatestEngagementRequestResult,
} from "../state/engagementRequestGuards";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";
import { notifyAuthRequired } from "../../../shared/state/authInteractionHelpers";
import { resolveMainPostId } from "../state/mainPostIdentityHelpers";

export function buildMainPostEngagementRequestKey({ mainPostId, action } = {}) {
  return buildEngagementRequestKey({ targetId: mainPostId, action });
}

export const shouldApplyMainPostEngagementRequestResult =
  shouldApplyLatestEngagementRequestResult;

export function resolveMainPostEngagementTargetAuthor(mainPostId, selectedPost, posts) {
  const targetPostId = Number(mainPostId || 0);
  if (!Number.isInteger(targetPostId) || targetPostId <= 0) {
    return "";
  }
  if (resolveMainPostId(selectedPost) === targetPostId) {
    return selectedPost?.author || "";
  }
  return (Array.isArray(posts) ? posts : [])
    .find((post) => resolveMainPostId(post) === targetPostId)
    ?.author || "";
}

export function useMainPostEngagement({
  route,
  isLoggedIn,
  token,
  client,
  setMessage,
  onAuthRequired,
  syncUserProgressFromPayload,
  onMainPostInteractionSynced,
  feedQueryRuntime,
  detailQueryRuntime,
  mainPostMutationInterface,
}) {
  const selectedPost = detailQueryRuntime?.selectedPost;
  const selectedPostId = resolveMainPostId(selectedPost);
  const posts = Array.isArray(feedQueryRuntime?.posts) ? feedQueryRuntime.posts : [];
  const feedSortMode = feedQueryRuntime?.feedSortMode;
  const mainPostEngagementRequestIdsRef = useRef(new Map());

  function beginMainPostEngagementRequest({ mainPostId, action }) {
    const requestKey = buildMainPostEngagementRequestKey({ mainPostId, action });
    if (!requestKey) {
      return { requestKey: "", requestId: 0 };
    }
    const requestId = Number(mainPostEngagementRequestIdsRef.current.get(requestKey) || 0) + 1;
    mainPostEngagementRequestIdsRef.current.set(requestKey, requestId);
    return { requestKey, requestId };
  }

  function shouldApplyMainPostEngagementResult(request) {
    return shouldApplyMainPostEngagementRequestResult({
      ...request,
      latestRequestIds: mainPostEngagementRequestIdsRef.current,
    });
  }

  function getCurrentMainPostCount(mainPostId, countKey) {
    const currentPost = getCurrentMainPost(mainPostId);
    return currentPost?.[countKey];
  }

  function getCurrentMainPost(mainPostId) {
    if (selectedPost && selectedPostId === Number(mainPostId || 0)) {
      return selectedPost;
    }
    return posts.find((post) => resolveMainPostId(post) === Number(mainPostId || 0)) || null;
  }

  function syncProfileMainPostInteraction({
    mainPostId,
    action,
    active,
    engagementState,
  }) {
    const currentPost = getCurrentMainPost(mainPostId);
    const compactEngagementState = Object.fromEntries(
      Object.entries(engagementState || {}).filter(([, value]) => value !== undefined),
    );
    onMainPostInteractionSynced?.({
      post: {
        ...(currentPost || {}),
        id: mainPostId,
        postId: mainPostId,
        ...compactEngagementState,
      },
      action,
      active,
    });
  }

  const reportUserActivity = useCallback(async (activity, options = {}) => {
    if (!isLoggedIn || !token) {
      return null;
    }
    try {
      const response = await client.post("/api/users/activity/report", activity, {
        headers: { Authorization: `Bearer ${token}` },
      });
      syncUserProgressFromPayload(response?.data);
      return response?.data || null;
    } catch (error) {
      if (!options.silent) {
        setMessage(readableError(error, UI_MESSAGES.activitySyncFailed));
      }
      return null;
    }
  }, [client, isLoggedIn, setMessage, syncUserProgressFromPayload, token]);

  useEffect(() => {
    if (!isLoggedIn || route.type !== "post" || !selectedPostId) {
      return;
    }
    reportUserActivity(
      {
        type: "MAIN_POST_READ",
        mainPostId: selectedPostId,
        communitySlug: selectedPost.communitySlug || "",
      },
      { silent: true },
    );
  }, [
    isLoggedIn,
    reportUserActivity,
    route.type,
    selectedPost?.communitySlug,
    selectedPostId,
  ]);

  useEffect(() => {
    if (!isLoggedIn || route.type !== "post" || !selectedPostId) {
      return;
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      reportUserActivity(
        { type: "READ_SECONDS", seconds: 30, mainPostId: selectedPostId },
        { silent: true },
      );
    }, 30000);
    return () => window.clearInterval(interval);
  }, [isLoggedIn, reportUserActivity, route.type, selectedPostId]);

  async function togglePostLike(mainPostId, likedByMe) {
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    const request = beginMainPostEngagementRequest({ mainPostId, action: "like" });
    try {
      const response = await toggleContentMainPostLike(client, {
        token,
        mainPostId,
        likedByMe,
      });
      if (!shouldApplyMainPostEngagementResult(request)) {
        return;
      }
      const nextLikedByMe = resolveNextEngagementActive({
        response,
        activeKey: "likedByMe",
        wasActive: likedByMe,
      });
      const nextCount = resolveNextEngagementCount({
        response,
        countKey: "likeCount",
        currentCount: getCurrentMainPostCount(mainPostId, "likeCount"),
        wasActive: likedByMe,
        nextActive: nextLikedByMe,
      });
      const engagementState = {
        likeCount: nextCount,
        likedByMe: nextLikedByMe,
        hotScore: resolveNextEngagementScore({ response }),
      };
      const mutationStrategy = buildMainPostEngagementMutationStrategy({
        mainPostId,
        engagementState,
        feedSortMode,
      });
      await mainPostMutationInterface.executeMainPostMutationStrategy(mutationStrategy);
      if (!shouldApplyMainPostEngagementResult(request)) {
        return;
      }
      syncProfileMainPostInteraction({
        mainPostId,
        action: "like",
        active: nextLikedByMe,
        engagementState,
      });
      if (!likedByMe) {
        const targetAuthor = resolveMainPostEngagementTargetAuthor(
          mainPostId,
          selectedPost,
          posts,
        );
        await reportUserActivity(
          {
            type: "LIKE_GIVEN",
            targetUsername: targetAuthor,
          },
          { silent: true },
        );
      }
    } catch (error) {
      if (!shouldApplyMainPostEngagementResult(request)) {
        return;
      }
      setMessage(readableError(error, UI_MESSAGES.genericOperationFailed));
    }
  }

  async function togglePostFavorite(mainPostId, favoritedByMe) {
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    const request = beginMainPostEngagementRequest({ mainPostId, action: "favorite" });
    try {
      const response = await toggleContentMainPostFavorite(client, {
        token,
        mainPostId,
        favoritedByMe,
      });
      if (!shouldApplyMainPostEngagementResult(request)) {
        return;
      }
      const nextFavoritedByMe = resolveNextEngagementActive({
        response,
        activeKey: "favoritedByMe",
        wasActive: favoritedByMe,
      });
      const nextCount = resolveNextEngagementCount({
        response,
        countKey: "favoriteCount",
        currentCount: getCurrentMainPostCount(mainPostId, "favoriteCount"),
        wasActive: favoritedByMe,
        nextActive: nextFavoritedByMe,
      });
      const engagementState = {
        favoriteCount: nextCount,
        favoritedByMe: nextFavoritedByMe,
        hotScore: resolveNextEngagementScore({ response }),
      };
      const mutationStrategy = buildMainPostEngagementMutationStrategy({
        mainPostId,
        engagementState,
        feedSortMode,
      });
      await mainPostMutationInterface.executeMainPostMutationStrategy(mutationStrategy);
      if (!shouldApplyMainPostEngagementResult(request)) {
        return;
      }
      syncProfileMainPostInteraction({
        mainPostId,
        action: "favorite",
        active: nextFavoritedByMe,
        engagementState,
      });
    } catch (error) {
      if (!shouldApplyMainPostEngagementResult(request)) {
        return;
      }
      setMessage(readableError(error, UI_MESSAGES.genericOperationFailed));
    }
  }

  function handlePostReport() {
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    setMessage(UI_MESSAGES.reportUnavailable);
  }

  return {
    reportUserActivity,
    togglePostLike,
    togglePostFavorite,
    handlePostReport,
  };
}
