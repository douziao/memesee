import { extractMarkdownMediaAssetIds } from "../../../shared/media/markdownContent";
import {
  buildPostMediaImageSources,
  buildPostPreviewImageSources,
} from "../../../shared/media/mediaAssetHelpers";
import {
  buildPostSummaryText,
  buildSubPostSummaryText,
} from "../../../shared/platform/postSummaryText";
import {
  calculateHeatScore,
  normalizePostModeValue,
} from "../../posts/state/mainPostModel";
import {
  normalizeAssetUrl,
  normalizePositiveId,
} from "./contentApiShared";

export function normalizeMediaAsset(apiBase, asset) {
  const safeAsset = asset && typeof asset === "object" ? asset : {};
  const assetId = +(safeAsset.id || 0);
  const rawVariants = Array.isArray(safeAsset.variants) ? safeAsset.variants : [];
  const rawVariantUrl = (kind) => {
    const match = rawVariants.find((variant) =>
      (variant?.kind || "").toLowerCase() === kind,
    );
    return match?.url || "";
  };
  const rawUrl = safeAsset.url || safeAsset.displayUrl || "";
  const rawDisplayUrl = safeAsset.displayUrl || safeAsset.url || "";
  const rawMediumUrl = safeAsset.mediumUrl || rawDisplayUrl;
  const rawSmallUrl = safeAsset.smallUrl || rawMediumUrl;
  const rawThumbUrl = safeAsset.thumbUrl || rawDisplayUrl;
  const rawOriginalUrl = safeAsset.originalUrl || rawVariantUrl("original") || "";
  const variants = rawVariants
    .map((variant) => ({
        kind: variant?.kind || "",
        url: normalizeAssetUrl(apiBase, variant?.url || ""),
        contentType: variant?.contentType || "",
        sizeBytes: +(variant?.sizeBytes || 0),
        width: +(variant?.width || 0),
        height: +(variant?.height || 0),
      }))
    .filter((variant) => variant.kind || variant.url);
  return {
    id: assetId,
    publicId: safeAsset.publicId || "",
    kind: safeAsset.kind || "IMAGE",
    url: normalizeAssetUrl(apiBase, rawUrl),
    thumbUrl: normalizeAssetUrl(apiBase, rawThumbUrl),
    smallUrl: normalizeAssetUrl(apiBase, rawSmallUrl),
    mediumUrl: normalizeAssetUrl(apiBase, rawMediumUrl),
    displayUrl: normalizeAssetUrl(apiBase, rawDisplayUrl),
    originalUrl: normalizeAssetUrl(apiBase, rawOriginalUrl),
    contentType: safeAsset.contentType || "",
    originalFilename: safeAsset.originalFilename || "",
    sizeBytes: +(safeAsset.sizeBytes || 0),
    width: +(safeAsset.width || 0),
    height: +(safeAsset.height || 0),
    blurDataUrl: safeAsset.blurDataUrl || "",
    placeholderUrl: safeAsset.placeholderUrl || safeAsset.blurDataUrl || "",
    processingStatus: safeAsset.processingStatus || "READY",
    variants,
  };
}

function resolveLatestActivityAt(post) {
  return post.latestActivityAt || post.latestSubPostAt || post.updatedAt || post.createdAt || null;
}

