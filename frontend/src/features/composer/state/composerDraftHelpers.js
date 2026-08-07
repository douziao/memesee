import {
  extractMarkdownMediaAssetIds,
  parseMediaReference,
  removeExternalMarkdownImages,
  removeMarkdownImages,
} from "../../../shared/media/markdownContent";
import {
  normalizeTagItems,
  parseTagInput,
} from "../../../shared/state/appHelpers";
import { UI_MESSAGES } from "../../../shared/state/uiMessages";
import { shouldReloadFeedAfterMainPostUpsert } from "../../feed/state/feedQueryStateHelpers";

const MAX_COMPOSER_TAG_COUNT = 3;
const MAX_COMPOSER_TAG_TOTAL_LENGTH = 12;
const COMPOSER_TAG_SUBMIT_KEYS = new Set(["Enter", ",", "\uFF0C"]);
const COMPOSER_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function hasComposerDraftContent({
  title,
  content,
  composerTags,
  composerTagDraft,
  composerMediaUrls,
}) {
  return Boolean(
    String(title || "").trim() ||
    String(content || "").trim() ||
    String(composerTagDraft || "").trim() ||
    composerTags?.length ||
    composerMediaUrls?.length,
  );
}

export function shouldProtectComposerDraftUnload({ routeType, hasUnsavedDraft }) {
  return routeType === "compose" && Boolean(hasUnsavedDraft);
}

export function shouldConfirmComposerNavigationLeave({
  routeType,
  hasUnsavedDraft,
  hasUnsavedEdit,
}) {
  return routeType === "compose" && (Boolean(hasUnsavedDraft) || Boolean(hasUnsavedEdit));
}

export function shouldAutoSaveComposerDraftAfterSubmitFailure({
  isEditing,
  hasUnsavedDraft,
}) {
  return !isEditing && Boolean(hasUnsavedDraft);
}

function normalizeComposerSubmitEditId(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) && number > 0 ? String(number) : "new";
}

function normalizeComposerPositiveId(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) && number > 0 ? String(number) : "0";
}

export function buildComposerSubmitContextKey({
  routeType,
  editingMainPostId,
} = {}) {
  if (routeType !== "compose") {
    return "";
  }
  return `compose:${normalizeComposerSubmitEditId(editingMainPostId)}`;
}

export function shouldApplyComposerSubmitResult({
  requestContextKey,
  currentRouteType,
  currentEditingMainPostId,
  requestId,
  currentRequestId,
} = {}) {
  return Boolean(requestContextKey)
    && Number(requestId || 0) === Number(currentRequestId || 0)
    && requestContextKey === buildComposerSubmitContextKey({
      routeType: currentRouteType,
      editingMainPostId: currentEditingMainPostId,
    });
}

export function buildComposerEditOpenContextKey({
  routeType,
  mainPostId,
  targetSubPostId,
  editingMainPostId,
  postId,
} = {}) {
  const normalizedPostId = normalizeComposerPositiveId(postId);
  if (normalizedPostId === "0") {
    return "";
  }
  return [
    "edit-open",
    routeType || "",
    routeType === "post" ? normalizeComposerPositiveId(mainPostId) : "0",
    routeType === "post" ? normalizeComposerPositiveId(targetSubPostId) : "0",
    normalizeComposerSubmitEditId(editingMainPostId),
    normalizedPostId,
  ].join(":");
}

export function shouldApplyComposerEditOpenResult({
  requestContextKey,
  currentRouteType,
  currentMainPostId,
  currentTargetSubPostId,
  currentEditingMainPostId,
  postId,
  requestId,
  currentRequestId,
} = {}) {
  return Boolean(requestContextKey)
    && Number(requestId || 0) === Number(currentRequestId || 0)
    && requestContextKey === buildComposerEditOpenContextKey({
      routeType: currentRouteType,
      mainPostId: currentMainPostId,
      targetSubPostId: currentTargetSubPostId,
      editingMainPostId: currentEditingMainPostId,
      postId,
    });
}

