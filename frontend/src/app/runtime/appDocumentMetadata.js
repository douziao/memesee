import {
  buildPostSummaryText,
  buildSubPostSummaryText,
  compactPostSummaryText,
} from "../../shared/platform/postSummaryText";
import {
  buildPostPermalinkPath,
  normalizePublicPostId,
} from "../../shared/platform/postPermalink";

const SITE_NAME = "MemeSee";
const DEFAULT_TITLE = "MemeSee 社区论坛";
const DEFAULT_DESCRIPTION = "MemeSee 是一个轻量社区内容应用，聚合帖子、讨论、媒体分享和个人内容收藏。";
const DEFAULT_IMAGE = "/og-image.png";
const DEFAULT_IMAGE_ALT = "MemeSee 社区论坛分享卡片";
const DEFAULT_IMAGE_WIDTH = "1200";
const DEFAULT_IMAGE_HEIGHT = "630";
const COMPOSE_TITLE = `发布主帖 | ${SITE_NAME}`;
const COMPOSE_DESCRIPTION = "在 MemeSee 选择社区、编辑正文、上传图片并发布新的主帖。";

function getCanonicalPath(route, { targetSubPostStatus } = {}) {
  const postId = normalizePublicPostId(route?.mainPostId);
  if (route?.type === "post" && postId) {
    return buildPostPermalinkPath({
      postId,
      targetSubPostId: targetSubPostStatus?.kind === "missing"
        ? undefined
        : route?.targetSubPostId,
    });
  }
  if (route?.type === "compose") {
    return "/compose";
  }
  return "/";
}

function shouldBuildPostMetadata(route, selectedPost) {
  const routePostId = normalizePublicPostId(route?.mainPostId);
  const selectedPostId = normalizePublicPostId(selectedPost?.id);
  return !!(
    route?.type === "post" &&
    routePostId &&
    selectedPost?.contentLoaded &&
    selectedPostId === routePostId
  );
}

function resolveMetadataSubPostId(subPost) {
  return normalizePublicPostId(subPost?.id)
    || normalizePublicPostId(subPost?.subPostId)
    || normalizePublicPostId(subPost?.targetSubPostId);
}

function resolveTargetSubPost(route, subPosts) {
  const targetSubPostId = normalizePublicPostId(route?.targetSubPostId);
  if (!targetSubPostId || !Array.isArray(subPosts)) {
    return null;
  }
  const pending = [...subPosts];
  const visited = new Set();
  while (pending.length > 0) {
    const subPost = pending.shift();
    if (!subPost || typeof subPost !== "object") {
      continue;
    }
    const subPostId = resolveMetadataSubPostId(subPost);
    if (subPostId) {
      if (visited.has(subPostId)) {
        continue;
      }
      visited.add(subPostId);
      if (subPostId === targetSubPostId) {
        return subPost;
      }
    }
    if (Array.isArray(subPost.branchSubPosts)) {
      pending.push(...subPost.branchSubPosts);
    }
  }
  return null;
}

function cleanPublicHandle(value) {
  return String(value || "").trim().replace(/^@+/, "");
}

function absoluteUrl(path, origin) {
  const baseOrigin = String(origin || "").replace(/\/+$/, "");
  if (!baseOrigin) {
    return path || "/";
  }
  try {
    return new URL(path || "/", baseOrigin).toString();
  } catch {
    return `${baseOrigin}/${String(path || "").replace(/^\/+/, "")}`;
  }
}

