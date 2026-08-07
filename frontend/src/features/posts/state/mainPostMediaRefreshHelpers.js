import {
  buildPostMediaImageSources,
  buildPostPreviewImageSources,
  normalizePostMediaAssets,
} from "../../../shared/media/mediaAssetHelpers";
import { resolveMainPostId } from "./mainPostStateHelpers";

function normalizeMediaAssetId(asset) {
  const assetId = Number(asset?.id || 0);
  return Number.isFinite(assetId) && assetId > 0 ? assetId : 0;
}

function normalizeProcessingStatus(asset) {
  return String(asset?.processingStatus || "READY").toUpperCase();
}

export function isMainPostMediaAssetRefreshPending(asset) {
  return normalizeMediaAssetId(asset) > 0 && normalizeProcessingStatus(asset) === "PROCESSING";
}

export function collectPendingMainPostMediaAssetIds(posts) {
  const seen = new Set();
  const assetIds = [];
  for (const post of Array.isArray(posts) ? posts : []) {
    for (const asset of Array.isArray(post?.mediaAssets) ? post.mediaAssets : []) {
      const assetId = normalizeMediaAssetId(asset);
      if (!assetId || seen.has(assetId) || !isMainPostMediaAssetRefreshPending(asset)) {
        continue;
      }
      seen.add(assetId);
      assetIds.push(assetId);
    }
  }
  return assetIds;
}

function buildRefreshedAssetMap(refreshedAssets, apiBase = "") {
  const refreshedById = new Map();
  normalizePostMediaAssets(refreshedAssets, apiBase).forEach((asset) => {
    const assetId = normalizeMediaAssetId(asset);
    if (assetId) {
      refreshedById.set(assetId, asset);
    }
  });
  return refreshedById;
}

function buildMainPostMediaPatch(mediaAssets) {
  const mediaUrls = mediaAssets
    .map((asset) => asset.displayUrl || asset.mediumUrl || asset.url)
    .filter(Boolean);
  const mediaOriginalUrls = mediaAssets
    .map((asset) => asset.originalUrl || asset.displayUrl || asset.url)
    .filter(Boolean);
  const mediaImageSources = buildPostMediaImageSources(mediaAssets);
  const previewImageSources = buildPostPreviewImageSources(mediaAssets);
  const previewImages = mediaAssets
    .map((asset) => asset.thumbUrl || asset.displayUrl || asset.url)
    .filter(Boolean)
    .slice(0, 3);

  return {
    mediaUrls,
    mediaOriginalUrls,
    mediaAssets,
    mediaImageSources,
    previewImageSources,
    previewImages,
  };
}

export function mergeRefreshedMediaAssetsIntoMainPost(post, refreshedAssets, apiBase = "") {
  if (!post || typeof post !== "object" || !Array.isArray(post.mediaAssets)) {
    return post;
  }
  const refreshedById = buildRefreshedAssetMap(refreshedAssets, apiBase);
  if (refreshedById.size === 0) {
    return post;
  }

  let changed = false;
  const nextMediaAssets = normalizePostMediaAssets(post.mediaAssets, apiBase).map((asset) => {
    const assetId = normalizeMediaAssetId(asset);
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

  if (!changed) {
    return post;
  }

  return {
    ...post,
    ...buildMainPostMediaPatch(nextMediaAssets),
  };
}

export function mergeRefreshedMediaAssetsIntoMainPostList(posts, refreshedAssets, apiBase = "") {
  const currentPosts = Array.isArray(posts) ? posts : [];
  let changed = false;
  const nextPosts = currentPosts.map((post) => {
    const nextPost = mergeRefreshedMediaAssetsIntoMainPost(post, refreshedAssets, apiBase);
    if (nextPost !== post) {
      changed = true;
    }
    return nextPost;
  });
  return changed ? nextPosts : currentPosts;
}

export function collectMainPostIdsForMediaAssets(posts, mediaAssets) {
  const mediaAssetIds = new Set(
    (Array.isArray(mediaAssets) ? mediaAssets : [])
      .map(normalizeMediaAssetId)
      .filter(Boolean),
  );
  if (mediaAssetIds.size === 0) {
    return [];
  }

  const postIds = [];
  const seenPostIds = new Set();
  for (const post of Array.isArray(posts) ? posts : []) {
    const postId = resolveMainPostId(post);
    if (!postId || seenPostIds.has(postId)) {
      continue;
    }
    const hasMediaAsset = (Array.isArray(post?.mediaAssets) ? post.mediaAssets : [])
      .some((asset) => mediaAssetIds.has(normalizeMediaAssetId(asset)));
    if (hasMediaAsset) {
      seenPostIds.add(postId);
      postIds.push(postId);
    }
  }
  return postIds;
}
