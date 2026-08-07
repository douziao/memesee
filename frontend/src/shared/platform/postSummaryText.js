import { buildPreview } from "../media/markdownContent";

export const POST_SUMMARY_MAX_LENGTH = 155;

function countSummaryMediaItems(source) {
  const candidates = [
    source?.mediaImageSources,
    source?.mediaAssets,
    source?.mediaUrls,
    source?.previewImages,
    source?.previewImageSources,
  ];
  const firstReadyAwareCandidate = candidates.find((candidate) =>
    Array.isArray(candidate)
    && candidate.some((item) => item && typeof item === "object"),
  );
  if (firstReadyAwareCandidate) {
    return firstReadyAwareCandidate.filter(isSummaryMediaItemReady).length;
  }

  const explicitCount = Number(
    source?.mediaAssetCount
    ?? source?.mediaCount
    ?? source?.imageCount
    ?? 0,
  );
  if (explicitCount > 0) {
    return Math.floor(explicitCount);
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.filter(isSummaryMediaItemReady).length;
    }
  }
  return 0;
}

function isSummaryMediaItemReady(item) {
  if (!item || typeof item !== "object") {
    return true;
  }
  const status = String(item.processingStatus || "READY").toUpperCase();
  return status === "READY";
}

function buildMediaOnlySummary(source) {
  const mediaCount = countSummaryMediaItems(source);
  return mediaCount ? `${mediaCount}张图` : "";
}

function cleanPostSummaryArtifacts(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(?:和|与|及|以及|还有|and)(?=\s*(?:[，。！？；：,.!?;:]|$))/gi, "")
    .replace(/\s+([，。！？；：,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactPostSummaryText(value, maxLength = POST_SUMMARY_MAX_LENGTH) {
  const normalized = cleanPostSummaryArtifacts(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function buildPostSummaryText({ post, fallback = "", maxLength } = {}) {
  const preview = post?.preview || buildPreview(post?.content || "");
  const mediaSummary = buildMediaOnlySummary(post);
  return compactPostSummaryText(
    `${preview}${preview && mediaSummary ? `·${mediaSummary}` : ""}` || mediaSummary || fallback,
    maxLength,
  );
}

export function buildSubPostSummaryText({ subPost, fallback = "", maxLength } = {}) {
  const explicitPreview = subPost?.preview || subPost?.subPostPreview || "";
  const mediaOnlyPreview = buildMediaOnlySummary(subPost);
  const preview = explicitPreview && (!mediaOnlyPreview || explicitPreview != "无内容")
    ? buildPreview(explicitPreview)
    : buildPreview(subPost?.content || "");
  return compactPostSummaryText(preview || mediaOnlyPreview || fallback, maxLength);
}