export function buildComposerUploadContextKey({
  routeType,
  editingMainPostId,
  composerMode,
  composerCommunitySlug,
} = {}) {
  if (routeType !== "compose") {
    return "";
  }
  return [
    "upload",
    normalizeComposerSubmitEditId(editingMainPostId),
    composerMode === "rich" ? "rich" : "long",
    String(composerCommunitySlug || "").trim() || "no-community",
  ].join(":");
}

export function shouldApplyComposerUploadResult({
  requestContextKey,
  currentRouteType,
  currentEditingMainPostId,
  currentComposerMode,
  currentComposerCommunitySlug,
  requestId,
  currentRequestId,
} = {}) {
  return Boolean(requestContextKey)
    && Number(requestId || 0) === Number(currentRequestId || 0)
    && requestContextKey === buildComposerUploadContextKey({
      routeType: currentRouteType,
      editingMainPostId: currentEditingMainPostId,
      composerMode: currentComposerMode,
      composerCommunitySlug: currentComposerCommunitySlug,
    });
}

export function shouldResetComposerUploadFeedback({
  previousContextKey,
  nextContextKey,
} = {}) {
  return String(previousContextKey || "") !== String(nextContextKey || "");
}

function normalizeComposerDraftOwner(value) {
  return String(value || "").trim();
}

function parseComposerDraftSavedAt(value) {
  return Date.parse(value) || 0;
}

export function shouldRestoreSavedComposerDraft({
  savedDraft,
  currentUser,
  now = Date.now(),
  maxAgeMs = COMPOSER_DRAFT_MAX_AGE_MS,
}) {
  if (!savedDraft || typeof savedDraft !== "object") {
    return false;
  }
  const ownerUsername = normalizeComposerDraftOwner(savedDraft.ownerUsername);
  const activeUsername = normalizeComposerDraftOwner(currentUser);
  const savedAtTime = parseComposerDraftSavedAt(savedDraft.savedAt);
  const currentTime = Number(now);
  const draftAge = currentTime - savedAtTime;
  return Boolean(
    ownerUsername &&
    activeUsername &&
    ownerUsername === activeUsername &&
    savedAtTime > 0 &&
    Number.isFinite(currentTime) &&
    draftAge >= 0 &&
    draftAge <= maxAgeMs,
  );
}

export function buildComposerDraftRestoredMessage({
  savedAt,
  droppedMediaCount = 0,
  missingMediaRefCount = 0,
  now = Date.now(),
}) {
  const droppedMediaText = Number(droppedMediaCount || 0) > 0
    ? ` 已忽略 ${Number(droppedMediaCount || 0)} 张不可用图片。`
    : "";
  const missingMediaRefText = Number(missingMediaRefCount || 0) > 0
    ? ` 正文中有 ${Number(missingMediaRefCount || 0)} 处图片引用需要处理。`
    : "";
  const extraText = `${droppedMediaText}${missingMediaRefText}`;
  const savedAtTime = parseComposerDraftSavedAt(savedAt);
  const currentTime = Number(now);
  if (!savedAtTime || !Number.isFinite(currentTime) || currentTime < savedAtTime) {
    return `已恢复保存的草稿。${extraText}`;
  }
  const elapsedMinutes = Math.floor((currentTime - savedAtTime) / 60000);
  if (elapsedMinutes < 1) {
    return `已恢复刚刚保存的草稿。${extraText}`;
  }
  if (elapsedMinutes < 60) {
    return `已恢复 ${elapsedMinutes} 分钟前保存的草稿。${extraText}`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `已恢复 ${elapsedHours} 小时前保存的草稿。${extraText}`;
  }
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `已恢复 ${elapsedDays} 天前保存的草稿。${extraText}`;
}

export function buildComposerDraftRestoreValidationState({
  composerMode,
  content,
  composerMediaAssets,
}) {
  if (composerMode !== "long") {
    return {
      message: "",
      target: "",
      missingMediaRefCount: 0,
    };
  }
  const missingMediaRefs = findMissingComposerMarkdownMediaRefs({
    content,
    composerMediaAssets,
  });
  const message = buildComposerMarkdownMediaValidationMessage(missingMediaRefs);
  return {
    message,
    target: message ? "content" : "",
    missingMediaRefCount: missingMediaRefs.length,
  };
}

function normalizeComposerModeForSnapshot(value) {
  return value === "rich" ? "rich" : "long";
}

