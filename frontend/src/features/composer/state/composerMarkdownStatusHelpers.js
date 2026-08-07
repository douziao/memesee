import {
  buildComposerMarkdownMediaValidationMessage,
  findFirstMissingComposerMarkdownMediaRange,
  findMissingComposerMarkdownMediaRefs,
  findUnreferencedComposerMarkdownMediaAssets,
} from "./composerDraftHelpers";

export function buildComposerMarkdownMediaUsageStatus({
  content,
  composerMediaAssets,
}) {
  const unreferencedAssets = findUnreferencedComposerMarkdownMediaAssets({
    content,
    composerMediaAssets,
  });
  const count = unreferencedAssets.length;
  if (count <= 0) {
    return { type: "" };
  }
  return {
    type: "info",
    message: count === 1
      ? "有 1 张已上传图片未在正文中引用，发布时不会带上。"
      : `有 ${count} 张已上传图片未在正文中引用，发布时不会带上。`,
    actionLabel: "重新插入",
    unusedCount: count,
  };
}

function buildComposerMarkdownMediaStatus({
  content,
  composerMediaAssets,
  actionLabel,
}) {
  const missingRefs = findMissingComposerMarkdownMediaRefs({
    content,
    composerMediaAssets,
  });
  const message = buildComposerMarkdownMediaValidationMessage(missingRefs);
  if (!message) {
    return { type: "" };
  }
  const firstMissingRange = findFirstMissingComposerMarkdownMediaRange({
    content,
    composerMediaAssets,
  });
  return {
    type: "warning",
    message,
    actionLabel,
    cleanActionLabel: "清理引用",
    missingCount: missingRefs.length,
    ...(firstMissingRange
      ? {
        selectionStart: firstMissingRange.selectionStart,
        selectionEnd: firstMissingRange.selectionEnd,
      }
      : null),
  };
}

export function buildComposerMarkdownMediaPreviewStatus({
  content,
  composerMediaAssets,
}) {
  return buildComposerMarkdownMediaStatus({
    content,
    composerMediaAssets,
    actionLabel: "回到正文",
  });
}

export function buildComposerMarkdownMediaEditorStatus({
  content,
  composerMediaAssets,
}) {
  return buildComposerMarkdownMediaStatus({
    content,
    composerMediaAssets,
    actionLabel: "定位引用",
  });
}