function metadataImageCandidateUrl(source) {
  if (!source) {
    return "";
  }
  if (typeof source === "string") {
    return source.trim();
  }
  const processingStatus = String(source.processingStatus || "READY").toUpperCase();
  if (processingStatus !== "READY") {
    return "";
  }
  return [
    source.displayUrl,
    source.src,
    source.mediumUrl,
    source.smallUrl,
    source.thumbUrl,
    source.url,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function firstPostImageCandidate(post) {
  for (const items of [
    post?.mediaImageSources,
    post?.previewImageSources,
    post?.mediaAssets,
    post?.previewImages,
    post?.mediaUrls,
  ]) {
    if (Array.isArray(items)) {
      const candidate = items.map(metadataImageCandidateUrl).find(Boolean);
      if (candidate) {
        return candidate;
      }
    }
  }
  return "";
}

function buildImageMetadata({
  imageUrl,
  imageAlt,
  isDefaultImage = false,
}) {
  return {
    imageUrl,
    imageAlt: imageAlt || DEFAULT_IMAGE_ALT,
    ...(isDefaultImage
      ? {
        imageWidth: DEFAULT_IMAGE_WIDTH,
        imageHeight: DEFAULT_IMAGE_HEIGHT,
      }
      : null),
  };
}

function resolvePostImageMetadata(post, origin, imageAlt) {
  const candidate = firstPostImageCandidate(post);
  return buildImageMetadata({
    imageUrl: absoluteUrl(candidate || DEFAULT_IMAGE, origin),
    imageAlt,
    isDefaultImage: !candidate,
  });
}

function resolveTargetSubPostImage(targetSubPost, origin) {
  const candidate = firstPostImageCandidate(targetSubPost);
  return candidate ? absoluteUrl(candidate, origin) : "";
}

function buildTargetSubPostMetadata({ selectedPost, targetSubPost }) {
  if (!targetSubPost) {
    return null;
  }
  const mainTitle = compactPostSummaryText(selectedPost?.title || "MemeSee 主帖", 58);
  const subPostAuthor = cleanPublicHandle(
    targetSubPost?.author || targetSubPost?.authorUsername,
  );
  const subPostTitle = subPostAuthor ? `@${subPostAuthor} 的子帖` : "子帖";
  const subPostDescription = buildSubPostSummaryText({
    subPost: {
      preview: targetSubPost?.preview || targetSubPost?.subPostPreview,
      content: targetSubPost?.content,
      mediaAssetCount: targetSubPost?.mediaAssetCount,
      mediaCount: targetSubPost?.mediaCount,
      imageCount: targetSubPost?.imageCount,
      mediaImageSources: targetSubPost?.mediaImageSources,
      mediaAssets: targetSubPost?.mediaAssets,
      mediaUrls: targetSubPost?.mediaUrls,
      previewImages: targetSubPost?.previewImages,
      previewImageSources: targetSubPost?.previewImageSources,
    },
    fallback: subPostAuthor
      ? `@${subPostAuthor} 在这条 MemeSee 讨论下发布的子帖。`
      : "这条 MemeSee 讨论下的子帖。"
  });
  return {
    title: `${mainTitle} · ${subPostTitle} | ${SITE_NAME}`,
    description: subPostDescription,
    imageAlt: `${mainTitle} · ${subPostTitle} 分享图`,
  };
}

function buildPostMetadata({ selectedPost, route, origin, subPosts, targetSubPostStatus }) {
  const targetSubPost = resolveTargetSubPost(route, subPosts);
  const targetSubPostMetadata = buildTargetSubPostMetadata({
    selectedPost,
    targetSubPost,
  });
  const title = compactPostSummaryText(selectedPost?.title || DEFAULT_TITLE, 70);
  const description = buildPostSummaryText({
    post: selectedPost,
    fallback: `${selectedPost?.author || "用户"} 在 MemeSee 发布的社区讨论。`,
  });
  const canonicalUrl = absoluteUrl(getCanonicalPath(route, {
    targetSubPostStatus,
  }), origin);
  const shareImageAlt = targetSubPostMetadata?.imageAlt || `${title} 分享图`;
  const postImageMetadata = resolvePostImageMetadata(
    selectedPost,
    origin,
    shareImageAlt,
  );
  const targetSubPostImageUrl = resolveTargetSubPostImage(targetSubPost, origin);
  return {
    title: targetSubPostMetadata?.title || `${title} | ${SITE_NAME}`,
    description: targetSubPostMetadata?.description || description,
    canonicalUrl,
    ...(
      targetSubPostImageUrl
        ? buildImageMetadata({
          imageUrl: targetSubPostImageUrl,
          imageAlt: targetSubPostMetadata?.imageAlt,
        })
        : postImageMetadata
    ),
    type: "article",
  };
}

function buildHomeTitle({ view, communityName }) {
  return view === "mine"
    ? `我的空间 | ${SITE_NAME}`
    : communityName
      ? `${communityName} | ${SITE_NAME}`
      : DEFAULT_TITLE;
}

export function buildDocumentMetadata({
  route,
  view,
  selectedPost,
  subPosts,
  targetSubPostStatus,
  selectedCommunity,
  origin = "",
} = {}) {
  if (shouldBuildPostMetadata(route, selectedPost)) {
    return buildPostMetadata({
      selectedPost,
      route,
      origin,
      subPosts,
      targetSubPostStatus,
    });
  }

  if (route?.type === "compose") {
    return {
      title: COMPOSE_TITLE,
      description: COMPOSE_DESCRIPTION,
      canonicalUrl: absoluteUrl("/compose", origin),
      ...buildImageMetadata({
        imageUrl: absoluteUrl(DEFAULT_IMAGE, origin),
        isDefaultImage: true,
      }),
      type: "website",
    };
  }

  const communityName = selectedCommunity?.name || selectedCommunity?.slug || "";
  const title = buildHomeTitle({ view, communityName });
  const description = compactPostSummaryText(
    communityName
      ? `浏览 MemeSee 的 ${communityName} 社区，发现新的讨论、经验和媒体分享。`
      : DEFAULT_DESCRIPTION,
    155,
  );

  return {
    title,
    description,
    canonicalUrl: absoluteUrl(getCanonicalPath(route, {
      targetSubPostStatus,
    }), origin),
    ...buildImageMetadata({
      imageUrl: absoluteUrl(DEFAULT_IMAGE, origin),
      isDefaultImage: true,
    }),
    type: "website",
  };
}

export const documentMetadataDefaults = {
  siteName: SITE_NAME,
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  image: DEFAULT_IMAGE,
  imageAlt: DEFAULT_IMAGE_ALT,
  imageWidth: DEFAULT_IMAGE_WIDTH,
  imageHeight: DEFAULT_IMAGE_HEIGHT,
};