function normalizeComposerMediaRefs({ composerMediaAssets, composerMediaUrls }) {
  const refs = [];
  for (const asset of Array.isArray(composerMediaAssets) ? composerMediaAssets : []) {
    const assetId = Number(asset?.id || 0);
    const publicId = String(asset?.publicId || "").trim();
    const url = String(asset?.url || "").trim();
    refs.push(assetId > 0 ? `asset:${assetId}` : `asset:${publicId || url}`);
  }
  if (refs.length > 0) {
    return refs;
  }
  return (Array.isArray(composerMediaUrls) ? composerMediaUrls : [])
    .map((url) => String(url || "").trim())
    .filter(Boolean)
    .map((url) => `url:${url}`);
}

export function buildComposerEditSnapshot({
  title,
  content,
  communitySlug,
  composerMode,
  composerTags,
  composerTagDraft,
  composerMediaAssets,
  composerMediaUrls,
}) {
  return {
    title: String(title || ""),
    content: String(content || ""),
    communitySlug: String(communitySlug || ""),
    composerMode: normalizeComposerModeForSnapshot(composerMode),
    tags: normalizeTagItems([
      ...(Array.isArray(composerTags) ? composerTags : []),
      ...normalizeTagItems(composerTagDraft),
    ]),
    mediaRefs: normalizeComposerMediaRefs({ composerMediaAssets, composerMediaUrls }),
  };
}

export function hasComposerEditChanges(initialSnapshot, currentSnapshot) {
  if (!initialSnapshot || !currentSnapshot) {
    return false;
  }
  return JSON.stringify(initialSnapshot) !== JSON.stringify(currentSnapshot);
}

export function buildComposerModeSwitchContent({
  currentMode,
  nextMode,
  content,
  composerMediaAssets,
} = {}) {
  const normalizedCurrentMode = currentMode === "rich" ? "rich" : "long";
  const normalizedNextMode = nextMode === "rich" ? "rich" : "long";
  const currentContent = String(content || "");
  if (normalizedCurrentMode === normalizedNextMode) {
    return currentContent;
  }
  return normalizedNextMode === "rich"
    ? removeMarkdownImages(currentContent)
    : buildComposerMarkdownImageInsertion({
      content: currentContent,
      uploadedAssets: composerMediaAssets,
    }).content;
}

export function buildComposerTagState(composerTags, composerTagDraft) {
  const normalizedTagItems = normalizeTagItems([
    ...(Array.isArray(composerTags) ? composerTags : []),
    ...normalizeTagItems(composerTagDraft),
  ]);

  return {
    normalizedTagItems,
    normalizedTags: parseTagInput(normalizedTagItems),
    validationMessage: validateComposerTags(normalizedTagItems),
  };
}

export function validateComposerTags(tagItems) {
  if (tagItems.length > MAX_COMPOSER_TAG_COUNT) {
    return "TAG \u6700\u591A 3 \u4E2A\uFF0C\u4E0D\u80FD\u7EE7\u7EED\u6DFB\u52A0\u3002";
  }

  const totalLength = tagItems.reduce((sum, item) => sum + item.length, 0);
  if (totalLength > MAX_COMPOSER_TAG_TOTAL_LENGTH) {
    return "TAG \u603B\u957F\u5EA6\u4E0D\u80FD\u8D85\u8FC7 12 \u4E2A\u5B57\u7B26\u3002";
  }

  return "";
}

export function buildComposerSubmitPayload({
  communitySlug,
  title,
  content,
  composerMode,
  composerMediaAssets,
  tags,
}) {
  const baseMediaAssetIds = (Array.isArray(composerMediaAssets) ? composerMediaAssets : [])
    .map((asset) => Number(asset?.id || 0))
    .filter((assetId) => assetId > 0);
  const mediaAssetIds = composerMode === "long"
    ? resolveReferencedComposerMarkdownMediaAssetIds({
      content,
      composerMediaAssets,
    })
    : baseMediaAssetIds;

  return {
    communitySlug,
    title,
    content: composerMode === "long"
      ? removeExternalMarkdownImages(content)
      : removeMarkdownImages(content),
    postMode: composerMode === "rich" ? "rich" : "long",
    mediaAssetIds,
    tags,
  };
}

