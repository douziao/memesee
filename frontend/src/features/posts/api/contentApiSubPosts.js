import {
  buildAuthHeaders,
  normalizePositiveId,
} from "../../content/api/contentApiShared";
import { mapSubPost } from "../../content/api/contentApiMappers";
import { calculateHeatScore } from "../state/mainPostModel";
import {
  buildPostSummaryText,
  buildSubPostSummaryText,
} from "../../../shared/platform/postSummaryText";

/**
 * @param {{ get: Function, defaults?: { baseURL?: string } }} client
 * @param {{ token?: string, mainPostId: number, cursor?: string, limit?: number }} options
 */
export async function listSubPostPage(client, {
  token,
  mainPostId,
  cursor = "",
  limit = 30,
}) {
  const apiBase = client?.defaults?.baseURL || "";
  const params = {
    limit: Math.max(1, Math.min(Number(limit || 30), 100)),
  };
  if (cursor) {
    params.cursor = cursor;
  }
  const response = await client.get(`/api/main-posts/${mainPostId}/sub-posts/page`, {
    params,
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  const subPosts = (Array.isArray(payload.subPosts) ? payload.subPosts : [])
    .map((item) => mapSubPost(apiBase, item));
  return {
    subPosts,
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : "",
    hasMore: Boolean(payload.hasMore),
  };
}

/**
 * @param {{ get: Function }} client
 * @param {{ token?: string, limit?: number }} options
 */
export async function listMySubPosts(client, { token, limit = 120 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 120), 1000));
  const response = await client.get("/api/me/sub-posts", {
    params: { limit: safeLimit },
    headers: buildAuthHeaders(token),
  });
  const payload = Array.isArray(response?.data) ? response.data : [];
  return payload.map((item) => {
    const subPostId = normalizePositiveId(item.id)
      || normalizePositiveId(item.subPostId)
      || normalizePositiveId(item.targetSubPostId);
    const mainPostId = normalizePositiveId(item.mainPostId)
      || normalizePositiveId(item.postId)
      || null;
    const parentSubPostId = normalizePositiveId(item.parentSubPostId)
      || normalizePositiveId(item.parentId)
      || null;
    const mainPostTitle = String(item.mainPostTitle || item.postTitle || "");
    const mainPost = {
      id: mainPostId,
      postId: mainPostId,
      title: mainPostTitle,
      postTitle: mainPostTitle,
      communitySlug: String(item.mainPostCommunitySlug || ""),
      communityName: String(item.mainPostCommunityName || ""),
      content: String(item.mainPostContentPreview || ""),
      preview: buildPostSummaryText({ post: { content: item.mainPostContentPreview || "" } }),
      author: String(item.mainPostAuthorUsername || ""),
      createdAt: item.mainPostCreatedAt || null,
      updatedAt: item.mainPostCreatedAt || null,
      latestActivityAt: item.mainPostLatestActivityAt || item.mainPostCreatedAt || null,
      latestActivityAtText: "",
      createdAtText: "",
      updatedAtText: "",
      viewCount: Number(item.mainPostViewCount || 0),
      subPostCount: Number(item.mainPostSubPostCount || 0),
      likeCount: Number(item.mainPostLikeCount || 0),
      favoriteCount: Number(item.mainPostFavoriteCount || 0),
      likedByMe: false,
      favoritedByMe: false,
      tags: [],
      mediaUrls: [],
      mediaAssets: [],
    };
    return {
      id: subPostId,
      subPostId,
      targetSubPostId: subPostId,
      postId: mainPostId,
      mainPostId,
      mainPostTitle,
      postTitle: mainPostTitle,
      mainPost: {
        ...mainPost,
        hotScore: calculateHeatScore(mainPost),
      },
      parentId: parentSubPostId,
      parentSubPostId,
      author: String(item.authorUsername || ""),
      authorUsername: String(item.authorUsername || ""),
      content: String(item.content || ""),
      subPostPreview: buildSubPostSummaryText({
        subPost: {
          content: item.content || "",
          mediaAssetCount: item.subPostMediaAssetCount,
        },
      }),
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || item.createdAt || null,
      createdAtText: "",
      updatedAtText: "",
      likeCount: Number(item.likeCount || 0),
      childSubPostCount: Number(item.childSubPostCount || 0),
      favoriteCount: Number(item.favoriteCount || 0),
    };
  });
}

/**
 * @param {{ post: Function, defaults?: { baseURL?: string } }} client
 * @param {{ token?: string, mainPostId: number, parentSubPostId?: number, content?: string, mediaAssetIds?: number[] }} options
 */
export async function createSubPost(client, {
  token,
  mainPostId,
  parentSubPostId,
  content,
  mediaAssetIds,
}) {
  const apiBase = client?.defaults?.baseURL || "";
  const payload = {
    parentSubPostId: Number(parentSubPostId || 0) || null,
    content,
    mediaAssetIds: Array.isArray(mediaAssetIds) ? mediaAssetIds : [],
  };
  const response = await client.post(
    `/api/main-posts/${mainPostId}/sub-posts`,
    payload,
    {
      headers: buildAuthHeaders(token),
    },
  );
  const responsePayload = response?.data || {};
  return mapSubPost(apiBase, responsePayload);
}

/**
 * @param {{ delete: Function }} client
 * @param {{ token?: string, subPostId: number }} options
 */
export async function deleteSubPost(client, { token, subPostId }) {
  await client.delete(`/api/sub-posts/${subPostId}`, {
    headers: buildAuthHeaders(token),
  });
}
