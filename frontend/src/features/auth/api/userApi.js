function buildUserAuthHeaders(token) {
  return token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
}

/**
 * @param {{ post: Function }} client
 * @param {Object} request
 * @returns {Promise<Object>}
 */
export async function registerUser(client, request) {
  const response = await client.post("/api/users/register", request);
  return response?.data || {};
}

/**
 * @param {{ post: Function }} client
 * @param {Object} request
 * @returns {Promise<Object>}
 */
export async function loginUser(client, request) {
  const response = await client.post("/api/users/login", request);
  return response?.data || {};
}

/**
 * @param {{ get: Function }} client
 * @param {{ token?: string }} options
 * @returns {Promise<Object>}
 */
export async function getMyProfile(client, { token }) {
  const response = await client.get("/api/users/me", {
    headers: buildUserAuthHeaders(token),
  });
  return response?.data || {};
}

/**
 * @param {{ post: Function }} client
 * @param {{ token?: string, type?: string, communitySlug?: string, mainPostId?: number, seconds?: number, targetUsername?: string }} options
 * @returns {Promise<Object>}
 */
export async function reportUserActivity(client, {
  token,
  type,
  communitySlug,
  mainPostId,
  seconds,
  targetUsername,
}) {
  const payload = {
    type,
    communitySlug,
    mainPostId,
    seconds,
    targetUsername,
  };
  const response = await client.post("/api/users/activity/report", payload, {
    headers: buildUserAuthHeaders(token),
  });
  return response?.data || {};
}
