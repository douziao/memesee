import { useEffect, useRef, useState } from "react";
import {
  createSubPost as createContentSubPost,
  deleteSubPost as deleteContentSubPost,
  toggleSubPostFavorite as toggleContentSubPostFavorite,
  toggleSubPostLike as toggleContentSubPostLike,
  getMediaAsset as getContentMediaAsset,
  uploadMediaAsset as uploadContentMediaAsset,
} from "../../content/api/contentApi";
import { normalizeSubPostPayload } from "../state/mainPostModel";
import { confirmInBrowser } from "../../../shared/platform/browserDialog";
import {
  buildCreatedSubPostMutationStrategy,
  buildDeletedSubPostMutationStrategy,
} from "../state/mainPostMutationStrategyHelpers";
import {
  buildCollapsedSubPostBranches,
  buildSubPostSharePost,
  buildTargetSubPostStatus,
  buildTargetSubPostPageRequestKey,
  resolveSubPostId,
  resolveSubPostJumpBranchAnchorId,
  resolveTargetSubPostNavigationState,
  scheduleSubPostFloorScroll,
  shouldRequestTargetSubPostPage,
  toggleSubPostBranchState,
  toggleSubPostMenuState,
  updateSubPostInteraction,
} from "../state/subPostThreadHelpers";
import {
  resolveNextEngagementActive,
  resolveNextEngagementCount,
} from "../state/engagementResponseHelpers";
import {
  buildEngagementRequestKey,
  shouldApplyLatestEngagementRequestResult,
} from "../state/engagementRequestGuards";
import { POST_SHARE_RESULTS } from "../../../shared/platform/postShareResults";
import { buildPostShareUrl } from "../../../shared/platform/postShareUrl";
import {
  buildPostRouteInteractionContextKey,
  shouldFinalizePostRouteInteractionRequest,
  shouldApplyPostRouteInteractionResult,
} from "../state/postInteractionResultGuards";
import {
  beginShareRequest,
  buildSubPostMenuShareContextKey,
  finalizeShareRequest,
  shouldApplySubPostMenuShareResult,
} from "../state/postShareResultGuards";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";
import { notifyAuthRequired } from "../../../shared/state/authInteractionHelpers";
import { resolvePostShareResultMessage } from "../state/postShareResultMessages";
import { resolveMainPostId } from "../state/mainPostIdentityHelpers";
import { navigateToPost } from "../../../shared/state/appHelpers";

export const notifySubPostAuthRequired = notifyAuthRequired;
const SUB_POST_MEDIA_LIMIT = 6;

function loadPostShareLink() {
  return import("../../../shared/platform/sharePostLink");
}

function loadClipboard() {
  return import("../../../shared/platform/clipboard");
}

function normalizeSubPostMediaAssetId(asset) {
  const assetId = Number(asset?.id || 0);
  return Number.isFinite(assetId) && assetId > 0 ? assetId : 0;
}

export function isSubPostComposerMediaAssetSubmitReady(asset) {
  return normalizeSubPostMediaAssetId(asset) > 0;
}

export function mergeSubPostComposerMediaAssets(existingAssets, uploadedAssets) {
  const merged = Array.isArray(existingAssets) ? [...existingAssets] : [];
  for (const asset of Array.isArray(uploadedAssets) ? uploadedAssets : []) {
    const assetId = normalizeSubPostMediaAssetId(asset);
    if (assetId && !merged.some((item) => normalizeSubPostMediaAssetId(item) === assetId)) {
      merged.push(asset);
    }
  }
  return merged.slice(0, SUB_POST_MEDIA_LIMIT);
}

function mergeRefreshedSubPostComposerMediaAssets(existingAssets, refreshedAssets) {
  const currentAssets = Array.isArray(existingAssets) ? existingAssets : [];
  const refreshedById = new Map();
  for (const asset of Array.isArray(refreshedAssets) ? refreshedAssets : []) {
    const assetId = normalizeSubPostMediaAssetId(asset);
    if (assetId) {
      refreshedById.set(assetId, asset);
    }
  }
  if (refreshedById.size === 0) {
    return currentAssets;
  }
  let changed = false;
  const nextAssets = currentAssets.map((asset) => {
    const assetId = normalizeSubPostMediaAssetId(asset);
    const refreshedAsset = refreshedById.get(assetId);
    if (!refreshedAsset) {
      return asset;
    }
    changed = true;
    return {
      ...asset,
      ...refreshedAsset,
    };
  });
  return changed ? nextAssets : currentAssets;
}

export function removeSubPostComposerMediaAt(mediaAssets, index) {
  if (!Array.isArray(mediaAssets) || index < 0 || index >= mediaAssets.length) {
    return Array.isArray(mediaAssets) ? mediaAssets : [];
  }
  return mediaAssets.filter((_, itemIndex) => itemIndex !== index);
}