function resolveReferencedComposerMarkdownMediaAssetIds({
  content,
  composerMediaAssets,
}) {
  const markdownMediaRefs = new Set(extractComposerMarkdownMediaRefs(content));
  const referencedAssetIds = [];
  const seenAssetIds = new Set();
  for (const asset of Array.isArray(composerMediaAssets) ? composerMediaAssets : []) {
    const assetId = Number(asset?.id || 0);
    if (assetId <= 0 || seenAssetIds.has(assetId)) {
      continue;
    }
    const publicId = String(asset?.publicId || "").trim();
    if (markdownMediaRefs.has(String(assetId)) || (publicId && markdownMediaRefs.has(publicId))) {
      seenAssetIds.add(assetId);
      referencedAssetIds.push(assetId);
    }
  }
  for (const assetId of extractMarkdownMediaAssetIds(content)) {
    if (!seenAssetIds.has(assetId)) {
      seenAssetIds.add(assetId);
      referencedAssetIds.push(assetId);
    }
  }
  return referencedAssetIds;
}


export function buildComposerMarkdownImage(asset) {
  const assetId = Number(asset?.id || 0);
  const mediaRef = String(asset?.publicId || "").trim() || String(assetId || "");
  if (!mediaRef || assetId <= 0) {
    return "";
  }
  const rawName = String(asset?.originalFilename || "图片")
    .replace(/[\[\]\n\r|]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "图片";
  return `![${rawName}](media:${mediaRef})`;
}

function normalizeComposerMarkdownInsertRange(contentLength, insertSelection) {
  const selectionStart = Number(insertSelection?.selectionStart);
  const selectionEnd = Number(insertSelection?.selectionEnd);
  if (
    !Number.isInteger(selectionStart) ||
    !Number.isInteger(selectionEnd) ||
    selectionStart < 0 ||
    selectionEnd < selectionStart ||
    selectionStart > contentLength
  ) {
    return null;
  }
  return {
    selectionStart,
    selectionEnd: Math.min(selectionEnd, contentLength),
  };
}

function insertComposerMarkdownBlockAtRange(content, markdownBlock, insertRange) {
  if (!insertRange) {
    const base = content.trimEnd();
    const prefix = base ? "\n" : "";
    const nextContent = `${base}${prefix}${markdownBlock}`;
    const cursorPosition = base.length + prefix.length + markdownBlock.length;
    return {
      content: nextContent,
      selectionStart: cursorPosition,
      selectionEnd: cursorPosition,
    };
  }
  const before = content.slice(0, insertRange.selectionStart);
  const after = content.slice(insertRange.selectionEnd);
  const normalizedBefore = before.replace(/[ \t]+$/, "");
  const prefix = normalizedBefore && !normalizedBefore.endsWith("\n") ? "\n" : "";
  const normalizedAfter = after.startsWith("\n") && markdownBlock.endsWith("\n")
    ? after.slice(1)
    : after;
  const cursorPosition = normalizedBefore.length + prefix.length + markdownBlock.length;
  return {
    content: `${normalizedBefore}${prefix}${markdownBlock}${normalizedAfter}`,
    selectionStart: cursorPosition,
    selectionEnd: cursorPosition,
  };
}

export function buildComposerMarkdownImageInsertion({
  content,
  uploadedAssets,
  insertSelection = null,
}) {
  const blocks = (Array.isArray(uploadedAssets) ? uploadedAssets : [])
    .map(buildComposerMarkdownImage)
    .filter(Boolean);
  if (blocks.length === 0) {
    const fallbackContent = content || "";
    const cursorPosition = String(fallbackContent).length;
    return {
      content: fallbackContent,
      selectionStart: cursorPosition,
      selectionEnd: cursorPosition,
    };
  }
  const baseContent = String(content || "");
  const insertRange = normalizeComposerMarkdownInsertRange(
    baseContent.length,
    insertSelection,
  );
  return insertComposerMarkdownBlockAtRange(baseContent, `${blocks.join("\n")}\n`, insertRange);
}

export function appendComposerMarkdownImages(content, uploadedAssets, insertSelection = null) {
  return buildComposerMarkdownImageInsertion({
    content,
    uploadedAssets,
    insertSelection,
  }).content;
}

export function extractComposerMarkdownMediaRefs(content) {
  const refs = [];
  const seen = new Set();
  const markdownRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = markdownRegex.exec(String(content || ""))) !== null) {
    const mediaReference = parseMediaReference(match[1]);
    if (!mediaReference) {
      continue;
    }
    const ref = String(mediaReference.ref || "").trim();
    if (!ref || seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

function buildComposerMediaAssetRefSet(composerMediaAssets) {
  const refs = new Set();
  for (const asset of Array.isArray(composerMediaAssets) ? composerMediaAssets : []) {
    const assetId = Number(asset?.id || 0);
    const publicId = String(asset?.publicId || "").trim();
    if (assetId > 0) {
      refs.add(String(assetId));
    }
    if (publicId) {
      refs.add(publicId);
    }
  }
  return refs;
}

export function findMissingComposerMarkdownMediaRefs({
  content,
  composerMediaAssets,
}) {
  const availableRefs = buildComposerMediaAssetRefSet(composerMediaAssets);
  return extractComposerMarkdownMediaRefs(content)
    .filter((ref) => !availableRefs.has(ref));
}

export function findUnreferencedComposerMarkdownMediaAssets({
  content,
  composerMediaAssets,
}) {
  const markdownRefs = new Set(extractComposerMarkdownMediaRefs(content));
  return (Array.isArray(composerMediaAssets) ? composerMediaAssets : [])
    .filter((asset) => {
      const assetId = Number(asset?.id || 0);
      if (assetId <= 0) {
        return false;
      }
      const publicId = String(asset?.publicId || "").trim();
      return !markdownRefs.has(String(assetId)) && (!publicId || !markdownRefs.has(publicId));
    });
}

export function findFirstMissingComposerMarkdownMediaRange({
  content,
  composerMediaAssets,
}) {
  const availableRefs = buildComposerMediaAssetRefSet(composerMediaAssets);
  const markdownRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = markdownRegex.exec(String(content || ""))) !== null) {
    const mediaReference = parseMediaReference(match[1]);
    const ref = String(mediaReference?.ref || "").trim();
    if (!ref || availableRefs.has(ref)) {
      continue;
    }
    return {
      ref,
      selectionStart: match.index,
      selectionEnd: markdownRegex.lastIndex,
    };
  }
  return null;
}

