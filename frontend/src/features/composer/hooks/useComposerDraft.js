import { useEffect, useMemo, useRef, useState } from "react";
import {
  createMainPost as createContentMainPost,
  updateMainPost as updateContentMainPost,
} from "../../content/api/contentApi";
import {
  navigateToCompose,
  navigateToHome,
} from "../../../shared/state/appHelpers";
import {
  normalizePostModeValue,
  normalizePostPayload,
} from "../../posts/state/mainPostModel";
import { buildSavedMainPostMutationStrategy } from "../../posts/state/mainPostMutationStrategyHelpers";
import {
  buildComposerEditSnapshot,
  buildComposerDraftRestoredMessage,
  buildComposerDraftRestoreValidationState,
  buildComposerMarkdownImageInsertion,
  buildComposerModeSwitchContent,
  buildComposerEditOpenContextKey,
  buildComposerSubmitContextKey,
  buildComposerSubmitPayload,
  buildComposerSubmitStatus,
  buildComposerSubmitValidation,
  findUnreferencedComposerMarkdownMediaAssets,
  hasComposerEditChanges,
  hasComposerDraftContent,
  removeMissingComposerMarkdownMediaRefs,
  resizeComposerContentElement,
  resolveDefaultComposerCommunitySlug,
  resolveEditComposerCommunitySlug,
  shouldAutoSaveComposerDraftAfterSubmitFailure,
  shouldApplyComposerEditOpenResult,
  shouldApplyComposerSubmitResult,
  shouldConfirmComposerNavigationLeave,
  shouldProtectComposerDraftUnload,
  shouldRestoreSavedComposerDraft,
} from "../state/composerDraftHelpers";
import { useComposerMediaDraft } from "./useComposerMediaDraft";
import { useComposerTagEditor } from "./useComposerTagEditor";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";
import { notifyAuthRequired } from "../../../shared/state/authInteractionHelpers";
import { confirmInBrowser } from "../../../shared/platform/browserDialog";
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from "../../../shared/platform/browserStorage";

const COMPOSER_DRAFT_STORAGE_KEY = "memesee:composer-draft:v1";

