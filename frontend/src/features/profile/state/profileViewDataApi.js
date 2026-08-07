import {
  listMyInteractions as listContentMyInteractions,
  listMyMainPosts as listContentMyMainPosts,
  listMySubPosts as listContentMySubPosts,
} from "../../content/api/contentApi";
import { normalizePostPayload } from "../../posts/state/mainPostModel";
import { emptyProfileInteractions } from "./profileViewHelpers";

export async function loadMyProfile(client, authToken) {
  const response = await client.get("/api/users/me", {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  return response.data;
}

export async function loadMyPosts({
  client,
  token,
  limit,
  apiBase,
}) {
  const postList = await listContentMyMainPosts(client, {
    token,
    limit,
  });
  return postList.map((post) => normalizePostPayload(post, apiBase));
}

export async function loadMyInteractions({ client, token, limit = 1000 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 1000), 1000));
  try {
    return await listContentMyInteractions(client, {
      token,
      limit: safeLimit,
    });
  } catch {
    return emptyProfileInteractions();
  }
}

export async function loadMySubPosts({ client, token, limit = 1000 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 1000), 1000));
  try {
    return await listContentMySubPosts(client, {
      token,
      limit: safeLimit,
    });
  } catch {
    return [];
  }
}