export function removeMissingComposerMarkdownMediaRefs({
  content,
  composerMediaAssets,
}) {
  const availableRefs = buildComposerMediaAssetRefSet(composerMediaAssets);
  let removedCount = 0;
  const replaceMissingImages = (line) => {
    let removedLineImage = false;
    const nextLine = String(line || "").replace(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (imageMarkdown, imageUrl) => {
      const mediaReference = parseMediaReference(imageUrl);
      const ref = String(mediaReference?.ref || "").trim();
      if (!ref || availableRefs.has(ref)) {
        return imageMarkdown;
      }
      removedCount += 1;
      removedLineImage = true;
      return "";
    });
    if (removedLineImage && !nextLine.trim()) {
      return null;
    }
    return nextLine;
  };
  const nextContent = String(content || "")
    .split("\n")
    .map((line) => replaceMissingImages(line))
    .filter((line) => line !== null)
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    content: nextContent,
    removedCount,
  };
}

export function buildComposerMarkdownMediaValidationMessage(missingRefs) {
  const count = Array.isArray(missingRefs) ? missingRefs.length : 0;
  if (count <= 0) {
    return "";
  }
  return count === 1
    ? "正文中有 1 张图片已不在当前草稿中，请删除对应的 media 图片引用或重新上传。"
    : `正文中有 ${count} 张图片已不在当前草稿中，请删除对应的 media 图片引用或重新上传。`;
}

export function shouldRefreshComposerFeed({
  searchQuery,
  selectedCommunitySlug,
  postCommunitySlug,
}) {
  return shouldReloadFeedAfterMainPostUpsert(
    { searchQuery, selectedCommunitySlug },
    postCommunitySlug,
  );
}

