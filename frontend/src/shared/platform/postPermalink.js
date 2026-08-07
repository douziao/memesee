export function normalizePublicPostId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? String(number) : "";
}

export function buildPostPermalinkPath({ postId, targetSubPostId } = {}) {
  const normalizedPostId = normalizePublicPostId(postId);
  if (!normalizedPostId) {
    return "";
  }

  const normalizedSubPostId = normalizePublicPostId(targetSubPostId);
  return `/posts/${normalizedPostId}${normalizedSubPostId ? `?subPost=${normalizedSubPostId}` : ""}`;
}

export function buildPostPermalinkUrl({ postId, origin, targetSubPostId } = {}) {
  const path = buildPostPermalinkPath({ postId, targetSubPostId });
  if (!path || !origin) {
    return path;
  }

  try {
    const url = new URL(path, origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return path;
    }
    return url.toString();
  } catch {
    return path;
  }
}