export function buildSubPostMediaUploadStatus({
  uploading,
  imageCount = 0,
  skippedCount = 0,
  failedCount = 0,
  retryableFailedCount = 0,
  errorMessage = "",
} = {}) {
  if (uploading) {
    return {
      type: "uploading",
      message: "图片上传中...",
    };
  }
  const normalizedError = String(errorMessage || "").trim();
  if (normalizedError) {
    const status = {
      type: "error",
      message: `${normalizedError} 已上传的图片和子帖草稿仍保留。`,
    };
    const retryableCount = Number(retryableFailedCount || 0);
    if (retryableCount > 0) {
      status.canRetry = true;
    }
    return status;
  }
  const uploaded = Number(imageCount || 0);
  const skipped = Number(skippedCount || 0);
  const failed = Number(failedCount || 0);
  if (!(uploaded || skipped || failed)) {
    return { type: "" };
  }
  const summary = [];
  if (uploaded > 0) {
    summary.push(`上传 ${uploaded} 张图片`);
  }
  if (skipped > 0) {
    summary.push(`跳过 ${skipped} 个无效/超限`);
  }
  if (failed > 0) {
    summary.push(`失败 ${failed} 张`);
  }
  const status = {
    type: failed || skipped ? "warning" : "success",
    message: summary.join("，"),
  };
  if (failed > 0) {
    status.canRetry = true;
  }
  return status;
}

export function collectSubPostComposerMediaAssetIds(mediaAssets) {
  return (Array.isArray(mediaAssets) ? mediaAssets : [])
    .filter(isSubPostComposerMediaAssetSubmitReady)
    .map((asset) => normalizeSubPostMediaAssetId(asset))
    .filter(Boolean)
    .slice(0, SUB_POST_MEDIA_LIMIT);
}

export function hasSubPostComposerSubmitContent({ content, mediaAssetIds } = {}) {
  const normalizedContent = typeof content === "string" ? content.trim() : "";
  const normalizedMediaAssetIds = Array.isArray(mediaAssetIds) ? mediaAssetIds : [];
  return Boolean(
    normalizedContent
    || normalizedMediaAssetIds.some((assetId) => Number(assetId || 0) > 0),
  );
}

export function buildSubPostLocationCopyUrl({ post, origin, targetSubPostId } = {}) {
  const normalizedTargetSubPostId = resolveSubPostId({ id: targetSubPostId });
  if (!normalizedTargetSubPostId) {
    return "";
  }
  return buildPostShareUrl({
    post,
    origin,
    targetSubPostId: normalizedTargetSubPostId,
  });
}

export function buildSubPostEngagementRequestKey({ subPostId, action } = {}) {
  return buildEngagementRequestKey({ targetId: subPostId, action });
}

export const shouldApplySubPostEngagementRequestResult =
  shouldApplyLatestEngagementRequestResult;

