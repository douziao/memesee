import { buildPostSummaryText } from "./postSummaryText";
import { copyTextToClipboard } from "./clipboard";
import { POST_SHARE_RESULTS } from "./postShareResults";
import {
  buildPostShareUrl,
  normalizePostShareId,
  resolvePostShareId,
} from "./postShareUrl";

export { POST_SHARE_RESULTS } from "./postShareResults";
export {
  buildPostShareUrl,
  normalizePostShareId,
  resolvePostShareId,
} from "./postShareUrl";

function cleanShareText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function buildPostShareContextText(post) {
  const community = cleanShareText(post?.communityName || post?.communitySlug);
  const author = cleanShareText(post?.author || post?.authorUsername);
  return [
    "来自 MemeSee",
    community,
    author ? `@${author.replace(/^@+/, "")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildPostShareTargetText({ post, targetSubPostId }) {
  const normalizedSubPostId = normalizePostShareId(targetSubPostId);
  if (!normalizedSubPostId) {
    return "";
  }
  const targetAuthor = cleanShareText(
    post?.shareTargetAuthor || post?.targetSubPostAuthor || post?.targetSubPostAuthorUsername,
  ).replace(/^@+/, "");
  return targetAuthor
    ? `定位到 @${targetAuthor} 的子帖 #${normalizedSubPostId}`
    : `定位到子帖 #${normalizedSubPostId}`;
}

function buildPostShareTextLines({ preview, title, targetText, context }) {
  const summary = preview && preview !== title ? preview : "";
  if (targetText) {
    return [
      targetText,
      summary,
      context,
    ].filter(Boolean);
  }
  return [
    summary,
    context,
  ].filter(Boolean);
}

export function buildPostSharePayload({ post, url, targetSubPostId }) {
  const title = cleanShareText(post?.title) || "MemeSee 主帖";
  const preview = buildPostSummaryText({ post });
  const context = buildPostShareContextText(post);
  const targetText = buildPostShareTargetText({ post, targetSubPostId });
  const text = buildPostShareTextLines({
    preview,
    title,
    targetText,
    context,
  }).join("\n") || title;
  return {
    title,
    text,
    url,
  };
}

export function buildPostShareClipboardText({ post, url, targetSubPostId }) {
  const payload = buildPostSharePayload({ post, url, targetSubPostId });
  const textLines = payload.text && payload.text !== payload.title
    ? String(payload.text).split(/\n+/)
    : [];
  return [
    payload.title,
    ...textLines,
    payload.url,
  ]
    .map(cleanShareText)
    .filter(Boolean)
    .join("\n");
}

export function buildPostNativeSharePayloadCandidates(payload) {
  const safeTitle = cleanShareText(payload?.title);
  const safeText = String(payload?.text || "").trim();
  const safeUrl = String(payload?.url || "").trim();
  if (!safeUrl) {
    return [];
  }

  return [
    {
      ...(safeTitle ? { title: safeTitle } : null),
      ...(safeText ? { text: safeText } : null),
      url: safeUrl,
    },
    {
      ...(safeTitle ? { title: safeTitle } : null),
      url: safeUrl,
    },
    {
      url: safeUrl,
    },
  ];
}

function isShareCanceled(error) {
  return error?.name === "AbortError";
}

function canUseNativeSharePayload(navigatorLike, payload) {
  if (!navigatorLike?.share) {
    return false;
  }
  if (!navigatorLike.canShare) {
    return true;
  }
  try {
    return navigatorLike.canShare(payload);
  } catch {
    return false;
  }
}

export { copyTextToClipboard } from "./clipboard";

export async function sharePostLink({
  post,
  url,
  targetSubPostId,
  navigatorLike = globalThis.navigator,
  documentLike = globalThis.document,
}) {
  if (!resolvePostShareId(post) || !url) {
    return POST_SHARE_RESULTS.failed;
  }

  const payload = buildPostSharePayload({ post, url, targetSubPostId });

  const nativeSharePayload = buildPostNativeSharePayloadCandidates(payload)
    .find((candidate) => canUseNativeSharePayload(navigatorLike, candidate));
  if (nativeSharePayload) {
    try {
      await navigatorLike.share(nativeSharePayload);
      return POST_SHARE_RESULTS.shared;
    } catch (error) {
      if (isShareCanceled(error)) {
        return POST_SHARE_RESULTS.canceled;
      }
    }
  }

  try {
    await copyTextToClipboard(
      buildPostShareClipboardText({ post, url, targetSubPostId }),
      { navigatorLike, documentLike },
    );
    return POST_SHARE_RESULTS.copied;
  } catch {
    return POST_SHARE_RESULTS.failed;
  }
}