function readSavedComposerDraft() {
  const raw = readLocalStorageItem(COMPOSER_DRAFT_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function clearSavedComposerDraft() {
  removeLocalStorageItem(COMPOSER_DRAFT_STORAGE_KEY);
}

export function useComposerDraft({
  route,
  routeType,
  isLoggedIn,
  currentUser,
  token,
  client,
  apiBase,
  communities,
  orderedCommunities,
  feedQueryRuntime,
  setMessage,
  setView,
  setRoute,
  onAuthRequired,
  onMainPostSaved,
  mainPostMutationInterface,
}) {
  const selectedCommunitySlug = feedQueryRuntime?.selectedCommunitySlug;
  const feedQueryState = feedQueryRuntime?.feedQueryState;
  const [composerCommunitySlug, setComposerCommunitySlug] = useState("");
  const [composerMode, setComposerMode] = useState("long");
  const [editingMainPostId, setEditingMainPostId] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [submitValidationMessage, setSubmitValidationMessage] = useState("");
  const [submitValidationTarget, setSubmitValidationTarget] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isTitlePreviewMode, setIsTitlePreviewMode] = useState(false);
  const [composeCommunityMenuOpen, setComposeCommunityMenuOpen] = useState(false);
  const composerTitleInputRef = useRef(null);
  const composerContentRef = useRef(null);
  const composeCommunityMenuRef = useRef(null);
  const previousRouteTypeRef = useRef(routeType);
  const suppressLeavePromptRef = useRef(false);
  const initialEditSnapshotRef = useRef(null);
  const composerEditOpenRequestRef = useRef(0);
  const composerSubmitRequestRef = useRef(0);
  const composerSubmitContextRef = useRef({ routeType, editingMainPostId });
  composerSubmitContextRef.current = { routeType, editingMainPostId };
  const composerRouteContextRef = useRef({
    routeType,
    mainPostId: route?.mainPostId,
    targetSubPostId: route?.targetSubPostId,
    editingMainPostId,
  });
  composerRouteContextRef.current = {
    routeType,
    mainPostId: route?.mainPostId,
    targetSubPostId: route?.targetSubPostId,
    editingMainPostId,
  };
  const tagEditor = useComposerTagEditor({ setMessage: showComposerValidationMessage });

  function shouldApplyCurrentComposerEditOpenResult({
    requestContextKey,
    requestId,
    postId,
  }) {
    return shouldApplyComposerEditOpenResult({
      requestContextKey,
      currentRouteType: composerRouteContextRef.current.routeType,
      currentMainPostId: composerRouteContextRef.current.mainPostId,
      currentTargetSubPostId: composerRouteContextRef.current.targetSubPostId,
      currentEditingMainPostId: composerRouteContextRef.current.editingMainPostId,
      postId,
      requestId,
      currentRequestId: composerEditOpenRequestRef.current,
    });
  }

  function shouldApplyCurrentComposerSubmitResult({
    requestContextKey,
    requestId,
  }) {
    return shouldApplyComposerSubmitResult({
      requestContextKey,
      currentRouteType: composerSubmitContextRef.current.routeType,
      currentEditingMainPostId: composerSubmitContextRef.current.editingMainPostId,
      requestId,
      currentRequestId: composerSubmitRequestRef.current,
    });
  }

  function getComposerContentInsertSelection() {
    const target = composerContentRef.current;
    if (!target) {
      return null;
    }
    const selectionStart = Number(target.selectionStart);
    const selectionEnd = Number(target.selectionEnd);
    if (
      !Number.isInteger(selectionStart) ||
      !Number.isInteger(selectionEnd) ||
      selectionEnd < selectionStart
    ) {
      return null;
    }
    return { selectionStart, selectionEnd };
  }

  function focusComposerContentSelection(selection = {}) {
    const frameId = window.requestAnimationFrame(() => {
      const target = composerContentRef.current;
      if (!target) {
        return;
      }
      target.scrollIntoView?.({ block: "center", behavior: "smooth" });
      target.focus?.({ preventScroll: true });
      const selectionStart = Number(selection.selectionStart);
      const selectionEnd = Number(selection.selectionEnd);
      if (
        Number.isInteger(selectionStart) &&
        Number.isInteger(selectionEnd) &&
        selectionEnd >= selectionStart &&
        typeof target.setSelectionRange === "function"
      ) {
        target.setSelectionRange(selectionStart, selectionEnd);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }

  const mediaDraft = useComposerMediaDraft({
    client,
    token,
    isLoggedIn,
    composerCommunitySlug,
    composerMode,
    routeType,
    editingMainPostId,
    setContent,
    setMessage,
    getContentInsertSelection: getComposerContentInsertSelection,
    onContentInserted: focusComposerContentSelection,
    onAuthRequired,
  });

  const composerCommunityName = useMemo(() => {
    if (!composerCommunitySlug) {
      return "";
    }
    return communities.find((community) => community.slug === composerCommunitySlug)?.name || composerCommunitySlug;
  }, [communities, composerCommunitySlug]);

  function clearComposerFormState() {
    setTitle("");
    setContent("");
    setComposerMode("long");
    mediaDraft.resetComposerMediaDraft();
    tagEditor.resetComposerTagEditor();
    setIsTitlePreviewMode(false);
    setComposeCommunityMenuOpen(false);
    setComposerCommunitySlug("");
    setEditingMainPostId(null);
    setSubmitValidationMessage("");
    setSubmitValidationTarget("");
    setSubmitError("");
    initialEditSnapshotRef.current = null;
  }

  function applySavedComposerDraft(savedDraft) {
    if (!savedDraft) {
      return null;
    }
    const savedCommunitySlug = savedDraft.communitySlug || "";
    const fallbackCommunitySlug = resolveDefaultComposerCommunitySlug({
      selectedCommunitySlug,
      orderedCommunities,
    });
    const nextCommunitySlug = resolveEditComposerCommunitySlug({
      orderedCommunities,
      communitySlug: savedCommunitySlug || fallbackCommunitySlug,
    });
    setComposerCommunitySlug(nextCommunitySlug);
    setComposerMode(normalizePostModeValue(savedDraft.composerMode));
    const restoredMediaDraft = mediaDraft.hydrateComposerMediaDraft({
      mediaUrls: savedDraft.mediaUrls,
      mediaAssets: savedDraft.mediaAssets,
    });
    tagEditor.hydrateComposerTags(savedDraft.tags);
    setTitle(savedDraft.title || "");
    setContent(savedDraft.content || "");
    setIsTitlePreviewMode(Boolean(String(savedDraft.title || "").trim()));
    setComposeCommunityMenuOpen(false);
    setEditingMainPostId(null);
    setSubmitValidationMessage("");
    setSubmitValidationTarget("");
    setSubmitError("");
    initialEditSnapshotRef.current = null;
    const restoredComposerMode = normalizePostModeValue(savedDraft.composerMode);
    const restoredContent = savedDraft.content || "";
    const restoreValidationState = buildComposerDraftRestoreValidationState({
      composerMode: restoredComposerMode,
      content: restoredContent,
      composerMediaAssets: restoredMediaDraft?.mediaAssets,
    });
    if (restoreValidationState.message) {
      setSubmitValidationMessage(restoreValidationState.message);
      setSubmitValidationTarget("content");
    }
    return {
      droppedMediaCount: restoredMediaDraft?.droppedCount || 0,
      missingMediaRefCount: restoreValidationState.missingMediaRefCount,
    };
  }

  function buildComposerDraftSnapshot() {
    const { normalizedTagItems, validationMessage } = tagEditor.resolveComposerTags();
    const tags = validationMessage ? tagEditor.composerTags : normalizedTagItems;
    return {
      ownerUsername: String(currentUser || "").trim(),
      title,
      content,
      communitySlug: composerCommunitySlug,
      composerMode,
      tags,
      mediaUrls: mediaDraft.composerMediaUrls,
      mediaAssets: mediaDraft.composerMediaAssets,
      savedAt: new Date().toISOString(),
    };
  }

  function saveComposerDraftSnapshot() {
    const snapshot = buildComposerDraftSnapshot();
    writeLocalStorageItem(COMPOSER_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  }

  function trySaveComposerDraftSnapshot() {
    try {
      saveComposerDraftSnapshot();
      return true;
    } catch {
      return false;
    }
  }

  function clearComposerSubmitFeedback() {
    setSubmitValidationMessage("");
    setSubmitValidationTarget("");
    setSubmitError("");
  }

  function showComposerValidationMessage(message, target = "tag") {
    setSubmitValidationMessage(message);
    setSubmitValidationTarget(target);
    setSubmitError("");
    setMessage(message);
  }

  function hasUnsavedComposerDraft() {
    if (editingMainPostId) {
      return false;
    }
    return hasComposerDraftContent({
      title,
      content,
      composerTags: tagEditor.composerTags,
      composerTagDraft: tagEditor.composerTagDraft,
      composerMediaUrls: mediaDraft.composerMediaUrls.length
        ? mediaDraft.composerMediaUrls
        : mediaDraft.composerMediaAssets,
    });
  }

  function buildCurrentComposerEditSnapshot() {
    return buildComposerEditSnapshot({
      title,
      content,
      communitySlug: composerCommunitySlug,
      composerMode,
      composerTags: tagEditor.composerTags,
      composerTagDraft: tagEditor.composerTagDraft,
      composerMediaAssets: mediaDraft.composerMediaAssets,
      composerMediaUrls: mediaDraft.composerMediaUrls,
    });
  }

  function hasUnsavedComposerEdit() {
    if (!editingMainPostId) {
      return false;
    }
    return hasComposerEditChanges(
      initialEditSnapshotRef.current,
      buildCurrentComposerEditSnapshot(),
    );
  }

  async function askToSaveComposerDraft() {
    if (!hasUnsavedComposerDraft()) {
      clearSavedComposerDraft();
      return;
    }
    const shouldSave = await confirmInBrowser(
      "当前发布内容尚未提交，是否保存为草稿？",
      {
        title: "保存草稿",
        confirmLabel: "保存",
        cancelLabel: "不保存",
      },
    );
    if (shouldSave) {
      saveComposerDraftSnapshot();
      setMessage("草稿已保存。");
      return;
    }
    clearSavedComposerDraft();
    clearComposerFormState();
  }

  async function confirmComposerNavigationLeave() {
    const hasUnsavedDraft = hasUnsavedComposerDraft();
    const hasUnsavedEdit = hasUnsavedComposerEdit();
    if (!shouldConfirmComposerNavigationLeave({
      routeType,
      hasUnsavedDraft,
      hasUnsavedEdit,
    })) {
      return true;
    }

    if (hasUnsavedEdit) {
      const shouldLeaveEdit = await confirmInBrowser(
        "当前编辑尚未保存，确定要离开吗？",
        {
          title: "离开编辑",
          confirmLabel: "离开",
          cancelLabel: "继续编辑",
          variant: "danger",
        },
      );
      if (!shouldLeaveEdit) {
        return false;
      }
      suppressLeavePromptRef.current = true;
      clearComposerFormState();
      return true;
    }

    const shouldSave = await confirmInBrowser(
      "当前发布内容尚未提交，是否保存为草稿后离开？",
      {
        title: "保存草稿",
        confirmLabel: "保存并离开",
        cancelLabel: "不保存",
      },
    );
    if (shouldSave) {
      saveComposerDraftSnapshot();
      setMessage("草稿已保存。");
      suppressLeavePromptRef.current = true;
      clearComposerFormState();
      return true;
    }

    const shouldDiscard = await confirmInBrowser(
      "不保存草稿并离开吗？当前内容会被丢弃。",
      {
        title: "放弃草稿",
        confirmLabel: "不保存并离开",
        cancelLabel: "继续编辑",
        variant: "danger",
      },
    );
    if (!shouldDiscard) {
      return false;
    }
    clearSavedComposerDraft();
    suppressLeavePromptRef.current = true;
    clearComposerFormState();
    return true;
  }

  useEffect(() => {
    const previousRouteType = previousRouteTypeRef.current;
    previousRouteTypeRef.current = routeType;
    if (previousRouteType !== "compose" || routeType === "compose") {
      return;
    }
    composerSubmitRequestRef.current += 1;
    setPublishing(false);
    if (suppressLeavePromptRef.current) {
      suppressLeavePromptRef.current = false;
      return;
    }
    askToSaveComposerDraft();
  }, [routeType]);

  useEffect(() => {
    composerEditOpenRequestRef.current += 1;
  }, [routeType, route?.mainPostId, route?.targetSubPostId]);

  useEffect(() => {
    const hasUnsavedDraft = hasUnsavedComposerDraft() || hasUnsavedComposerEdit();
    if (!shouldProtectComposerDraftUnload({ routeType, hasUnsavedDraft })) {
      return undefined;
    }
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    routeType,
    editingMainPostId,
    title,
    content,
    tagEditor.composerTags,
    tagEditor.composerTagDraft,
    mediaDraft.composerMediaAssets,
    mediaDraft.composerMediaUrls,
  ]);

  useEffect(() => {
    if (!composeCommunityMenuOpen) {
      return;
    }
    const close = () => setComposeCommunityMenuOpen(false);
    const onPointerDown = (event) => {
      const target = event.target;
      if (!composeCommunityMenuRef.current?.contains(target)) {
        close();
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [composeCommunityMenuOpen]);

  useEffect(() => {
    if (routeType !== "compose" || isTitlePreviewMode) {
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      const input = composerTitleInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [routeType, isTitlePreviewMode]);

  useEffect(() => {
    if (routeType !== "compose") {
      return;
    }
    resizeComposerContentElement(composerContentRef.current);
  }, [routeType, content, composerMode]);

  function resetComposerForm() {
    clearComposerFormState();
  }

  async function updateExistingPost(mainPostId, payload) {
    return updateContentMainPost(client, {
      token,
      mainPostId,
      title: payload.title,
      content: payload.content,
      postMode: payload.postMode,
      mediaAssetIds: payload.mediaAssetIds,
      tags: payload.tags,
    });
  }

  async function submitPost(event) {
    event.preventDefault();
    setMessage("");
    clearComposerSubmitFeedback();
    const normalizedTitle = title.trim();
    const isEditing = Boolean(editingMainPostId);
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    const {
      normalizedTagItems,
      normalizedTags,
      validationMessage,
    } = tagEditor.resolveComposerTags();
    const submitValidation = buildComposerSubmitValidation({
      title,
      communitySlug: composerCommunitySlug,
      uploadingAssets: mediaDraft.uploadingAssets,
      composerMode,
      composerMediaUrls: mediaDraft.composerMediaUrls,
      content,
      composerMediaAssets: mediaDraft.composerMediaAssets,
      tagValidationMessage: validationMessage,
    });
    if (submitValidation.message) {
      showComposerValidationMessage(
        submitValidation.message,
        submitValidation.target,
      );
      return;
    }
    if (tagEditor.composerTagDraft.trim()) {
      tagEditor.syncResolvedComposerTags(normalizedTagItems);
    }
    const requestContextKey = buildComposerSubmitContextKey({
      routeType,
      editingMainPostId,
    });
    const requestId = composerSubmitRequestRef.current + 1;
    composerSubmitRequestRef.current = requestId;
    setPublishing(true);
    setSubmitError("");
    try {
      const payload = buildComposerSubmitPayload({
        communitySlug: composerCommunitySlug,
        title: normalizedTitle,
        content,
        composerMode,
        composerMediaAssets: mediaDraft.composerMediaAssets,
        tags: normalizedTags,
      });
      let savedPost;
      if (isEditing) {
        savedPost = await updateExistingPost(editingMainPostId, payload);
      } else {
        savedPost = await createContentMainPost(client, {
          token,
          communitySlug: payload.communitySlug,
          title: payload.title,
          content: payload.content,
          postMode: payload.postMode,
          mediaAssetIds: payload.mediaAssetIds,
          tags: payload.tags,
        });
      }
      if (!shouldApplyCurrentComposerSubmitResult({ requestContextKey, requestId })) {
        return;
      }
      const resolvedSavedTags = Array.isArray(savedPost?.tags) ? savedPost.tags : normalizedTags;
      const normalizedSavedPost = normalizePostPayload({
        ...savedPost,
        tags: resolvedSavedTags,
      }, apiBase);
      const mutationStrategy = buildSavedMainPostMutationStrategy({
        savedPost: normalizedSavedPost,
        feedQueryState,
      });
      await mainPostMutationInterface.executeMainPostMutationStrategy(mutationStrategy);
      if (!shouldApplyCurrentComposerSubmitResult({ requestContextKey, requestId })) {
        return;
      }
      onMainPostSaved?.(normalizedSavedPost);
      suppressLeavePromptRef.current = true;
      clearSavedComposerDraft();
      resetComposerForm();
      navigateToHome(setRoute);
      setView("latest");
      setMessage(isEditing ? UI_MESSAGES.mainPostUpdated : UI_MESSAGES.mainPostCreated);
    } catch (error) {
      if (!shouldApplyCurrentComposerSubmitResult({ requestContextKey, requestId })) {
        return;
      }
      const errorMessage = readableError(
        error,
        isEditing ? UI_MESSAGES.mainPostUpdateFailed : UI_MESSAGES.mainPostCreateFailed,
      );
      const savedDraftAfterFailure = shouldAutoSaveComposerDraftAfterSubmitFailure({
        isEditing,
        hasUnsavedDraft: hasUnsavedComposerDraft(),
      }) && trySaveComposerDraftSnapshot();
      const nextErrorMessage = savedDraftAfterFailure
        ? `${errorMessage} 已自动保存为草稿。`
        : errorMessage;
      setSubmitError(nextErrorMessage);
      setMessage(nextErrorMessage);
    } finally {
      if (shouldApplyCurrentComposerSubmitResult({ requestContextKey, requestId })) {
        setPublishing(false);
      }
    }
  }

  async function closeComposerPage() {
    if (!(await confirmComposerNavigationLeave())) {
      return;
    }
    navigateToHome(setRoute);
  }

  async function openComposer() {
    composerEditOpenRequestRef.current += 1;
    if (routeType === "compose") {
      await closeComposerPage();
      return;
    }
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    const defaultCommunity = resolveDefaultComposerCommunitySlug({
      selectedCommunitySlug,
      orderedCommunities,
    });
    const savedDraft = readSavedComposerDraft();
    const canRestoreSavedDraft = shouldRestoreSavedComposerDraft({ savedDraft, currentUser });
    if (savedDraft && !canRestoreSavedDraft) {
      clearSavedComposerDraft();
    }
    if (canRestoreSavedDraft) {
      const restoreResult = applySavedComposerDraft(savedDraft);
      if (!restoreResult) {
        return;
      }
      setView("latest");
      setMessage(buildComposerDraftRestoredMessage({
        savedAt: savedDraft.savedAt,
        droppedMediaCount: restoreResult.droppedMediaCount,
        missingMediaRefCount: restoreResult.missingMediaRefCount,
      }));
      navigateToCompose(setRoute);
      return;
    }
    setComposerCommunitySlug(defaultCommunity);
    setComposerMode("long");
    mediaDraft.resetComposerMediaDraft();
    tagEditor.resetComposerTagEditor();
    initialEditSnapshotRef.current = null;
    setTitle("");
    setContent("");
    setIsTitlePreviewMode(false);
    setComposeCommunityMenuOpen(false);
    setEditingMainPostId(null);
    setSubmitValidationMessage("");
    setSubmitValidationTarget("");
    setSubmitError("");
    setView("latest");
    navigateToCompose(setRoute);
  }

  async function openEditComposer(post) {
    if (!isLoggedIn) {
      notifyAuthRequired({ setMessage, onAuthRequired });
      return;
    }
    if (!post || post.author !== currentUser) {
      setMessage(UI_MESSAGES.onlyAuthorCanEdit);
      return;
    }
    const requestContextKey = buildComposerEditOpenContextKey({
      routeType,
      mainPostId: route?.mainPostId,
      targetSubPostId: route?.targetSubPostId,
      editingMainPostId,
      postId: post.id,
    });
    const requestId = composerEditOpenRequestRef.current + 1;
    composerEditOpenRequestRef.current = requestId;
    try {
      const editingPost =
        post.contentLoaded || typeof mainPostMutationInterface.loadMainPostDetail !== "function"
          ? post
          : await mainPostMutationInterface.loadMainPostDetail(post.id);
      if (!shouldApplyCurrentComposerEditOpenResult({
        requestContextKey,
        requestId,
        postId: post.id,
      })) {
        return;
      }
      const nextCommunitySlug = resolveEditComposerCommunitySlug({
        orderedCommunities,
        communitySlug: editingPost.communitySlug,
      });
      const nextComposerMode = normalizePostModeValue(editingPost.postMode);
      initialEditSnapshotRef.current = buildComposerEditSnapshot({
        title: editingPost.title || "",
        content: editingPost.content || "",
        communitySlug: nextCommunitySlug,
        composerMode: nextComposerMode,
        composerTags: editingPost.tags,
        composerTagDraft: "",
        composerMediaAssets: editingPost.mediaAssets,
        composerMediaUrls: editingPost.mediaUrls,
      });
      setComposerCommunitySlug(nextCommunitySlug);
      setComposerMode(nextComposerMode);
      mediaDraft.hydrateComposerMediaDraft({
        mediaUrls: editingPost.mediaUrls,
        mediaAssets: editingPost.mediaAssets,
      });
      tagEditor.hydrateComposerTags(editingPost.tags);
      setTitle(editingPost.title || "");
      setContent(editingPost.content || "");
      setIsTitlePreviewMode(Boolean(editingPost.title || ""));
      setComposeCommunityMenuOpen(false);
      setEditingMainPostId(editingPost.id);
      setSubmitValidationMessage("");
      setSubmitValidationTarget("");
      setSubmitError("");
      setView("latest");
      navigateToCompose(setRoute);
    } catch (error) {
      if (!shouldApplyCurrentComposerEditOpenResult({
        requestContextKey,
        requestId,
        postId: post.id,
      })) {
        return;
      }
      setMessage(readableError(error, UI_MESSAGES.genericOperationFailed));
    }
  }

  function commitComposerTitlePreview() {
    setIsTitlePreviewMode(Boolean(title.trim()));
  }

  function editComposerTitle() {
    setIsTitlePreviewMode(false);
  }

  function handleComposerContentChange(event) {
    clearComposerSubmitFeedback();
    setContent(event.target.value);
    resizeComposerContentElement(event.target);
  }

  function cleanMissingMarkdownMediaRefs() {
    if (composerMode !== "long") {
      return;
    }
    const cleanupResult = removeMissingComposerMarkdownMediaRefs({
      content,
      composerMediaAssets: mediaDraft.composerMediaAssets,
    });
    if (cleanupResult.removedCount <= 0) {
      return;
    }
    clearComposerSubmitFeedback();
    setContent(cleanupResult.content);
    setMessage(
      cleanupResult.removedCount === 1
        ? "已清理 1 处失效图片引用。"
        : `已清理 ${cleanupResult.removedCount} 处失效图片引用。`,
    );
  }

  function restoreUnreferencedMarkdownMediaRefs() {
    if (composerMode !== "long") {
      return;
    }
    const unreferencedAssets = findUnreferencedComposerMarkdownMediaAssets({
      content,
      composerMediaAssets: mediaDraft.composerMediaAssets,
    });
    if (unreferencedAssets.length === 0) {
      return;
    }
    const insertSelection = getComposerContentInsertSelection();
    clearComposerSubmitFeedback();
    let insertedSelection = null;
    setContent((prev) => {
      const insertionResult = buildComposerMarkdownImageInsertion({
        content: prev,
        uploadedAssets: unreferencedAssets,
        insertSelection,
      });
      insertedSelection = {
        selectionStart: insertionResult.selectionStart,
        selectionEnd: insertionResult.selectionEnd,
      };
      return insertionResult.content;
    });
    if (insertedSelection) {
      focusComposerContentSelection(insertedSelection);
    }
    setMessage(
      unreferencedAssets.length === 1
        ? "已重新插入 1 张未引用图片。"
        : `已重新插入 ${unreferencedAssets.length} 张未引用图片。`,
    );
  }

  function handleComposerTitleChange(nextTitle) {
    clearComposerSubmitFeedback();
    setTitle(nextTitle);
  }

  function setComposerCommunitySlugAndCloseTags(slug) {
    clearComposerSubmitFeedback();
    tagEditor.closeComposerTagEditor();
    setComposerCommunitySlug(slug);
  }

  function setComposeCommunityMenuOpenAndCloseTags(nextValue) {
    tagEditor.closeComposerTagEditor();
    setComposeCommunityMenuOpen(nextValue);
  }

  function setComposerModeAndCloseTags(nextMode) {
    clearComposerSubmitFeedback();
    tagEditor.closeComposerTagEditor();
    const normalizedMode = normalizePostModeValue(nextMode);
    setComposerMode((currentMode) => {
      if (currentMode !== normalizedMode) {
        setContent((currentContent) => buildComposerModeSwitchContent({
          currentMode,
          nextMode: normalizedMode,
          content: currentContent,
          composerMediaAssets: mediaDraft.composerMediaAssets,
        }));
      }
      return normalizedMode;
    });
  }

  function handleComposerAssetPickedAndCloseTags(event) {
    clearComposerSubmitFeedback();
    tagEditor.closeComposerTagEditor();
    mediaDraft.onComposerAssetPicked(event);
  }

  function setComposerTagDraftAndClearFeedback(nextValue) {
    clearComposerSubmitFeedback();
    tagEditor.setComposerTagDraft(nextValue);
  }

  return {
    composerCommunityName,
    composerCommunitySlug,
    composerMode,
    composerMediaUrls: mediaDraft.composerMediaUrls,
    composerMediaAssets: mediaDraft.composerMediaAssets,
    editingMainPostId,
    title,
    content,
    publishing,
    composerSubmitStatus: buildComposerSubmitStatus({
      publishing,
      validationMessage: submitValidationMessage,
      validationTarget: submitValidationTarget,
      submitError,
      isEditing: Boolean(editingMainPostId),
    }),
    composerUploadStatus: mediaDraft.composerUploadStatus,
    uploadingAssets: mediaDraft.uploadingAssets,
    composerTags: tagEditor.composerTags,
    composerTagDraft: tagEditor.composerTagDraft,
    showTagEditor: tagEditor.showTagEditor,
    isTitlePreviewMode,
    composeCommunityMenuOpen,
    composerMediaIndex: mediaDraft.composerMediaIndex,
    setTitle: handleComposerTitleChange,
    setComposerCommunitySlug: setComposerCommunitySlugAndCloseTags,
    setComposeCommunityMenuOpen: setComposeCommunityMenuOpenAndCloseTags,
    setComposerMode: setComposerModeAndCloseTags,
    setComposerTagDraft: setComposerTagDraftAndClearFeedback,
    setComposerMediaIndex: mediaDraft.setComposerMediaIndex,
    resetComposerForm,
    submitPost,
    openComposer,
    confirmComposerNavigationLeave,
    openEditComposer,
    commitComposerTitlePreview,
    editComposerTitle,
    addComposerTag: tagEditor.addComposerTag,
    removeComposerTag: tagEditor.removeComposerTag,
    toggleComposerTagEditor: tagEditor.toggleComposerTagEditor,
    handleComposerTagInputKeyDown: tagEditor.handleComposerTagInputKeyDown,
    handleComposerContentChange,
    cleanMissingMarkdownMediaRefs,
    restoreUnreferencedMarkdownMediaRefs,
    removeComposerMediaAt: mediaDraft.removeComposerMediaAt,
    moveComposerMedia: mediaDraft.moveComposerMedia,
    closeComposerTagEditor: tagEditor.closeComposerTagEditor,
    onComposerAssetPicked: handleComposerAssetPickedAndCloseTags,
    retryFailedComposerUploads: mediaDraft.retryFailedComposerUploads,
    composerTitleInputRef,
    composerTagInputRef: tagEditor.composerTagInputRef,
    composerContentRef,
    composeCommunityMenuRef,
  };
}
