export function normalizeMainPostId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

export function resolveMainPostId(post) {
  return normalizeMainPostId(post?.id)
    || normalizeMainPostId(post?.postId)
    || normalizeMainPostId(post?.mainPostId);
}