export function buildComposerSubmitStatus({
  publishing,
  validationMessage,
  validationTarget,
  submitError,
  isEditing,
}) {
  if (publishing) {
    return {
      type: "saving",
      message: isEditing ? "正在保存修改..." : "正在发布主帖...",
    };
  }
  const validationText = String(validationMessage || "").trim();
  if (validationText) {
    return {
      type: "validation",
      message: validationText,
      focusTarget: String(validationTarget || "").trim(),
    };
  }
  const errorText = String(submitError || "").trim();
  if (errorText) {
    return {
      type: "error",
      message: `${errorText} 内容仍保留在编辑器中，可以修改后重试。`,
      canRetry: true,
      retryLabel: isEditing ? "重试保存" : "重试发布",
    };
  }
  return { type: "" };
}

export function buildComposerPendingUploadSubmitValidation({
  uploadingAssets,
}) {
  if (!uploadingAssets) {
    return {
      message: "",
      target: "",
    };
  }
  return {
    message: "图片仍在上传，请完成后再发布。",
    target: "media",
  };
}

export function buildComposerSubmitValidation({
  title,
  communitySlug,
  uploadingAssets,
  composerMode,
  composerMediaUrls,
  content,
  composerMediaAssets,
  tagValidationMessage,
}) {
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) {
    return {
      message: UI_MESSAGES.mainPostTitleRequired,
      target: "title",
    };
  }
  if (normalizedTitle.length > 30) {
    return {
      message: UI_MESSAGES.mainPostTitleTooLong,
      target: "title",
    };
  }
  if (!String(communitySlug || "").trim()) {
    return {
      message: UI_MESSAGES.communityRequired,
      target: "community",
    };
  }
  if (uploadingAssets) {
    return {
      message: "图片仍在上传，请完成后再发布。",
      target: "media",
    };
  }
  const normalizedMode = composerMode === "rich" ? "rich" : "long";
  const normalizedMediaDraft = normalizeComposerMediaDraft({
    mediaUrls: composerMediaUrls,
    mediaAssets: composerMediaAssets,
  });
  if (
    normalizedMode === "rich" &&
    normalizedMediaDraft.mediaUrls.length === 0
  ) {
    return {
      message: UI_MESSAGES.richMediaRequired,
      target: "media",
    };
  }
  if (normalizedMode === "long" && !String(content || "").trim()) {
    return {
      message: UI_MESSAGES.mainPostContentRequired,
      target: "content",
    };
  }
  if (normalizedMode === "long") {
    const missingMediaRefs = findMissingComposerMarkdownMediaRefs({
      content,
      composerMediaAssets,
    });
    const mediaValidationMessage = buildComposerMarkdownMediaValidationMessage(missingMediaRefs);
    if (mediaValidationMessage) {
      return {
        message: mediaValidationMessage,
        target: "content",
      };
    }
  }
  const tagValidationText = String(tagValidationMessage || "").trim();
  if (tagValidationText) {
    return {
      message: tagValidationText,
      target: "tag",
    };
  }
  return {
    message: "",
    target: "",
  };
}

export function resolveDefaultComposerCommunitySlug({
  selectedCommunitySlug,
  orderedCommunities,
}) {
  return selectedCommunitySlug && selectedCommunitySlug !== "lobby"
    ? selectedCommunitySlug
    : (orderedCommunities[0]?.slug || "");
}

export function resolveEditComposerCommunitySlug({
  orderedCommunities,
  communitySlug,
}) {
  const fallbackCommunitySlug = orderedCommunities[0]?.slug || "";
  const hasMatchingCommunity = orderedCommunities.some(
    (community) => community.slug === communitySlug,
  );

  return hasMatchingCommunity
    ? communitySlug
    : (communitySlug || fallbackCommunitySlug);
}

export function isComposerTagSubmitKey(key) {
  return COMPOSER_TAG_SUBMIT_KEYS.has(key);
}

export function resizeComposerContentElement(target) {
  if (!target) {
    return;
  }
  target.style.height = "auto";
  target.style.height = `${Math.max(120, target.scrollHeight)}px`;
}

export function removeIndexedItem(items, index) {
  if (!Array.isArray(items) || index < 0 || index >= items.length) {
    return items;
  }
  return items.filter((_, itemIndex) => itemIndex !== index);
}

