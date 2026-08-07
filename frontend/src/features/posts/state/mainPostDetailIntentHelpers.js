import { normalizeMainPostId } from "./mainPostIdentityHelpers";

export function buildNoopMainPostDetailIntent() {
  return {
    type: "none",
    mainPostId: null,
  };
}

export function buildSyncCurrentMainPostDetailIntent(mainPostId) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  if (!normalizedMainPostId) {
    return buildNoopMainPostDetailIntent();
  }
  return {
    type: "sync_current_detail",
    mainPostId: normalizedMainPostId,
  };
}

export function buildClearCurrentMainPostDetailIntent(mainPostId) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  if (!normalizedMainPostId) {
    return buildNoopMainPostDetailIntent();
  }
  return {
    type: "clear_current_detail",
    mainPostId: normalizedMainPostId,
  };
}

export function buildReloadCurrentMainPostDetailIntent(mainPostId) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  if (!normalizedMainPostId) {
    return buildNoopMainPostDetailIntent();
  }
  return {
    type: "reload_current_detail",
    mainPostId: normalizedMainPostId,
  };
}

export function buildReloadCurrentMainPostThreadIntent(mainPostId) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  if (!normalizedMainPostId) {
    return buildNoopMainPostDetailIntent();
  }
  return {
    type: "reload_current_thread",
    mainPostId: normalizedMainPostId,
  };
}

export function buildMainPostDetailIntentExecutionContext({
  detailIntent,
  currentDetailPostId,
  setPostDetail,
  setSubPosts,
  buildNextDetail,
  loadPostDetail,
  reloadCurrentPostDetail,
  reloadCurrentPostThread,
  updatePostDetailCache,
} = {}) {
  return {
    intent: detailIntent,
    currentDetailPostId,
    setPostDetail,
    setSubPosts,
    buildNextDetail,
    loadPostDetail,
    reloadCurrentPostDetail,
    reloadCurrentPostThread,
    updatePostDetailCache,
  };
}

export function shouldExecuteMainPostDetailIntent(intent, currentDetailPostId) {
  const normalizedCurrentDetailPostId = normalizeMainPostId(currentDetailPostId);
  const normalizedIntentMainPostId = normalizeMainPostId(intent?.mainPostId);

  if (!normalizedCurrentDetailPostId || !normalizedIntentMainPostId) {
    return false;
  }

  if (normalizedCurrentDetailPostId !== normalizedIntentMainPostId) {
    return false;
  }

  return [
    "sync_current_detail",
    "clear_current_detail",
    "reload_current_detail",
    "reload_current_thread",
  ].includes(intent?.type);
}

export async function executeMainPostDetailIntent({
  intent,
  currentDetailPostId,
  setPostDetail,
  setSubPosts,
  buildNextDetail,
  loadPostDetail,
  reloadCurrentPostDetail,
  reloadCurrentPostThread,
  updatePostDetailCache,
}) {
  const shouldExecuteCurrentDetailIntent =
    shouldExecuteMainPostDetailIntent(intent, currentDetailPostId);

  if (!intent?.type || intent.type === "none") {
    return false;
  }

  if (intent.type === "sync_current_detail") {
    if (typeof buildNextDetail !== "function") {
      return false;
    }
    updatePostDetailCache?.(intent.mainPostId, buildNextDetail);
    if (shouldExecuteCurrentDetailIntent && typeof setPostDetail === "function") {
      setPostDetail((prev) => buildNextDetail(prev));
    }
    return true;
  }

  if (intent.type === "clear_current_detail") {
    const canClearCurrentDetail =
      shouldExecuteCurrentDetailIntent && typeof setPostDetail === "function";
    updatePostDetailCache?.(intent.mainPostId, () => null);
    if (canClearCurrentDetail) {
      setPostDetail(null);
      if (typeof setSubPosts === "function") {
        setSubPosts([]);
      }
    }
    return Boolean(updatePostDetailCache || canClearCurrentDetail);
  }

  if (
    typeof setPostDetail !== "function" ||
    !shouldExecuteCurrentDetailIntent
  ) {
    return false;
  }

  if (intent.type === "reload_current_detail") {
    if (typeof reloadCurrentPostDetail === "function") {
      await reloadCurrentPostDetail();
      return true;
    }
    if (typeof loadPostDetail !== "function") {
      return false;
    }
    const nextPostDetail = await loadPostDetail(intent.mainPostId);
    setPostDetail(nextPostDetail);
    return true;
  }

  if (intent.type === "reload_current_thread") {
    if (typeof reloadCurrentPostThread !== "function") {
      return false;
    }
    await reloadCurrentPostThread();
    return true;
  }

  return false;
}
