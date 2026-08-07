import { useEffect, useRef, useState } from "react";
import {
  getMediaAsset as getContentMediaAsset,
  uploadMediaAsset as uploadContentMediaAsset,
} from "../../content/api/contentApi";
import {
  buildComposerMarkdownImageInsertion,
  buildComposerUploadContextKey,
  buildComposerUploadStatus,
  buildComposerMediaUrlsFromAssets,
  getNextComposerMediaIndex,
  isComposerMediaAssetRefreshPending,
  isComposerMediaAssetSubmitReady,
  limitComposerUploadFilesByMediaCapacity,
  mergeComposerMediaAssets,
  mergeComposerMediaUrls,
  mergeComposerRefreshedMediaAssets,
  moveIndexedItem,
  normalizeComposerMediaDraft,
  removeIndexedItem,
  shouldApplyComposerUploadResult,
  shouldResetComposerUploadFeedback,
} from "../state/composerDraftHelpers";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";
import { notifyAuthRequired } from "../../../shared/state/authInteractionHelpers";

export function useComposerMediaDraft({
  client,
  token,
  isLoggedIn,
  composerCommunitySlug,
  composerMode,
  routeType,
  editingMainPostId,
  setContent,
  setMessage,
  getContentInsertSelection,
  onContentInserted,
  onAuthRequired,
}) {
  const [composerMediaUrls, setComposerMediaUrls] = useState([]);
  const [composerMediaAssets, setComposerMediaAssets] = useState([]);
  const [composerMediaIndex, setComposerMediaIndex] = useState(0);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [composerUploadStatus, setComposerUploadStatus] = useState({ type: "" });
  const [failedComposerUploadFiles, setFailedComposerUploadFiles] = useState([]);
  const composerMediaAssetsRef = useRef([]);
  const composerMediaUrlsRef = useRef([]);
  const composerUploadRequestRef = useRef(0);
  const composerMediaRefreshAttemptsRef = useRef(new Map());
  const composerUploadContextRef = useRef({
    routeType,
    editingMainPostId,
    composerMode,
    composerCommunitySlug,
  });
  const composerUploadContextKeyRef = useRef(buildComposerUploadContextKey({
    routeType,
    editingMainPostId,
    composerMode,
    composerCommunitySlug,
  }));
  composerUploadContextRef.current = {
    routeType,
    editingMainPostId,
    composerMode,
    composerCommunitySlug,
  };
  composerMediaAssetsRef.current = composerMediaAssets;
  composerMediaUrlsRef.current = composerMediaUrls;

  useEffect(() => {
    setComposerMediaIndex((prev) => {
      if (composerMediaUrls.length === 0) {
        return 0;
      }
      return Math.min(prev, composerMediaUrls.length - 1);
    });
  }, [composerMediaUrls]);

  useEffect(() => {
    const activeAssetIds = new Set(
      composerMediaAssets
        .map((asset) => Number(asset?.id || 0))
        .filter((assetId) => assetId > 0),
    );
    for (const assetId of composerMediaRefreshAttemptsRef.current.keys()) {
      if (!activeAssetIds.has(assetId)) {
        composerMediaRefreshAttemptsRef.current.delete(assetId);
      }
    }
  }, [composerMediaAssets]);

  useEffect(() => {
    const pendingAssets = composerMediaAssets.filter(isComposerMediaAssetRefreshPending);
    if (
      pendingAssets.length === 0 ||
      !isLoggedIn ||
      routeType !== "compose"
    ) {
      return undefined;
    }
    const requestContextKey = buildComposerUploadContextKey({
      routeType,
      editingMainPostId,
      composerMode,
      composerCommunitySlug,
    });
    if (!requestContextKey) {
      return undefined;
    }
    const assetIds = pendingAssets
      .map((asset) => Number(asset?.id || 0))
      .filter((assetId) => {
        const attempts = Number(composerMediaRefreshAttemptsRef.current.get(assetId) || 0);
        return assetId > 0 && attempts < 12;
      });
    if (assetIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      assetIds.forEach((assetId) => {
        const attempts = Number(composerMediaRefreshAttemptsRef.current.get(assetId) || 0);
        composerMediaRefreshAttemptsRef.current.set(assetId, attempts + 1);
      });
      const refreshedResults = await Promise.allSettled(
        assetIds.map((assetId) => getContentMediaAsset(client, { assetId })),
      );
      if (
        cancelled ||
        !shouldApplyCurrentComposerUploadResult({
          requestContextKey,
          requestId: composerUploadRequestRef.current,
        })
      ) {
        return;
      }
      const refreshedAssets = refreshedResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value)
        .filter((asset) => Number(asset?.id || 0) > 0);
      if (refreshedAssets.length === 0) {
        return;
      }
      const nextAssets = mergeComposerRefreshedMediaAssets(
        composerMediaAssetsRef.current,
        refreshedAssets,
      );
      if (nextAssets === composerMediaAssetsRef.current) {
        return;
      }
      refreshedAssets
        .filter((asset) => !isComposerMediaAssetRefreshPending(asset))
        .forEach((asset) => composerMediaRefreshAttemptsRef.current.delete(Number(asset.id || 0)));
      const nextUrls = buildComposerMediaUrlsFromAssets(nextAssets, composerMediaUrlsRef.current);
      composerMediaAssetsRef.current = nextAssets;
      composerMediaUrlsRef.current = nextUrls;
      setComposerMediaAssets(nextAssets);
      setComposerMediaUrls(nextUrls);
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    client,
    composerCommunitySlug,
    composerMediaAssets,
    composerMode,
    editingMainPostId,
    isLoggedIn,
    routeType,
  ]);

  useEffect(() => {
    const nextContextKey = buildComposerUploadContextKey({
      routeType,
      editingMainPostId,
      composerMode,
      composerCommunitySlug,
    });
    const didChangeContext = shouldResetComposerUploadFeedback({
      previousContextKey: composerUploadContextKeyRef.current,
      nextContextKey,
    });
    composerUploadContextKeyRef.current = nextContextKey;
    composerUploadRequestRef.current += 1;
    setUploadingAssets(false);
    if (didChangeContext) {
      setFailedComposerUploadFiles([]);
      setComposerUploadStatus({ type: "" });
    }
  }, [routeType, editingMainPostId, composerMode, composerCommunitySlug]);

  function shouldApplyCurrentComposerUploadResult({
    requestContextKey,
    requestId,
  }) {
    return shouldApplyComposerUploadResult({
      requestContextKey,
      currentRouteType: composerUploadContextRef.current.routeType,
      currentEditingMainPostId: composerUploadContextRef.current.editingMainPostId,
      currentComposerMode: composerUploadContextRef.current.composerMode,
      currentComposerCommunitySlug: composerUploadContextRef.current.composerCommunitySlug,
      requestId,
      currentRequestId: composerUploadRequestRef.current,
    });
  }

  function resetComposerMediaDraft() {
    composerUploadRequestRef.current += 1;
    setComposerMediaUrls([]);
    setComposerMediaAssets([]);
    setComposerMediaIndex(0);
    setUploadingAssets(false);
    setComposerUploadStatus({ type: "" });
    setFailedComposerUploadFiles([]);
  }

  function hydrateComposerMediaDraft({ mediaUrls, mediaAssets }) {
    composerUploadRequestRef.current += 1;
    const normalizedDraft = normalizeComposerMediaDraft({ mediaUrls, mediaAssets });
    setComposerMediaUrls(normalizedDraft.mediaUrls);
    setComposerMediaAssets(normalizedDraft.mediaAssets);
    setComposerMediaIndex(0);
    setComposerUploadStatus({ type: "" });
    setFailedComposerUploadFiles([]);
    return normalizedDraft;
  }

  function removeComposerMediaAt(index) {
    setComposerMediaUrls((prev) => removeIndexedItem(prev, index));
    setComposerMediaAssets((prev) => removeIndexedItem(prev, index));
    setComposerMediaIndex((current) =>
      getNextComposerMediaIndex(current, index, composerMediaUrls.length),
    );
  }

  function moveComposerMedia(direction) {
    const from = composerMediaIndex;
    const to = from + direction;
    if (to < 0 || to >= composerMediaUrls.length) {
      return;
    }
    setComposerMediaUrls((prev) => moveIndexedItem(prev, from, to));
    setComposerMediaAssets((prev) => moveIndexedItem(prev, from, to));
    setComposerMediaIndex(to);
  }

  async function uploadComposerImageFiles(imageFiles, {
    skippedCount = 0,
    insertSelection = null,
  } = {}) {
    const requestContextKey = buildComposerUploadContextKey({
      routeType,
      editingMainPostId,
      composerMode,
      composerCommunitySlug,
    });
    if (!requestContextKey) {
      return;
    }
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    if (!composerCommunitySlug) {
      const status = buildComposerUploadStatus({
        errorMessage: UI_MESSAGES.mediaUploadCommunityRequired,
      });
      setComposerUploadStatus(status);
      setMessage(status.message);
      return;
    }
    const limitedUpload = limitComposerUploadFilesByMediaCapacity({
      imageFiles,
      existingMediaCount: composerMediaAssets.length,
      skippedCount,
    });
    imageFiles = limitedUpload.imageFiles;
    skippedCount = limitedUpload.skippedCount;
    if (imageFiles.length === 0) {
      const status = buildComposerUploadStatus({
        skippedCount,
      });
      setFailedComposerUploadFiles([]);
      setComposerUploadStatus(status);
      setMessage(status.message);
      return;
    }
    const requestId = composerUploadRequestRef.current + 1;
    composerUploadRequestRef.current = requestId;
    setUploadingAssets(true);
    setFailedComposerUploadFiles([]);
    setComposerUploadStatus(buildComposerUploadStatus({ uploading: true }));
    try {
      const uploadedEntries = new Array(imageFiles.length);
      const failedEntries = new Array(imageFiles.length);
      let nextIndex = 0;
      const uploadNext = async () => {
        while (nextIndex < imageFiles.length) {
          const currentIndex = nextIndex;
          const file = imageFiles[currentIndex];
          nextIndex += 1;
          try {
            const uploadedAsset = await uploadContentMediaAsset(client, { token, file });
            if (!isComposerMediaAssetSubmitReady(uploadedAsset)) {
              throw new Error("empty image url");
            }
            uploadedEntries[currentIndex] = uploadedAsset;
          } catch {
            failedEntries[currentIndex] = file;
          }
        }
      };
      const concurrency = Math.min(3, imageFiles.length);
      await Promise.all(Array.from({ length: concurrency }, uploadNext));

      const uploadedImages = uploadedEntries.filter(Boolean);
      const failedFiles = failedEntries.filter(Boolean);
      if (!shouldApplyCurrentComposerUploadResult({ requestContextKey, requestId })) {
        return;
      }
      if (uploadedImages.length > 0) {
        setComposerMediaAssets((prev) => mergeComposerMediaAssets(prev, uploadedImages));
        setComposerMediaUrls((prev) =>
          mergeComposerMediaUrls(prev, uploadedImages, composerMediaAssetsRef.current),
        );
      }
      if (uploadedImages.length > 0 && composerMode === "long" && typeof setContent === "function") {
        let insertedSelection = null;
        setContent((prev) => {
          const insertionResult = buildComposerMarkdownImageInsertion({
            content: prev,
            uploadedAssets: uploadedImages,
            insertSelection,
          });
          insertedSelection = {
            selectionStart: insertionResult.selectionStart,
            selectionEnd: insertionResult.selectionEnd,
          };
          return insertionResult.content;
        });
        if (insertedSelection && typeof onContentInserted === "function") {
          onContentInserted(insertedSelection);
        }
      }
      const status = buildComposerUploadStatus({
        imageCount: uploadedImages.length,
        skippedCount,
        failedCount: failedFiles.length,
        retryableFailedCount: failedFiles.length,
      });
      setFailedComposerUploadFiles(failedFiles);
      setComposerUploadStatus(status);
      setMessage(status.message);
    } catch (error) {
      if (!shouldApplyCurrentComposerUploadResult({ requestContextKey, requestId })) {
        return;
      }
      const status = buildComposerUploadStatus({
        errorMessage: readableError(error, UI_MESSAGES.mediaUploadFailed),
        retryableFailedCount: imageFiles.length,
      });
      setFailedComposerUploadFiles(imageFiles);
      setComposerUploadStatus(status);
      setMessage(status.message);
    } finally {
      if (shouldApplyCurrentComposerUploadResult({ requestContextKey, requestId })) {
        setUploadingAssets(false);
      }
    }
  }

  async function onComposerAssetPicked(event) {
    const files = Array.from(event.target.files || []);
    const insertSelection = typeof getContentInsertSelection === "function"
      ? getContentInsertSelection()
      : null;
    event.target.value = "";
    if (files.length === 0) {
      return;
    }
    const imageFiles = [];
    let skippedCount = 0;
    for (const file of files) {
      const isImage = String(file.type || "").startsWith("image/");
      if (!isImage) {
        skippedCount += 1;
        continue;
      }
      imageFiles.push(file);
    }
    await uploadComposerImageFiles(imageFiles, { skippedCount, insertSelection });
  }

  async function retryFailedComposerUploads() {
    if (failedComposerUploadFiles.length === 0 || uploadingAssets) {
      return;
    }
    const insertSelection = typeof getContentInsertSelection === "function"
      ? getContentInsertSelection()
      : null;
    await uploadComposerImageFiles(failedComposerUploadFiles, { insertSelection });
  }

  return {
    composerMediaUrls,
    composerMediaAssets,
    composerMediaIndex,
    composerUploadStatus,
    uploadingAssets,
    setComposerMediaIndex,
    resetComposerMediaDraft,
    hydrateComposerMediaDraft,
    removeComposerMediaAt,
    moveComposerMedia,
    onComposerAssetPicked,
    retryFailedComposerUploads,
  };
}
