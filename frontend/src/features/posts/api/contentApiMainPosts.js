import { buildAuthHeaders } from "../../content/api/contentApiShared";
import { mapMainPost } from "../../content/api/contentApiMappers";

/**
 * @param {{ get: Function, defaults?: { baseURL?: string } }} client
 * @param {{
 *   token?: string,
 *   communitySlug?: string,
 *   keyword?: string,
 *   sortMode?: string,
 *   cursor?: string,
 *   size?: number,
 * }} options
 */
export async function listFeedPosts(client, {
  token,
  communitySlug,
  keyword = "",
  sortMode = "latest_message",
  cursor = "",
  size = 20,
}) {
  const normalizedCommunitySlug =
    communitySlug && communitySlug !== "lobby" ? communitySlug : "";
  const safeSize = Math.max(1, Number(size || 20));
  const apiBase = client?.defaults?.baseURL || "";
  const params = {
    size: safeSize,
  };
  if (normalizedCommunitySlug) {
    params.communitySlug = normalizedCommunitySlug;
  }
  if (keyword) {
    params.q = keyword;
  }
  if (sortMode) {
    params.sort = sortMode;
  }
  if (cursor) {
    params.cursor = cursor;
  }
  const response = await client.get("/api/feed", {
    params,
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  const posts = (Array.isArray(payload.posts) ? payload.posts : [])
    .map((item) => mapMainPost(apiBase, item, { detailed: false }));
  return {
    posts,
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : "",
    hasMore: Boolean(payload.hasMore),
  };
}

/**
 * @param {{ get: Function, defaults?: { baseURL?: string } }} client
 * @param {{ token?: string, mainPostId: number, trackView?: boolean }} options
 */
export async function getMainPost(client, { token, mainPostId, trackView = true }) {
  const apiBase = client?.defaults?.baseURL || "";
  const response = await client.get(`/api/main-posts/${mainPostId}`, {
    params: trackView === false ? { trackView: false } : undefined,
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  return mapMainPost(apiBase, payload, { detailed: true });
}

/**
 * @param {{ get: Function, defaults?: { baseURL?: string } }} client
 * @param {{ token?: string, limit?: number }} options
 */
export async function listMyMainPosts(client, { token, limit = 120 }) {
  const safeLimit = Math.max(1, Number(limit || 120));
  const items = [];
  let cursor = "";
  let hasMore = true;
  while (hasMore && items.length < safeLimit) {
    const response = await client.get("/api/me/main-posts", {
      params: {
        cursor,
        size: Math.min(100, safeLimit - items.length),
      },
      headers: buildAuthHeaders(token),
    });
    const payload = response?.data || {};
    const pageItems = Array.isArray(payload.posts) ? payload.posts : [];
    items.push(...pageItems);
    cursor = typeof payload.nextCursor === "string" ? payload.nextCursor : "";
    hasMore = Boolean(payload.hasMore) && Boolean(cursor);
    if (pageItems.length === 0 || !cursor) {
      break;
    }
  }
  const apiBase = client?.defaults?.baseURL || "";
  return items.map((item) => mapMainPost(apiBase, item, { detailed: false }));
}

/**
 * @param {{ post: Function, defaults?: { baseURL?: string } }} client
 * @param {{ token?: string, communitySlug?: string, title?: string, content?: string, postMode?: string, mediaAssetIds?: number[], tags?: string[] }} options
 */
export async function createMainPost(client, {
  token,
  communitySlug,
  title,
  content,
  postMode,
  mediaAssetIds,
  tags,
}) {
  const apiBase = client?.defaults?.baseURL || "";
  const payload = {
    communitySlug,
    title,
    content,
    postMode: postMode === "rich" ? "rich" : "long",
    mediaAssetIds: Array.isArray(mediaAssetIds) ? mediaAssetIds : [],
    tags: Array.isArray(tags) ? tags : [],
  };
  const response = await client.post(
    "/api/main-posts",
    payload,
    {
      headers: buildAuthHeaders(token),
    },
  );
  const responsePayload = response?.data || {};
  return mapMainPost(apiBase, responsePayload, { detailed: true });
}

/**
 * @param {{ put: Function, defaults?: { baseURL?: string } }} client
 * @param {{ token?: string, mainPostId: number, title?: string, content?: string, postMode?: string, mediaAssetIds?: number[], tags?: string[] }} options
 */
export async function updateMainPost(client, {
  token,
  mainPostId,
  title,
  content,
  postMode,
  mediaAssetIds,
  tags,
}) {
  const apiBase = client?.defaults?.baseURL || "";
  const payload = {
    title,
    content,
    postMode: postMode === "rich" ? "rich" : "long",
    mediaAssetIds: Array.isArray(mediaAssetIds) ? mediaAssetIds : [],
    tags: Array.isArray(tags) ? tags : [],
  };
  const response = await client.put(
    `/api/main-posts/${mainPostId}`,
    payload,
    {
      headers: buildAuthHeaders(token),
    },
  );
  const responsePayload = response?.data || {};
  return mapMainPost(apiBase, responsePayload, { detailed: true });
}

/**
 * @param {{ delete: Function }} client
 * @param {{ token?: string, mainPostId: number }} options
 */
export async function deleteMainPost(client, { token, mainPostId }) {
  await client.delete(`/api/main-posts/${mainPostId}`, {
    headers: buildAuthHeaders(token),
  });
}