export function moveIndexedItem(items, from, to) {
  if (
    !Array.isArray(items) ||
    items.length <= 1 ||
    to < 0 ||
    to >= items.length ||
    from < 0 ||
    from >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

export function resolveComposerMediaAssetUrl(asset, fallbackUrl = "") {
  return String(
    asset?.url ||
    asset?.displayUrl ||
    asset?.mediumUrl ||
    asset?.smallUrl ||
    asset?.thumbUrl ||
    asset?.originalUrl ||
    fallbackUrl ||
    "",
  ).trim();
}

export function isComposerMediaAssetSubmitReady(asset) {
  return Number(asset?.id || 0) > 0;
}

export function isComposerMediaAssetRefreshPending(asset) {
  const assetId = Number(asset?.id || 0);
  if (assetId <= 0) {
    return false;
  }
  const processingStatus = String(asset?.processingStatus || "").toUpperCase();
  return processingStatus === "PROCESSING";
}

export function buildComposerMediaUrlsFromAssets(mediaAssets, fallbackUrls = []) {
  return (Array.isArray(mediaAssets) ? mediaAssets : [])
    .map((asset, index) => resolveComposerMediaAssetUrl(asset, fallbackUrls[index]))
    .slice(0, 20);
}

export function mergeComposerRefreshedMediaAssets(existingAssets, refreshedAssets) {
  if (!Array.isArray(existingAssets) || existingAssets.length === 0) {
    return [];
  }
  const refreshedById = new Map(
    (Array.isArray(refreshedAssets) ? refreshedAssets : [])
      .map((asset) => [Number(asset?.id || 0), asset])
      .filter(([assetId, asset]) => assetId > 0 && asset),
  );
  if (refreshedById.size === 0) {
    return existingAssets;
  }
  let changed = false;
  const nextAssets = existingAssets.map((asset) => {
    const assetId = Number(asset?.id || 0);
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
  return changed ? nextAssets : existingAssets;
}

export function normalizeComposerMediaDraft({ mediaUrls, mediaAssets }) {
  const normalizedMediaAssets = [];
  const normalizedMediaUrls = [];
  const seenAssetIds = new Set();
  const rawMediaUrls = Array.isArray(mediaUrls) ? mediaUrls : [];
  const rawMediaAssets = Array.isArray(mediaAssets) ? mediaAssets : [];
  let droppedCount = Math.max(0, rawMediaUrls.length - rawMediaAssets.length);
  for (const [index, asset] of rawMediaAssets.entries()) {
    if (normalizedMediaAssets.length >= 20) {
      droppedCount += 1;
      continue;
    }
    const assetId = Number(asset?.id || 0);
    if (assetId <= 0 || seenAssetIds.has(assetId)) {
      droppedCount += 1;
      continue;
    }
    const mediaUrl = resolveComposerMediaAssetUrl(asset, rawMediaUrls[index]);
    seenAssetIds.add(assetId);
    const normalizedAsset = {
      ...asset,
    };
    if (mediaUrl) {
      normalizedAsset.url = asset?.url || mediaUrl;
      normalizedAsset.displayUrl = asset?.displayUrl || mediaUrl;
    } else if (!asset?.processingStatus) {
      normalizedAsset.processingStatus = "PROCESSING";
    }
    normalizedMediaAssets.push(normalizedAsset);
    normalizedMediaUrls.push(mediaUrl);
  }
  return {
    mediaUrls: normalizedMediaUrls,
    mediaAssets: normalizedMediaAssets,
    droppedCount,
  };
}

export function getNextComposerMediaIndex(currentIndex, removedIndex, mediaCount) {
  const nextLength = Math.max(0, Number(mediaCount || 0) - 1);
  if (nextLength === 0) {
    return 0;
  }
  if (currentIndex > removedIndex) {
    return currentIndex - 1;
  }
  return Math.min(currentIndex, nextLength - 1);
}

export function mergeComposerMediaAssets(existingAssets, uploadedAssets) {
  const merged = Array.isArray(existingAssets) ? [...existingAssets] : [];
  for (const asset of Array.isArray(uploadedAssets) ? uploadedAssets : []) {
    if (
      isComposerMediaAssetSubmitReady(asset) &&
      !merged.some((item) => Number(item?.id || 0) === Number(asset?.id || 0))
    ) {
      merged.push(asset);
    }
  }
  return merged.slice(0, 20);
}

export function mergeComposerMediaUrls(existingUrls, uploadedAssets, existingAssets = []) {
  const merged = Array.isArray(existingUrls) ? [...existingUrls] : [];
  const seenAssetIds = new Set(
    (Array.isArray(existingAssets) ? existingAssets : [])
      .map((asset) => Number(asset?.id || 0))
      .filter((assetId) => assetId > 0),
  );
  for (const asset of Array.isArray(uploadedAssets) ? uploadedAssets : []) {
    const assetId = Number(asset?.id || 0);
    const mediaUrl = resolveComposerMediaAssetUrl(asset);
    if (
      isComposerMediaAssetSubmitReady(asset) &&
      !seenAssetIds.has(assetId) &&
      (!mediaUrl || !merged.includes(mediaUrl))
    ) {
      seenAssetIds.add(assetId);
      merged.push(mediaUrl);
    }
  }
  return merged.slice(0, 20);
}

function normalizeNonNegativeFiniteCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

export function limitComposerUploadFilesByMediaCapacity({
  imageFiles,
  existingMediaCount,
  skippedCount = 0,
}) {
  const files = Array.isArray(imageFiles) ? imageFiles : [];
  const normalizedExistingCount = normalizeNonNegativeFiniteCount(existingMediaCount);
  const normalizedSkippedCount = normalizeNonNegativeFiniteCount(skippedCount);
  const slots = Math.max(0, 20 - normalizedExistingCount);
  return {
    imageFiles: files.slice(0, slots),
    skippedCount: normalizedSkippedCount + Math.max(0, files.length - slots),
  };
}

export function buildComposerUploadMessage({ imageCount, skippedCount, failedCount }) {
  const summary = [];
  if (imageCount > 0) {
    summary.push(`\u4E0A\u4F20 ${imageCount} \u5F20\u56FE\u7247`);
  }
  if (skippedCount > 0) {
    summary.push(`\u8DF3\u8FC7 ${skippedCount} \u4E2A\u65E0\u6548/\u8D85\u9650`);
  }
  const normalizedFailedCount = Number(failedCount || 0);
  if (normalizedFailedCount > 0) {
    summary.push(`\u5931\u8D25 ${normalizedFailedCount} \u5F20`);
  }
  return summary.join("\uFF0C") || "\u4E0A\u4F20\u5B8C\u6210\u3002";
}

export function buildComposerUploadStatus({
  uploading,
  imageCount,
  skippedCount,
  failedCount,
  retryableFailedCount,
  errorMessage,
}) {
  if (uploading) {
    return {
      type: "uploading",
      message: "上传中...",
    };
  }
  const errorText = String(errorMessage || "").trim();
  if (errorText) {
    const retryableCount = Number(retryableFailedCount || 0);
    const status = {
      type: "error",
      message: retryableCount > 0
        ? `${errorText} 已上传的图片和正文草稿仍保留，可直接重试失败图片。`
        : `${errorText} 已上传的图片和正文草稿仍保留，可以重新选择图片重试。`,
    };
    if (retryableCount > 0) {
      status.canRetry = true;
      status.retryLabel = "重试失败图片";
    }
    return status;
  }
  const normalizedImageCount = Number(imageCount || 0);
  const normalizedSkippedCount = Number(skippedCount || 0);
  const normalizedFailedCount = Number(failedCount || 0);
  if (!(normalizedImageCount || normalizedSkippedCount || normalizedFailedCount)) {
    return { type: "" };
  }
  const status = {
    type: normalizedFailedCount || normalizedSkippedCount ? "warning" : "success",
    message: buildComposerUploadMessage({
      imageCount: normalizedImageCount,
      skippedCount: normalizedSkippedCount,
      failedCount: normalizedFailedCount,
    }),
  };
  if (normalizedFailedCount && Number(retryableFailedCount || 0) > 0) {
    status.canRetry = true;
    status.retryLabel = "重试失败图片";
  }
  return status;
}