export function mapMainPost(apiBase, payload, { detailed = false } = {}) {
  const safePost = payload && typeof payload === "object" ? payload : {};
  const mediaAssets = Array.isArray(safePost.mediaAssets)
    ? safePost.mediaAssets.map((asset) => normalizeMediaAsset(apiBase, asset))
    : [];
  const latestActivityAt = resolveLatestActivityAt(safePost);
  const mediaImageSources = buildPostMediaImageSources(mediaAssets);
  const previewImageSources = buildPostPreviewImageSources(mediaAssets);
  const backendHotScore = +(safePost.heatScore ?? safePost.hotScore);
  const latestActivityAtText = safePost.latestActivityAtText || safePost.latestSubPostAtText || "";
  const content = detailed
    ? safePost.content || ""
    : safePost.contentPreview || safePost.content || "";
  const explicitPostMode = normalizePostModeValue(safePost.postMode);
  const derivedPostMode = mediaAssets.length > 0 && extractMarkdownMediaAssetIds(content).length === 0
    ? "rich"
    : "long";
  const postMode = safePost.postMode ? explicitPostMode : derivedPostMode;
  const previewImageUrls = Array.isArray(safePost.previewImageUrls)
    ? safePost.previewImageUrls
      .map((url) => normalizeAssetUrl(apiBase, url || ""))
      .filter(Boolean)
    : [];
  const mainPost = {
    id: +(safePost.id || 0),
    communitySlug: safePost.communitySlug || "",
    communityName: safePost.communityName || safePost.communitySlug || "",
    title: safePost.title || "",
    content,
    preview: detailed ? undefined : buildPostSummaryText({
      post: {
        content,
        mediaAssets,
        mediaImageSources,
      },
    }),
    postMode,
    mediaUrls: mediaAssets.map((asset) => asset.displayUrl || asset.mediumUrl || asset.url).filter(Boolean),
    mediaOriginalUrls: mediaAssets
      .map((asset) => asset.originalUrl || asset.displayUrl || asset.url)
      .filter(Boolean),
    mediaAssets,
    mediaImageSources,
    previewImageSources,
    author: safePost.authorUsername || "",
    createdAt: safePost.createdAt || null,
    updatedAt: safePost.updatedAt || safePost.createdAt || null,
    latestActivityAt,
    latestActivityAtText,
    latestSubPostAt: latestActivityAt,
    latestSubPostAtText: latestActivityAtText,
    viewCount: +(safePost.viewCount || 0),
    subPostCount: +(safePost.subPostCount || 0),
    likeCount: +(safePost.likeCount || 0),
    favoriteCount: +(safePost.favoriteCount || 0),
    likedByMe: !!safePost.likedByMe,
    favoritedByMe: !!safePost.favoritedByMe,
    tags: Array.isArray(safePost.tags) ? safePost.tags : [],
    hotScore: Number.isFinite(backendHotScore) ? backendHotScore : 0,
    contentLoaded: detailed,
  };
  mainPost.previewImages = mediaAssets.length > 0
    ? mediaAssets.map((asset) => asset.thumbUrl || asset.displayUrl || asset.url).filter(Boolean).slice(0, 3)
    : previewImageUrls.slice(0, 3);
  if (!Number.isFinite(backendHotScore)) {
    mainPost.hotScore = calculateHeatScore(mainPost);
  }
  return mainPost;
}

export function mapSubPost(apiBase, payload) {
  const safeSubPost = payload && typeof payload === "object" ? payload : {};
  const subPostId = normalizePositiveId(safeSubPost.id)
    || normalizePositiveId(safeSubPost.subPostId)
    || normalizePositiveId(safeSubPost.targetSubPostId);
  const mainPostId = normalizePositiveId(safeSubPost.mainPostId)
    || normalizePositiveId(safeSubPost.postId);
  const parentSubPostId = normalizePositiveId(safeSubPost.parentSubPostId)
    || normalizePositiveId(safeSubPost.parentId)
    || null;
  const mediaAssets = Array.isArray(safeSubPost.mediaAssets)
    ? safeSubPost.mediaAssets.map((asset) => normalizeMediaAsset(apiBase, asset))
    : [];
  const mediaImageSources = buildPostMediaImageSources(mediaAssets);
  const content = safeSubPost.content || "";
  const subPostPreview = buildSubPostSummaryText({
    subPost: {
      content,
      mediaAssets,
      mediaImageSources,
    },
  });
  return {
    id: subPostId,
    subPostId,
    targetSubPostId: subPostId,
    postId: mainPostId,
    mainPostId,
    parentId: parentSubPostId,
    parentSubPostId,
    parentSubPostAuthor: safeSubPost.parentSubPostAuthorUsername || "",
    parentSubPostAuthorUsername: safeSubPost.parentSubPostAuthorUsername || "",
    author: safeSubPost.authorUsername || "",
    content,
    subPostPreview,
    preview: subPostPreview,
    createdAt: safeSubPost.createdAt || null,
    updatedAt: safeSubPost.updatedAt || safeSubPost.createdAt || null,
    likeCount: +(safeSubPost.likeCount || 0),
    favoriteCount: +(safeSubPost.favoriteCount || 0),
    childSubPostCount: +(safeSubPost.childSubPostCount || 0),
    likedByMe: !!safeSubPost.likedByMe,
    favoritedByMe: !!safeSubPost.favoritedByMe,
    mediaUrls: mediaAssets.map((asset) => asset.displayUrl || asset.mediumUrl || asset.url).filter(Boolean),
    mediaOriginalUrls: mediaAssets
      .map((asset) => asset.originalUrl || asset.displayUrl || asset.url)
      .filter(Boolean),
    mediaAssets,
    mediaImageSources,
  };
}

