import {
  calculateHeatScore,
  resolveLatestActivityAt,
  resolveLatestActivityAtText,
  sortPostsByMode,
} from "./mainPostModel";
import { resolveMainPostId } from "./mainPostIdentityHelpers";

const MONOTONIC_MAIN_POST_COUNT_FIELDS = [
  "viewCount",
  "subPostCount",
  "likeCount",
  "favoriteCount",
];

function resolvePatch(post, patchOrUpdater) {
  if (typeof patchOrUpdater === "function") {
    return patchOrUpdater(post);
  }
  return patchOrUpdater;
}

function hasMetricPatch(patch = {}) {
  return MONOTONIC_MAIN_POST_COUNT_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(patch, field),
  );
}

export { resolveMainPostId };

function mergeMainPostMetricState(post, patch, options = {}) {
  const merged = { ...post, ...patch };

  if (options.allowMetricRegression) {
    return merged;
  }

  for (const field of MONOTONIC_MAIN_POST_COUNT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) {
      continue;
    }
    const currentValue = Number(post?.[field] || 0);
    const incomingValue = Number(patch?.[field] || 0);
    if (Number.isFinite(currentValue) && Number.isFinite(incomingValue)) {
      merged[field] = Math.max(currentValue, incomingValue);
    }
  }

  return merged;
}

export function mergeMainPostState(post, patchOrUpdater, options = {}) {
  if (!post || typeof post !== "object") {
    return post;
  }

  const patch = resolvePatch(post, patchOrUpdater);
  if (!patch || typeof patch !== "object") {
    return post;
  }

  const merged = mergeMainPostMetricState(post, patch, options);
  const latestActivityAt = resolveLatestActivityAt(merged);
  const latestActivityAtText = resolveLatestActivityAtText(merged);

  merged.latestActivityAt = latestActivityAt;
  merged.latestActivityAtText = latestActivityAtText;
  merged.latestSubPostAt = latestActivityAt;
  merged.latestSubPostAtText = latestActivityAtText;

  const explicitHotScore = Number(merged.hotScore ?? merged.heatScore);
  const shouldRecalculateHotScore =
    options.recalculateHotScore ||
    hasMetricPatch(patch) ||
    MONOTONIC_MAIN_POST_COUNT_FIELDS.some((field) => merged[field] !== patch[field]);

  if (Number.isFinite(explicitHotScore) && !shouldRecalculateHotScore) {
    merged.hotScore = explicitHotScore;
    return merged;
  }

  if (shouldRecalculateHotScore) {
    merged.hotScore = calculateHeatScore(merged);
  }

  return merged;
}

export function mergeMainPostFeedItem(existingPost, incomingPost, options = {}) {
  if (!existingPost) {
    return incomingPost;
  }
  if (!incomingPost) {
    return existingPost;
  }
  return mergeMainPostState(existingPost, incomingPost, options);
}

export function mergeFeedSnapshotWithKnownState(existingPosts, incomingPosts, options = {}) {
  const existingById = {};
  (Array.isArray(existingPosts) ? existingPosts : []).forEach((post) => {
    const postId = resolveMainPostId(post);
    if (postId) {
      existingById[postId] = post;
    }
  });

  return (Array.isArray(incomingPosts) ? incomingPosts : [])
    .map((post) => mergeMainPostFeedItem(existingById[resolveMainPostId(post)], post, options));
}

export function mergePostPages(existingPosts, incomingPosts, options = {}) {
  const merged = Array.isArray(existingPosts) ? [...existingPosts] : [];
  const indexMap = {};
  merged.forEach((post, index) => {
    const postId = resolveMainPostId(post);
    if (postId) {
      indexMap[postId] = index;
    }
  });
  for (const post of Array.isArray(incomingPosts) ? incomingPosts : []) {
    const postKey = resolveMainPostId(post);
    if (!postKey) {
      merged.push(post);
      continue;
    }
    const existingIndex = indexMap[postKey];
    if (existingIndex === undefined) {
      indexMap[postKey] = merged.length;
      merged.push(post);
      continue;
    }
    merged[existingIndex] = mergeMainPostFeedItem(merged[existingIndex], post, options);
  }
  return merged;
}

export function patchMainPostInFeed(posts, mainPostId, patchOrUpdater, options = {}) {
  const currentPosts = Array.isArray(posts) ? posts : [];
  let changed = false;

  const nextPosts = currentPosts.map((post) => {
    if (resolveMainPostId(post) != mainPostId) {
      return post;
    }
    changed = true;
    return mergeMainPostState(post, patchOrUpdater, options);
  });

  if (!changed) {
    return currentPosts;
  }

  if (!options.sortMode) {
    return nextPosts;
  }

  return sortPostsByMode(nextPosts, options.sortMode);
}

export function patchMainPostDetail(postDetail, mainPostId, patchOrUpdater, options = {}) {
  if (!postDetail || resolveMainPostId(postDetail) != mainPostId) {
    return postDetail;
  }
  return mergeMainPostState(postDetail, patchOrUpdater, options);
}

export function upsertMainPostInFeed(posts, nextPost, options = {}) {
  const currentPosts = Array.isArray(posts) ? posts : [];
  const nextPostId = resolveMainPostId(nextPost);
  if (!nextPostId) {
    return currentPosts;
  }
  const existingPost = currentPosts.find((post) => resolveMainPostId(post) == nextPostId);
  const normalizedPost = mergeMainPostFeedItem(
    existingPost,
    { ...nextPost, id: nextPostId },
    options,
  );
  const filteredPosts = currentPosts.filter((post) => resolveMainPostId(post) != nextPostId);
  const nextPosts = [normalizedPost, ...filteredPosts];

  if (!options.sortMode) {
    return nextPosts;
  }

  return sortPostsByMode(nextPosts, options.sortMode);
}