export function useSubPostThread({
  routeType,
  mainPostId,
  routeManageSource,
  targetSubPostId,
  isLoggedIn,
  detailQueryRuntime,
  token,
  client,
  setMessage,
  setRoute,
  onAuthRequired,
  reportUserActivity,
  currentUser,
  topbarRef,
  subPostTextareaRef,
  onSubPostDeleted,
  onSubPostInteractionSynced,
  mainPostMutationInterface,
}) {
  const selectedPost = detailQueryRuntime?.selectedPost;
  const selectedPostId = resolveMainPostId(selectedPost);
  const subPosts = Array.isArray(detailQueryRuntime?.subPosts)
    ? detailQueryRuntime.subPosts
    : [];
  const setSubPosts = detailQueryRuntime?.setSubPosts;
  const orderedSubPostFloors = detailQueryRuntime?.orderedSubPostFloors;
  const loadingSubPosts = Boolean(detailQueryRuntime?.loadingSubPosts);
  const loadingMoreSubPosts = Boolean(detailQueryRuntime?.loadingMoreSubPosts);
  const subPostsHasMore = Boolean(detailQueryRuntime?.subPostsHasMore);
  const subPostsError = detailQueryRuntime?.subPostsError || "";
  const loadingMoreSubPostsError = detailQueryRuntime?.loadingMoreSubPostsError || "";
  const loadMoreSubPosts = detailQueryRuntime?.loadMoreSubPosts;
  const reloadCurrentSubPosts = detailQueryRuntime?.reloadCurrentSubPosts;
  const subPostCursor = detailQueryRuntime?.subPostCursor || "";
  const [submittingSubPost, setSubmittingSubPost] = useState(false);
  const [subPostInput, setSubPostInput] = useState("");
  const [subPostMediaAssets, setSubPostMediaAssets] = useState([]);
  const [uploadingSubPostMedia, setUploadingSubPostMedia] = useState(false);
  const [subPostMediaUploadStatus, setSubPostMediaUploadStatus] = useState({ type: "" });
  const [failedSubPostMediaUploadFiles, setFailedSubPostMediaUploadFiles] = useState([]);
  const [activeSubPostTarget, setActiveSubPostTarget] = useState(null);
  const [showTopSubPostComposer, setShowTopSubPostComposer] = useState(false);
  const [collapsedSubPostBranches, setCollapsedSubPostBranches] = useState({});
  const [subPostMoreMenuId, setSubPostMoreMenuId] = useState("");
  const [targetSubPostStatus, setTargetSubPostStatus] = useState(null);
  const handledTargetSubPostRef = useRef("");
  const requestedTargetPageRef = useRef("");
  const missingTargetMessageRef = useRef("");
  const subPostSubmitRequestRef = useRef(0);
  const subPostMediaUploadRequestRef = useRef(0);
  const subPostEngagementRequestIdsRef = useRef(new Map());
  const subPostShareRequestKeysRef = useRef(new Set());
  const routeContextRef = useRef({ routeType, mainPostId });
  routeContextRef.current = { routeType, mainPostId };

  useEffect(() => {
    setSubPostInput("");
    setSubPostMediaAssets([]);
    setUploadingSubPostMedia(false);
    setSubPostMediaUploadStatus({ type: "" });
    setFailedSubPostMediaUploadFiles([]);
    setActiveSubPostTarget(null);
    setShowTopSubPostComposer(false);
    setCollapsedSubPostBranches({});
    setSubPostMoreMenuId("");
    setTargetSubPostStatus(null);
    setSubmittingSubPost(false);
  }, [routeType, mainPostId]);

  useEffect(() => {
    handledTargetSubPostRef.current = "";
    requestedTargetPageRef.current = "";
    missingTargetMessageRef.current = "";
    setTargetSubPostStatus(null);
  }, [routeType, mainPostId, targetSubPostId]);

  useEffect(() => {
    if (!Array.isArray(orderedSubPostFloors) || orderedSubPostFloors.length === 0) {
      setCollapsedSubPostBranches({});
      return;
    }
    setCollapsedSubPostBranches((prev) =>
      buildCollapsedSubPostBranches(prev, orderedSubPostFloors),
    );
  }, [orderedSubPostFloors]);

  useEffect(() => {
    const targetState = resolveTargetSubPostNavigationState({
      routeType,
      targetSubPostId,
      orderedSubPostFloors,
      loadingSubPosts,
      loadingMoreSubPosts,
      subPostsHasMore,
      subPostsError,
      loadingMoreSubPostsError,
    });
    if (!targetState.targetSubPostId) {
      setTargetSubPostStatus(null);
      return;
    }
    const targetKey = `${mainPostId || ""}:${targetState.targetSubPostId}`;
    const nextTargetStatus = buildTargetSubPostStatus({
      targetState: {
        ...targetState,
        isLoading: !targetState.targetNode && Boolean(loadingSubPosts || loadingMoreSubPosts),
      },
      subPostsError,
      unavailableMessage: UI_MESSAGES.subPostTargetUnavailable,
    });
    if (targetState.errorMessage) {
      setTargetSubPostStatus((prev) =>
        prev?.kind === nextTargetStatus?.kind && prev.message === nextTargetStatus?.message
          ? prev
          : nextTargetStatus,
      );
      return;
    }
    if (targetState.shouldLoadMore) {
      setTargetSubPostStatus((prev) =>
        prev?.kind === nextTargetStatus?.kind && prev.message === nextTargetStatus?.message
          ? prev
          : nextTargetStatus,
      );
      const requestKey = buildTargetSubPostPageRequestKey({
        mainPostId,
        targetSubPostId: targetState.targetSubPostId,
        subPostCursor,
        orderedSubPostFloors,
      });
      if (shouldRequestTargetSubPostPage({
        previousRequestKey: requestedTargetPageRef.current,
        requestKey,
        canLoadMore: typeof loadMoreSubPosts === "function",
      })) {
        requestedTargetPageRef.current = requestKey;
        loadMoreSubPosts();
      }
      return;
    }
    if (nextTargetStatus?.kind === "loading") {
      setTargetSubPostStatus((prev) =>
        prev?.kind === nextTargetStatus.kind && prev.message === nextTargetStatus.message
          ? prev
          : nextTargetStatus,
      );
      return;
    }
    if (targetState.isMissing) {
      setTargetSubPostStatus((prev) =>
        prev?.kind === nextTargetStatus?.kind && prev.message === nextTargetStatus?.message
          ? prev
          : nextTargetStatus,
      );
      if (missingTargetMessageRef.current !== targetKey) {
        missingTargetMessageRef.current = targetKey;
        setMessage(UI_MESSAGES.subPostTargetUnavailable);
      }
      return;
    }
    const targetNode = targetState.targetNode;
    if (!targetNode) {
      return;
    }
    setTargetSubPostStatus((prev) =>
      prev?.kind === nextTargetStatus?.kind && prev.message === nextTargetStatus?.message
        ? prev
        : nextTargetStatus,
    );
    if (handledTargetSubPostRef.current === targetKey) {
      return;
    }
    handledTargetSubPostRef.current = targetKey;
    const branchAnchorId = resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors,
      subPostId: targetState.targetSubPostId,
    });
    if (branchAnchorId && branchAnchorId !== targetState.targetSubPostId) {
      setCollapsedSubPostBranches((prev) => ({
        ...(prev && typeof prev === "object" ? prev : {}),
        [branchAnchorId]: false,
      }));
    }
    scheduleSubPostFloorScroll(targetState.targetSubPostId, topbarRef);
  }, [
    loadMoreSubPosts,
    loadingMoreSubPosts,
    loadingMoreSubPostsError,
    loadingSubPosts,
    mainPostId,
    orderedSubPostFloors,
    routeType,
    setMessage,
    subPostCursor,
    subPostsError,
    subPostsHasMore,
    targetSubPostId,
    topbarRef,
  ]);

  useEffect(() => {
    if (!subPostMoreMenuId) {
      return;
    }
    const close = () => setSubPostMoreMenuId("");
    const onClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".sub-post-more-wrap")) {
        close();
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };
    const timerId = window.setTimeout(() => {
      window.addEventListener("click", onClick);
      window.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [subPostMoreMenuId]);

  function requireAuthNotice() {
    notifyAuthRequired({ setMessage, onAuthRequired });
  }

  function resetSubPostMediaDraft() {
    subPostMediaUploadRequestRef.current += 1;
    setSubPostMediaAssets([]);
    setUploadingSubPostMedia(false);
    setSubPostMediaUploadStatus({ type: "" });
    setFailedSubPostMediaUploadFiles([]);
  }

  function getCurrentSubPost(subPostId) {
    const targetId = Number(subPostId || 0);
    return subPosts.find((item) => resolveSubPostId(item) === targetId) || null;
  }

  function syncProfileSubPostAction({
    subPost,
    action,
    active,
    interactionState,
  }) {
    onSubPostInteractionSynced?.({
      subPost: {
        ...(subPost || {}),
        ...(interactionState || {}),
      },
      mainPost: selectedPost,
      action,
      active,
    });
  }

  function buildCurrentRouteInteractionContextKey() {
    return buildPostRouteInteractionContextKey({ routeType, mainPostId });
  }

  function shouldApplyCurrentRouteInteractionResult(requestContextKey) {
    return shouldApplyPostRouteInteractionResult({
      requestContextKey,
      currentRouteType: routeContextRef.current.routeType,
      currentMainPostId: routeContextRef.current.mainPostId,
    });
  }

  function beginSubPostEngagementRequest({ subPostId, action }) {
    const requestKey = buildSubPostEngagementRequestKey({ subPostId, action });
    if (!requestKey) {
      return { requestKey: "", requestId: 0 };
    }
    const requestId = Number(subPostEngagementRequestIdsRef.current.get(requestKey) || 0) + 1;
    subPostEngagementRequestIdsRef.current.set(requestKey, requestId);
    return { requestKey, requestId };
  }

  function shouldApplySubPostEngagementResult(request) {
    return shouldApplySubPostEngagementRequestResult({
      ...request,
      latestRequestIds: subPostEngagementRequestIdsRef.current,
    });
  }

  function openMainPostSubPostComposer() {
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    setActiveSubPostTarget(null);
    resetSubPostMediaDraft();
    setShowTopSubPostComposer(true);
    window.setTimeout(() => {
      subPostTextareaRef.current?.focus();
    }, 40);
  }

  function startNestedSubPostComposer(subPost, composerInstanceId = "") {
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    const subPostId = resolveSubPostId(subPost);
    setShowTopSubPostComposer(false);
    resetSubPostMediaDraft();
    setActiveSubPostTarget({
      id: subPostId,
      author: subPost.author,
      composerInstanceId,
    });
  }

  function cancelNestedSubPostComposer() {
    setActiveSubPostTarget(null);
    resetSubPostMediaDraft();
  }

  function cancelTopSubPostComposer() {
    setShowTopSubPostComposer(false);
    setSubPostInput("");
    resetSubPostMediaDraft();
  }

  function removeSubPostMediaAt(index) {
    setSubPostMediaAssets((prev) => removeSubPostComposerMediaAt(prev, index));
    setSubPostMediaUploadStatus({ type: "" });
  }

  async function uploadSubPostImageFiles(imageFiles, { skippedCount = 0 } = {}) {
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    const slots = Math.max(0, SUB_POST_MEDIA_LIMIT - subPostMediaAssets.length);
    const uploadFiles = imageFiles.slice(0, slots);
    skippedCount += Math.max(0, imageFiles.length - slots);

    if (uploadFiles.length === 0) {
      const status = buildSubPostMediaUploadStatus({ skippedCount });
      setSubPostMediaUploadStatus(status);
      setFailedSubPostMediaUploadFiles([]);
      if (status.message) {
        setMessage(status.message);
      }
      return;
    }

    setUploadingSubPostMedia(true);
    setSubPostMediaUploadStatus(buildSubPostMediaUploadStatus({ uploading: true }));
    setFailedSubPostMediaUploadFiles([]);
    const requestId = subPostMediaUploadRequestRef.current + 1;
    subPostMediaUploadRequestRef.current = requestId;
    const uploadedAssets = [];
    const failedFiles = [];
    for (const file of uploadFiles) {
      try {
        const uploadedAsset = await uploadContentMediaAsset(client, { token, file });
        if (!isSubPostComposerMediaAssetSubmitReady(uploadedAsset)) {
          throw new Error("empty media asset id");
        }
        uploadedAssets.push(uploadedAsset);
      } catch {
        failedFiles.push(file);
      }
    }
    if (requestId !== subPostMediaUploadRequestRef.current) {
      return;
    }
    if (uploadedAssets.length > 0) {
      setSubPostMediaAssets((prev) =>
        mergeSubPostComposerMediaAssets(prev, uploadedAssets),
      );
    }
    const status = buildSubPostMediaUploadStatus({
      imageCount: uploadedAssets.length,
      skippedCount,
      failedCount: failedFiles.length,
      retryableFailedCount: failedFiles.length,
    });
    setFailedSubPostMediaUploadFiles(failedFiles);
    setSubPostMediaUploadStatus(status);
    if (status.message) {
      setMessage(status.message);
    }
    if (requestId === subPostMediaUploadRequestRef.current) {
      setUploadingSubPostMedia(false);
    }
  }

  async function onSubPostMediaPicked(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    const imageFiles = [];
    let skippedCount = 0;
    for (const file of files) {
      if (String(file.type || "").startsWith("image/")) {
        imageFiles.push(file);
      } else {
        skippedCount += 1;
      }
    }
    await uploadSubPostImageFiles(imageFiles, { skippedCount });
  }

  async function retryFailedSubPostMediaUploads() {
    if (failedSubPostMediaUploadFiles.length === 0 || uploadingSubPostMedia) {
      return;
    }
    await uploadSubPostImageFiles(failedSubPostMediaUploadFiles);
  }

  async function refreshSubPostMediaAssets() {
    if (uploadingSubPostMedia) {
      return;
    }
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    const refreshableAssetIds = [];
    for (const asset of subPostMediaAssets) {
      const processingStatus = String(asset?.processingStatus || "READY").toUpperCase();
      if (processingStatus === "PROCESSING" || processingStatus === "FAILED") {
        const assetId = normalizeSubPostMediaAssetId(asset);
        if (assetId) {
          refreshableAssetIds.push(assetId);
        }
      }
    }
    if (refreshableAssetIds.length === 0) {
      return;
    }

    const requestId = subPostMediaUploadRequestRef.current + 1;
    subPostMediaUploadRequestRef.current = requestId;
    setUploadingSubPostMedia(true);
    try {
      const refreshedAssets = await Promise.all(
        refreshableAssetIds.map((assetId) => getContentMediaAsset(client, { assetId })),
      );
      if (requestId !== subPostMediaUploadRequestRef.current) {
        return;
      }
      setSubPostMediaAssets((prev) =>
        mergeRefreshedSubPostComposerMediaAssets(prev, refreshedAssets),
      );
      setSubPostMediaUploadStatus({ type: "" });
    } catch (error) {
      if (requestId !== subPostMediaUploadRequestRef.current) {
        return;
      }
      const message = readableError(error, "失败");
      setSubPostMediaUploadStatus({
        type: "error",
        message,
      });
      setMessage(message);
    } finally {
      if (requestId === subPostMediaUploadRequestRef.current) {
        setUploadingSubPostMedia(false);
      }
    }
  }

  async function submitSubPost(event) {
    event.preventDefault();
    if (!selectedPost || !selectedPostId) {
      return;
    }
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    const trimmed = subPostInput.trim();
    const mediaAssetIds = collectSubPostComposerMediaAssetIds(subPostMediaAssets);
    const targetSubPostId = Number(activeSubPostTarget?.id || 0) || null;
    const isTopLevelSubPost = !targetSubPostId;
    if (uploadingSubPostMedia) {
      setMessage("图片仍在上传，请完成后发布。");
      return;
    }
    if (!hasSubPostComposerSubmitContent({ content: trimmed, mediaAssetIds })) {
      setMessage(UI_MESSAGES.subPostContentRequired);
      return;
    }
    const requestContextKey = buildCurrentRouteInteractionContextKey();
    const requestId = subPostSubmitRequestRef.current + 1;
    subPostSubmitRequestRef.current = requestId;
    setSubmittingSubPost(true);
    try {
      const createdSubPost = normalizeSubPostPayload(await createContentSubPost(client, {
        token,
        mainPostId: selectedPostId,
        parentSubPostId: targetSubPostId,
        content: trimmed,
        mediaAssetIds,
      }));
      if (!shouldApplyCurrentRouteInteractionResult(requestContextKey)) {
        return;
      }
      const latestMessageAt = createdSubPost.createdAt || new Date().toISOString();
      setSubPostInput("");
      resetSubPostMediaDraft();
      setActiveSubPostTarget(null);
      if (isTopLevelSubPost) {
        setShowTopSubPostComposer(false);
      }
      if (targetSubPostId) {
        setCollapsedSubPostBranches((prev) => ({
          ...prev,
          [targetSubPostId]: false,
        }));
      }
      await reportUserActivity(
        { type: "SUB_POST_CREATED", communitySlug: selectedPost.communitySlug || "" },
        { silent: true },
      );
      if (!shouldApplyCurrentRouteInteractionResult(requestContextKey)) {
        return;
      }
      const mutationStrategy = buildCreatedSubPostMutationStrategy({
        selectedPostId,
        targetMainPostId: selectedPostId,
        latestMessageAt,
      });
      await mainPostMutationInterface.executeMainPostMutationStrategy(mutationStrategy);
      if (!shouldApplyCurrentRouteInteractionResult(requestContextKey)) {
        return;
      }
      setMessage(UI_MESSAGES.subPostCreated);
    } catch (error) {
      if (!shouldApplyCurrentRouteInteractionResult(requestContextKey)) {
        return;
      }
      setMessage(readableError(error, UI_MESSAGES.subPostCreateFailed));
    } finally {
      if (shouldFinalizePostRouteInteractionRequest({
        requestContextKey,
        currentRouteType: routeContextRef.current.routeType,
        currentMainPostId: routeContextRef.current.mainPostId,
        requestId,
        currentRequestId: subPostSubmitRequestRef.current,
      })) {
        setSubmittingSubPost(false);
      }
    }
  }

  async function toggleSubPostLike(subPostId, likedByMe, subPostAuthor = "") {
    if (!selectedPost || !selectedPostId) {
      return;
    }
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    const requestContextKey = buildCurrentRouteInteractionContextKey();
    const engagementRequest = beginSubPostEngagementRequest({ subPostId, action: "like" });
    try {
      const response = await toggleContentSubPostLike(client, {
        token,
        subPostId,
        likedByMe,
      });
      if (
        !shouldApplyCurrentRouteInteractionResult(requestContextKey)
        || !shouldApplySubPostEngagementResult(engagementRequest)
      ) {
        return;
      }
      const currentSubPost = getCurrentSubPost(subPostId);
      const nextLikedByMe = resolveNextEngagementActive({
        response,
        activeKey: "likedByMe",
        wasActive: likedByMe,
      });
      const interactionState = {
        likeCount: resolveNextEngagementCount({
          response,
          countKey: "likeCount",
          currentCount: currentSubPost?.likeCount,
          wasActive: likedByMe,
          nextActive: nextLikedByMe,
        }),
        likedByMe: nextLikedByMe,
      };
      if (typeof setSubPosts === "function") {
        setSubPosts((prev) =>
          updateSubPostInteraction(
            prev,
            subPostId,
            interactionState,
          ),
        );
      }
      syncProfileSubPostAction({
        subPost: currentSubPost || { id: subPostId },
        action: "like",
        active: nextLikedByMe,
        interactionState,
      });
      if (!likedByMe) {
        await reportUserActivity(
          { type: "LIKE_GIVEN", targetUsername: subPostAuthor },
          { silent: true },
        );
      }
    } catch (error) {
      if (
        !shouldApplyCurrentRouteInteractionResult(requestContextKey)
        || !shouldApplySubPostEngagementResult(engagementRequest)
      ) {
        return;
      }
      setMessage(readableError(error, UI_MESSAGES.genericOperationFailed));
    }
  }

  async function toggleSubPostFavorite(subPostId, favoritedByMe) {
    if (!selectedPost || !selectedPostId) {
      return;
    }
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    const requestContextKey = buildCurrentRouteInteractionContextKey();
    const engagementRequest = beginSubPostEngagementRequest({ subPostId, action: "favorite" });
    try {
      const response = await toggleContentSubPostFavorite(client, {
        token,
        subPostId,
        favoritedByMe,
      });
      if (
        !shouldApplyCurrentRouteInteractionResult(requestContextKey)
        || !shouldApplySubPostEngagementResult(engagementRequest)
      ) {
        return;
      }
      const currentSubPost = getCurrentSubPost(subPostId);
      const nextFavoritedByMe = resolveNextEngagementActive({
        response,
        activeKey: "favoritedByMe",
        wasActive: favoritedByMe,
      });
      const interactionState = {
        favoriteCount: resolveNextEngagementCount({
          response,
          countKey: "favoriteCount",
          currentCount: currentSubPost?.favoriteCount,
          wasActive: favoritedByMe,
          nextActive: nextFavoritedByMe,
        }),
        favoritedByMe: nextFavoritedByMe,
      };
      if (typeof setSubPosts === "function") {
        setSubPosts((prev) =>
          updateSubPostInteraction(
            prev,
            subPostId,
            interactionState,
          ),
        );
      }
      syncProfileSubPostAction({
        subPost: currentSubPost || { id: subPostId },
        action: "favorite",
        active: nextFavoritedByMe,
        interactionState,
      });
    } catch (error) {
      if (
        !shouldApplyCurrentRouteInteractionResult(requestContextKey)
        || !shouldApplySubPostEngagementResult(engagementRequest)
      ) {
        return;
      }
      setMessage(readableError(error, UI_MESSAGES.genericOperationFailed));
    }
  }

  async function deleteSubPost(subPost) {
    if (!selectedPostId) {
      return;
    }
    const subPostId = resolveSubPostId(subPost);
    if (!subPostId) {
      return;
    }
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    const subPostAuthor = subPost.author || subPost.authorUsername || "";
    if (subPostAuthor !== currentUser) {
      setMessage(UI_MESSAGES.onlySubPostAuthorCanDelete);
      return;
    }
    const requestContextKey = buildCurrentRouteInteractionContextKey();
    const confirmed = await confirmInBrowser("确定要删除这条子帖吗？此操作无法撤销。", {
      title: "删除子帖",
      confirmLabel: "删除",
      variant: "danger",
    });
    if (!confirmed) {
      return;
    }
    if (!shouldApplyCurrentRouteInteractionResult(requestContextKey)) {
      return;
    }
    try {
      await deleteContentSubPost(client, {
        token,
        subPostId,
      });
      if (!shouldApplyCurrentRouteInteractionResult(requestContextKey)) {
        return;
      }
      if (resolveSubPostId({ id: targetSubPostId }) === subPostId) {
        clearTargetSubPostLocation();
      }
      if (typeof setSubPosts === "function") {
        setSubPosts((prev) =>
          (Array.isArray(prev) ? prev : []).filter((item) => resolveSubPostId(item) !== subPostId),
        );
      }
      const mutationStrategy = buildDeletedSubPostMutationStrategy({
        selectedPostId,
        targetMainPostId: selectedPostId,
      });
      if (typeof onSubPostDeleted === "function") {
        onSubPostDeleted(subPostId);
      }
      setMessage(UI_MESSAGES.subPostDeleted);
      try {
        if (typeof reloadCurrentSubPosts === "function") {
          await reloadCurrentSubPosts();
        }
        await mainPostMutationInterface.executeMainPostMutationStrategy(mutationStrategy);
      } catch {
        // The server delete already succeeded; follow-up cache convergence should not undo feedback.
      }
    } catch (error) {
      if (!shouldApplyCurrentRouteInteractionResult(requestContextKey)) {
        return;
      }
      setMessage(readableError(error, UI_MESSAGES.subPostDeleteFailed));
    }
  }

  function jumpToSubPostFloor(subPostId) {
    const normalizedId = Number(subPostId);
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
      return;
    }
    const branchAnchorId = resolveSubPostJumpBranchAnchorId({
      orderedSubPostFloors,
      subPostId: normalizedId,
    });
    setCollapsedSubPostBranches((prev) => ({
      ...prev,
      [branchAnchorId]: false,
    }));
    scheduleSubPostFloorScroll(normalizedId, topbarRef);
  }

  function clearTargetSubPostLocation() {
    if (!mainPostId || typeof setRoute !== "function") {
      return;
    }
    navigateToPost(mainPostId, setRoute, {
      manageSource: routeManageSource,
    });
  }

  function toggleSubPostBranches(subPostId) {
    setCollapsedSubPostBranches((prev) => toggleSubPostBranchState(prev, subPostId));
  }

  function toggleSubPostMoreMenu(menuId) {
    setSubPostMoreMenuId((prev) => toggleSubPostMenuState(prev, menuId));
  }

  async function handleSubPostFavoriteFromMenu(subPostId, favoritedByMe) {
    await toggleSubPostFavorite(subPostId, favoritedByMe);
  }

  async function handleSubPostShareFromMenu(subPostId) {
    if (!selectedPost) {
      return;
    }
    const requestContextKey = buildSubPostMenuShareContextKey({
      routeType,
      mainPostId,
      subPostId,
    });
    if (!beginShareRequest(subPostShareRequestKeysRef.current, requestContextKey)) {
      return;
    }
    const origin = typeof window !== "undefined" ? window.location?.origin : "";
    const url = buildPostShareUrl({
      post: selectedPost,
      origin,
      targetSubPostId: subPostId,
    });
    try {
      let result = POST_SHARE_RESULTS.failed;
      try {
        const { sharePostLink } = await loadPostShareLink();
        result = await sharePostLink({
          post: buildSubPostSharePost({
            mainPost: selectedPost,
            subPost: getCurrentSubPost(subPostId),
          }),
          url,
          targetSubPostId: subPostId,
        });
      } catch {
        result = POST_SHARE_RESULTS.failed;
      }
      if (!shouldApplySubPostMenuShareResult({
        requestContextKey,
        currentRouteType: routeContextRef.current.routeType,
        currentMainPostId: routeContextRef.current.mainPostId,
        subPostId,
      })) {
        return;
      }
      setSubPostMoreMenuId("");
      const shareMessage = resolvePostShareResultMessage(result, {
        sharedMessage: UI_MESSAGES.subPostShared,
        copiedMessage: UI_MESSAGES.subPostLinkCopied,
        failedMessage: UI_MESSAGES.subPostShareFailed,
      });
      if (shareMessage) {
        setMessage(shareMessage);
      }
    } finally {
      finalizeShareRequest(subPostShareRequestKeysRef.current, requestContextKey);
    }
  }

  async function copyTargetSubPostLink(subPostId) {
    if (!selectedPost) {
      return;
    }
    const normalizedSubPostId = resolveSubPostId({ id: subPostId });
    if (!normalizedSubPostId) {
      setMessage(UI_MESSAGES.subPostLocationLinkCopyFailed);
      return;
    }
    const requestContextKey = buildSubPostMenuShareContextKey({
      routeType,
      mainPostId,
      subPostId: normalizedSubPostId,
    });
    const origin = typeof window !== "undefined" ? window.location?.origin : "";
    const url = buildSubPostLocationCopyUrl({
      post: selectedPost,
      origin,
      targetSubPostId: normalizedSubPostId,
    });
    if (!requestContextKey || !url) {
      setMessage(UI_MESSAGES.subPostLocationLinkCopyFailed);
      return;
    }
    try {
      const { copyTextToClipboard } = await loadClipboard();
      await copyTextToClipboard(url);
      if (!shouldApplySubPostMenuShareResult({
        requestContextKey,
        currentRouteType: routeContextRef.current.routeType,
        currentMainPostId: routeContextRef.current.mainPostId,
        subPostId: normalizedSubPostId,
      })) {
        return;
      }
      setMessage(UI_MESSAGES.subPostLocationLinkCopied);
    } catch {
      if (!shouldApplySubPostMenuShareResult({
        requestContextKey,
        currentRouteType: routeContextRef.current.routeType,
        currentMainPostId: routeContextRef.current.mainPostId,
        subPostId: normalizedSubPostId,
      })) {
        return;
      }
      setMessage(UI_MESSAGES.subPostLocationLinkCopyFailed);
    }
  }

  function handleSubPostReport() {
    if (!isLoggedIn) {
      requireAuthNotice();
      return;
    }
    setMessage(UI_MESSAGES.reportUnavailable);
  }

  return {
    submittingSubPost,
    subPostInput,
    subPostMediaAssets,
    uploadingSubPostMedia,
    subPostMediaUploadStatus,
    activeSubPostTarget,
    showTopSubPostComposer,
    collapsedSubPostBranches,
    subPostMoreMenuId,
    targetSubPostStatus,
    setSubPostInput,
    onSubPostMediaPicked,
    retryFailedSubPostMediaUploads,
    refreshSubPostMediaAssets,
    removeSubPostMediaAt,
    submitSubPost,
    toggleSubPostLike,
    toggleSubPostFavorite,
    deleteSubPost,
    openMainPostSubPostComposer,
    startNestedSubPostComposer,
    cancelNestedSubPostComposer,
    cancelTopSubPostComposer,
    jumpToSubPostFloor,
    clearTargetSubPostLocation,
    toggleSubPostBranches,
    toggleSubPostMoreMenu,
    handleSubPostFavoriteFromMenu,
    handleSubPostShareFromMenu,
    copyTargetSubPostLink,
    handleSubPostReport,
    requireAuthNotice,
  };
}