export function mapNotification(payload) {
  const safeNotification = payload || {};
  const type = safeNotification.type || "";
  const body = safeNotification.body || "";
  const normalizedBody = /SUB_POST|POST_REPLY/.test(type)
    ? String(body).replace(/([：:])\s*无内容$/, "$1图片子帖").replace(/^无内容$/, "图片子帖")
    : body;
  return {
    id: +(safeNotification.id || 0),
    type,
    postId: +(safeNotification.mainPostId || safeNotification.postId) || null,
    subPostId: +(safeNotification.subPostId || safeNotification.targetSubPostId) || null,
    actorUsername: safeNotification.actorUsername || "",
    postTitle: safeNotification.mainPostTitle || safeNotification.postTitle || "",
    title: safeNotification.title || "",
    body: normalizedBody,
    createdAt: safeNotification.createdAt || null,
    read: !!safeNotification.read,
    unavailableReason: safeNotification.unavailableReason || "",
  };
}

export function mapMyPostInteraction(payload) {
  const safeItem = payload || {};
  const postId = +(safeItem.postId || safeItem.mainPostId || 0) || null;
  const action = safeItem.action || "";
  const postTitle = safeItem.postTitle || safeItem.mainPostTitle || "";
  const backendHotScore = +(safeItem.heatScore ?? safeItem.hotScore);
  const postLikeCount = +(safeItem.likeCount || 0);
  const postFavoriteCount = +(safeItem.favoriteCount || 0);
  const postSubPostCount = +(safeItem.subPostCount || 0);
  const postViewCount = +(safeItem.viewCount || 0);
  const postShape = {
    id: postId,
    postId,
    title: postTitle,
    communityName: safeItem.communityName || "",
    communitySlug: safeItem.communitySlug || "",
    content: safeItem.contentPreview || "",
    preview: buildPostSummaryText({ post: { content: safeItem.contentPreview || "" } }),
    author: safeItem.authorUsername || "",
    createdAt: safeItem.createdAt || null,
    updatedAt: safeItem.updatedAt || safeItem.createdAt || null,
    latestActivityAt: safeItem.latestActivityAt || safeItem.createdAt || null,
    viewCount: postViewCount,
    subPostCount: postSubPostCount,
    likeCount: postLikeCount,
    favoriteCount: postFavoriteCount,
    likedByMe: action === "like",
    favoritedByMe: action === "favorite",
  };
  return {
    ...postShape,
    hotScore: Number.isFinite(backendHotScore)
      ? backendHotScore
      : calculateHeatScore(postShape),
    action,
    interactedAt: safeItem.interactedAt,
  };
}

export function mapMySubPostInteraction(payload) {
  const safeItem = payload || {};
  const subPostId = normalizePositiveId(safeItem.subPostId)
    || normalizePositiveId(safeItem.targetSubPostId)
    || normalizePositiveId(safeItem.id);
  const mainPostId = normalizePositiveId(safeItem.mainPostId)
    || normalizePositiveId(safeItem.postId);
  const mainPostTitle = safeItem.postTitle || safeItem.mainPostTitle || "";
  const mainPostLikeCount = +(safeItem.mainPostLikeCount || 0);
  const mainPostFavoriteCount = +(safeItem.mainPostFavoriteCount || 0);
  const mainPostSubPostCount = +(safeItem.mainPostSubPostCount || 0);
  const mainPostViewCount = +(safeItem.mainPostViewCount || 0);
  const mainPost = {
    id: mainPostId,
    postId: mainPostId,
    title: mainPostTitle,
    communitySlug: safeItem.mainPostCommunitySlug || "",
    communityName: safeItem.mainPostCommunityName || "",
    content: safeItem.mainPostContentPreview || "",
    preview: buildPostSummaryText({ post: { content: safeItem.mainPostContentPreview || "" } }),
    author: safeItem.mainPostAuthorUsername || "",
    createdAt: safeItem.mainPostCreatedAt || null,
    updatedAt: safeItem.mainPostCreatedAt || null,
    latestActivityAt: safeItem.mainPostLatestActivityAt || safeItem.mainPostCreatedAt || null,
    viewCount: mainPostViewCount,
    subPostCount: mainPostSubPostCount,
    likeCount: mainPostLikeCount,
    favoriteCount: mainPostFavoriteCount,
  };
  return {
    id: subPostId,
    subPostId,
    targetSubPostId: subPostId,
    postId: mainPostId,
    mainPostId,
    postTitle: mainPostTitle,
    mainPostTitle,
    mainPost: {
      ...mainPost,
      hotScore: calculateHeatScore(mainPost),
    },
    author: safeItem.subPostAuthorUsername || "",
    authorUsername: safeItem.subPostAuthorUsername || "",
    subPostPreview: buildSubPostSummaryText({
      subPost: {
        subPostPreview: safeItem.subPostPreview || "",
        mediaAssetCount: safeItem.subPostMediaAssetCount,
      },
    }),
    action: safeItem.action,
    interactedAt: safeItem.interactedAt,
  };
}
