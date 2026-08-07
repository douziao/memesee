import {
  buildOrderedSubPostFloors,
  buildSubPostThreadNodeMap,
} from "./subPostThreadHelpers";

function normalizeNonNegativeCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function normalizeImageUrlList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasUsableImageSource(source) {
  if (!source || typeof source !== "object") {
    return false;
  }
  const processingStatus = String(source.processingStatus || "READY").toUpperCase();
  if (processingStatus !== "READY") {
    return true;
  }
  return [source.src, source.displayUrl, source.originalUrl].some(
    (value) => typeof value === "string" && value.trim(),
  );
}

function normalizeExplicitImageSources(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }
  if (value.every(hasUsableImageSource)) {
    return value;
  }
  return value.filter(hasUsableImageSource);
}

export function buildPostDetailSelectedPostViewModel({
  route,
  postDetail,
} = {}) {
  const routeMainPostId = Number(route?.mainPostId || 0);
  const selectedPost =
    route?.type === "post" && Number(postDetail?.id || 0) === routeMainPostId
      ? postDetail
      : null;
  const selectedLikeCount = normalizeNonNegativeCount(selectedPost?.likeCount);
  const selectedFavoriteCount = normalizeNonNegativeCount(selectedPost?.favoriteCount);

  if (!selectedPost || selectedPost.postMode !== "rich") {
    return {
      selectedPost,
      selectedLikeCount,
      selectedFavoriteCount,
      richDetailImages: [],
      richOriginalImages: [],
      richImageSources: [],
    };
  }

  const richDetailImages = normalizeImageUrlList(selectedPost.mediaUrls);
  const richOriginalImages = normalizeImageUrlList(selectedPost.mediaOriginalUrls);
  const explicitRichImageSources = normalizeExplicitImageSources(selectedPost.mediaImageSources);
  const richImageSources =
    explicitRichImageSources.length > 0
      ? explicitRichImageSources
      : richDetailImages.map((src, index) => ({
          src,
          displayUrl: src,
          originalUrl: richOriginalImages[index] || src,
        }));

  return {
    selectedPost,
    selectedLikeCount,
    selectedFavoriteCount,
    richDetailImages,
    richOriginalImages,
    richImageSources,
  };
}

export function buildPostDetailViewModel({
  route,
  postDetail,
  subPosts,
} = {}) {
  const selectedPostViewModel = buildPostDetailSelectedPostViewModel({
    route,
    postDetail,
  });
  const subPostNodeMap = buildSubPostThreadNodeMap(subPosts);
  const orderedSubPostFloors = buildOrderedSubPostFloors(subPostNodeMap);

  return {
    ...selectedPostViewModel,
    subPostNodeMap,
    orderedSubPostFloors,
  };
}
