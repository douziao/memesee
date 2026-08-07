import {
  buildPostMediaImageSources,
  normalizePostMediaAssets,
} from "../../../shared/media/mediaAssetHelpers";
import { resolveSubPostId } from "./subPostThreadHelpers";

function normalizeMediaAssetId(asset) {
  const assetId = Number(asset?.id || 0);
  return Number.isFinite(assetId) && assetId > 0 ? assetId : 0;
}

function normalizeProcessingStatus(asset) {
  return String(asset?.processingStatus || "READY").toUpperCase();
}

export function isSubPostMediaAssetRefreshPending(asset) {
  return normalizeMediaAssetId(asset) > 0 && normalizeProcessingStatus(asset) === "PROCESSING";
}

export function collectPendingSubPostMediaAssetIds(subPosts) {
  const seen = new Set();
  const assetIds = [];
  for (const subPost of Array.isArray(subPosts) ? subPosts : []) {
    for (const asset of Array.isArray(subPost?.mediaAssets) ? subPost.mediaAssets : []) {
      const assetId = normalizeMediaAssetId(asset);
      if (!assetId || seen.has(assetId) || !isSubPostMediaAssetRefreshPending(asset)) {
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

function buildSubPostMediaPatch(mediaAssets) {
  return {
    mediaUrls: mediaAssets
      .map((asset) => asset.displayUrl || asset.mediumUrl || asset.url)
      .filter(Boolean),
    mediaOriginalUrls: mediaAssets
      .map((asset) => asset.originalUrl || asset.displayUrl || asset.url)
      .filter(Boolean),
    mediaAssets,
    mediaImageSources: buildPostMediaImageSources(mediaAssets),
  };
}

export function mergeRefreshedMediaAssetsIntoSubPost(subPost, refreshedAssets, apiBase = "") {
  if (!subPost || typeof subPost !== "object" || !Array.isArray(subPost.mediaAssets)) {
    return subPost;
  }
  const refreshedById = buildRefreshedAssetMap(refreshedAssets, apiBase);
  if (refreshedById.size === 0) {
    return subPost;
  }

  let changed = false;
  const nextMediaAssets = normalizePostMediaAssets(subPost.mediaAssets, apiBase).map((asset) => {
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
    return subPost;
  }

  return {
    ...subPost,
    ...buildSubPostMediaPatch(nextMediaAssets),
  };
}

export function mergeRefreshedMediaAssetsIntoSubPostList(subPosts, refreshedAssets, apiBase = "") {
  const currentSubPosts = Array.isArray(subPosts) ? subPosts : [];
  let changed = false;
  const nextSubPosts = currentSubPosts.map((subPost) => {
    const nextSubPost = mergeRefreshedMediaAssetsIntoSubPost(subPost, refreshedAssets, apiBase);
    if (nextSubPost !== subPost) {
      changed = true;
    }
    return nextSubPost;
  });
  return changed ? nextSubPosts : currentSubPosts;
}

export function collectSubPostIdsForMediaAssets(subPosts, mediaAssets) {
  const mediaAssetIds = new Set(
    (Array.isArray(mediaAssets) ? mediaAssets : [])
      .map(normalizeMediaAssetId)
      .filter(Boolean),
  );
  if (mediaAssetIds.size === 0) {
    return [];
  }

  const subPostIds = [];
  const seenSubPostIds = new Set();
  for (const subPost of Array.isArray(subPosts) ? subPosts : []) {
    const subPostId = resolveSubPostId(subPost);
    if (!subPostId || seenSubPostIds.has(subPostId)) {
      continue;
    }
    const hasMediaAsset = (Array.isArray(subPost?.mediaAssets) ? subPost.mediaAssets : [])
      .some((asset) => mediaAssetIds.has(normalizeMediaAssetId(asset)));
    if (hasMediaAsset) {
      seenSubPostIds.add(subPostId);
      subPostIds.push(subPostId);
    }
  }
  return subPostIds;
}
