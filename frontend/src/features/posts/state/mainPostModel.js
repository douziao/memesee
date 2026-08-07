import { extractMarkdownMediaAssetIds } from "../../../shared/media/markdownContent";
import {
  buildPostMediaImageSources,
  buildPostPreviewImageSources,
  normalizeAssetUrl,
  normalizePostMediaAssets,
} from "../../../shared/media/mediaAssetHelpers";
import { buildPostSummaryText } from "../../../shared/platform/postSummaryText";

export function calculateHeatScore(post) {
  const viewWeight = 0.1;
  const likeWeight = 1;
  const favoriteWeight = 2;
  const subPostWeight = 3;
  const viewCount = Number(post?.viewCount || 0);
  const likeCount = Number(post?.likeCount || 0);
  const favoriteCount = Number(post?.favoriteCount || 0);
  const subPostCount = Number(post?.subPostCount || 0);
  return (viewCount * viewWeight)
    + (likeCount * likeWeight)
    + (favoriteCount * favoriteWeight)
    + (subPostCount * subPostWeight);
}

export function formatHeatScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return "0.0";
  }
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function normalizePostModeValue(raw) {
  return raw === "rich" ? "rich" : "long";
}

export function resolveLatestActivityAt(post) {
  const safePost = post && typeof post === "object" ? post : {};
  return safePost.latestActivityAt || safePost.latestSubPostAt || safePost.updatedAt || safePost.createdAt || null;
}

export function resolveLatestActivityAtText(post) {
  const safePost = post && typeof post === "object" ? post : {};
  return safePost.latestActivityAtText || safePost.latestSubPostAtText || "";
}

export function normalizePostPayload(post, apiBase = "") {
  const safePost = post && typeof post === "object" ? post : {};
  const explicitMode = normalizePostModeValue(safePost.postMode);
  const viewCount = Number(safePost.viewCount || 0);
  const likeCount = Number(safePost.likeCount || 0);
  const favoriteCount = Number(safePost.favoriteCount || 0);
  const latestActivityAt = resolveLatestActivityAt(safePost);
  const latestActivityAtText = resolveLatestActivityAtText(safePost);
  const computedHotScore = calculateHeatScore({
    viewCount,
    likeCount,
    favoriteCount,
    subPostCount: Number(safePost.subPostCount || 0),
  });
  const backendHotScore = Number(safePost.heatScore ?? safePost.hotScore);
  const mediaUrls = Array.isArray(safePost.mediaUrls)
    ? safePost.mediaUrls
      .map((url) => normalizeAssetUrl(url || "", apiBase))
      .filter(Boolean)
    : [];
  const mediaOriginalUrls = Array.isArray(safePost.mediaOriginalUrls)
    ? safePost.mediaOriginalUrls
      .map((url) => normalizeAssetUrl(url || "", apiBase))
      .filter(Boolean)
    : mediaUrls;
  const mediaAssets = normalizePostMediaAssets(safePost.mediaAssets, apiBase);
  const existingPreviewImages = Array.isArray(safePost.previewImages)
    ? safePost.previewImages
      .map((url) => normalizeAssetUrl(url || "", apiBase))
      .filter(Boolean)
    : [];
  const mediaImageSources = buildPostMediaImageSources(mediaAssets);
  const previewImageSources = buildPostPreviewImageSources(mediaAssets);
  const previewImages = existingPreviewImages.length > 0
    ? existingPreviewImages.slice(0, 3)
    : mediaUrls.slice(0, 3);
  const derivedMode = mediaAssets.length > 0 && extractMarkdownMediaAssetIds(safePost.content || "").length === 0
    ? "rich"
    : "long";
  const mode = safePost.postMode ? explicitMode : derivedMode;
  return {
    ...safePost,
    postMode: mode,
    viewCount,
    likeCount,
    favoriteCount,
    subPostCount: Number(safePost.subPostCount || 0),
    hotScore: Number.isFinite(backendHotScore) ? backendHotScore : computedHotScore,
    latestActivityAt,
    latestActivityAtText,
    latestSubPostAt: latestActivityAt,
    latestSubPostAtText: latestActivityAtText,
    likedByMe: Boolean(safePost.likedByMe),
    favoritedByMe: Boolean(safePost.favoritedByMe),
    mediaUrls,
    mediaOriginalUrls,
    mediaAssets,
    mediaImageSources,
    previewImageSources,
    tags: Array.isArray(safePost.tags) ? safePost.tags : [],
    preview: buildPostSummaryText({ post: { content: safePost.content || "" } }),
    previewImages,
  };
}

export function normalizeSubPostPayload(subPost) {
  const safeSubPost = subPost && typeof subPost === "object" ? subPost : {};
  return {
    ...safeSubPost,
    likeCount: Number(safeSubPost.likeCount || 0),
    likedByMe: Boolean(safeSubPost.likedByMe),
    favoriteCount: Number(safeSubPost.favoriteCount || 0),
    favoritedByMe: Boolean(safeSubPost.favoritedByMe),
  };
}

export function sortPostsByMode(postList, mode) {
  const posts = Array.isArray(postList) ? [...postList] : [];
  const publishTimeOf = (post) => new Date(post.createdAt || 0).getTime();
  const latestActivityTimeOf = (post) => new Date(resolveLatestActivityAt(post) || 0).getTime();
  const descBy = (primary, secondary) => (a, b) => {
    const gap = primary(b) - primary(a);
    if (gap !== 0) {
      return gap;
    }
    return secondary(b) - secondary(a);
  };

  switch (mode) {
    case "most_views":
      posts.sort(
        descBy(
          (post) => Number(post.viewCount || 0),
          latestActivityTimeOf,
        ),
      );
      break;
    case "most_heat":
      posts.sort(
        descBy(
          (post) =>
            Number.isFinite(Number(post.hotScore))
              ? Number(post.hotScore)
              : calculateHeatScore(post),
          latestActivityTimeOf,
        ),
      );
      break;
    case "latest_message":
    default:
      posts.sort(descBy(latestActivityTimeOf, publishTimeOf));
      break;
  }
  return posts;
}
