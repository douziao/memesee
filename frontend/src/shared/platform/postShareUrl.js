import {
  buildPostPermalinkUrl,
  normalizePublicPostId,
} from "./postPermalink";

export function normalizePostShareId(value) {
  return normalizePublicPostId(value);
}

export function resolvePostShareId(post) {
  return normalizePostShareId(post?.id)
    || normalizePostShareId(post?.postId)
    || normalizePostShareId(post?.mainPostId);
}

export function buildPostShareUrl({ post, origin, targetSubPostId }) {
  return buildPostPermalinkUrl({
    postId: resolvePostShareId(post),
    origin,
    targetSubPostId,
  });
}
