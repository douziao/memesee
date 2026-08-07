import { buildAuthHeaders } from "../../content/api/contentApiShared";
import { mapMyPostInteraction, mapMySubPostInteraction } from "../../content/api/contentApiMappers";

/**
 * @param {Object & { likedByMe?: boolean, liked?: boolean }} payload
 */
function normalizeLikeStatusResponse(payload = {}) {
  return {
    ...payload,
    likedByMe:
      payload?.likedByMe === undefined ? Boolean(payload?.liked) : Boolean(payload?.likedByMe),
  };
}

/**
 * @param {Object & { favoritedByMe?: boolean, favorited?: boolean }} payload
 */
function normalizeFavoriteStatusResponse(payload = {}) {
  return {
    ...payload,
    favoritedByMe:
      payload?.favoritedByMe === undefined
        ? Boolean(payload?.favorited)
        : Boolean(payload?.favoritedByMe),
  };
}

/**
 * @param {{ request: Function }} client
 * @param {{ token?: string, mainPostId: number, likedByMe?: boolean }} options
 */
export async function toggleMainPostLike(client, { token, mainPostId, likedByMe }) {
  const response = await client.request({
    url: `/api/main-posts/${mainPostId}/likes`,
    method: likedByMe ? "delete" : "post",
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  return normalizeLikeStatusResponse(payload);
}

/**
 * @param {{ request: Function }} client
 * @param {{ token?: string, mainPostId: number, favoritedByMe?: boolean }} options
 */
export async function toggleMainPostFavorite(client, { token, mainPostId, favoritedByMe }) {
  const response = await client.request({
    url: `/api/main-posts/${mainPostId}/favorites`,
    method: favoritedByMe ? "delete" : "post",
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  return normalizeFavoriteStatusResponse(payload);
}

/**
 * @param {{ request: Function }} client
 * @param {{ token?: string, subPostId: number, likedByMe?: boolean }} options
 */
export async function toggleSubPostLike(client, { token, subPostId, likedByMe }) {
  const response = await client.request({
    url: `/api/sub-posts/${subPostId}/likes`,
    method: likedByMe ? "delete" : "post",
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  return normalizeLikeStatusResponse(payload);
}

/**
 * @param {{ request: Function }} client
 * @param {{ token?: string, subPostId: number, favoritedByMe?: boolean }} options
 */
export async function toggleSubPostFavorite(client, { token, subPostId, favoritedByMe }) {
  const response = await client.request({
    url: `/api/sub-posts/${subPostId}/favorites`,
    method: favoritedByMe ? "delete" : "post",
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  return normalizeFavoriteStatusResponse(payload);
}

/**
 * @param {{ get: Function }} client
 * @param {{ token?: string, limit?: number }} options
 */
export async function listMyInteractions(client, { token, limit }) {
  const response = await client.get("/api/me/interactions", {
    params: { limit },
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  return {
    postInteractions: (Array.isArray(payload.postInteractions) ? payload.postInteractions : [])
      .map(mapMyPostInteraction),
    subPostInteractions: (Array.isArray(payload.subPostInteractions) ? payload.subPostInteractions : [])
      .map(mapMySubPostInteraction),
  };
}
