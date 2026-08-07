import { canHydrateMainPostIntoCurrentFeed } from "../../feed/state/feedQueryStateHelpers";
import {
  patchMainPostDetail,
  patchMainPostInFeed,
  resolveMainPostId,
  upsertMainPostInFeed,
} from "./mainPostStateHelpers";
import {
  updatePostDetailAfterSubPostDeleted,
  updatePostDetailAfterSubPostCreated,
} from "./subPostThreadHelpers";

const LOADED_MAIN_POST_FEED_PATCH_FIELDS = [
  "title",
  "content",
  "preview",
  "postMode",
  "communitySlug",
  "communityName",
  "tags",
  "mediaUrls",
  "mediaOriginalUrls",
  "mediaAssets",
  "mediaImageSources",
  "previewImages",
  "previewImageSources",
  "likeCount",
  "likedByMe",
  "favoriteCount",
  "favoritedByMe",
  "viewCount",
  "subPostCount",
  "hotScore",
  "updatedAt",
  "contentLoaded",
];

function pickLoadedMainPostFeedPatchFields(loadedPost) {
  const patch = {};
  for (const field of LOADED_MAIN_POST_FEED_PATCH_FIELDS) {
    if (loadedPost[field] !== undefined) {
      patch[field] = loadedPost[field];
    }
  }
  return patch;
}

function buildLoadedMainPostFeedPatch(loadedPost) {
  const patch = pickLoadedMainPostFeedPatchFields(loadedPost);
  const latestActivityAt = loadedPost.latestActivityAt || loadedPost.latestSubPostAt;
  if (latestActivityAt !== undefined) {
    patch.latestActivityAt = latestActivityAt;
  }
  const latestActivityAtText = loadedPost.latestActivityAtText || loadedPost.latestSubPostAtText;
  if (latestActivityAtText !== undefined) {
    patch.latestActivityAtText = latestActivityAtText || "";
  }
  return patch;
}

function buildMainPostEngagementPatch({
  hotScore,
  likeCount,
  likedByMe,
  favoriteCount,
  favoritedByMe,
}) {
  return {
    ...(likeCount === undefined ? {} : { likeCount }),
    ...(likedByMe === undefined ? {} : { likedByMe }),
    ...(favoriteCount === undefined ? {} : { favoriteCount }),
    ...(favoritedByMe === undefined ? {} : { favoritedByMe }),
    hotScore,
  };
}

export function syncLoadedMainPostIntoFeed(posts, loadedPost, feedQueryState) {
  const loadedPostId = resolveMainPostId(loadedPost);
  if (!loadedPostId) {
    return Array.isArray(posts) ? posts : [];
  }

  return patchMainPostInFeed(
    posts,
    loadedPostId,
    buildLoadedMainPostFeedPatch(loadedPost),
    {
      sortMode: feedQueryState?.feedSortMode,
      allowMetricRegression: 1,
    },
  );
}

export function shouldHydrateSavedMainPostIntoFeed(feedQueryState, savedPost) {
  return !!resolveMainPostId(savedPost) && canHydrateMainPostIntoCurrentFeed(
    feedQueryState,
    savedPost.communitySlug,
  );
}

export function syncSavedMainPostIntoFeed(posts, savedPost, feedQueryState) {
  const currentPosts = Array.isArray(posts) ? posts : [];
  const savedPostId = resolveMainPostId(savedPost);
  if (!shouldHydrateSavedMainPostIntoFeed(feedQueryState, savedPost)) {
    if (!savedPostId) {
      return currentPosts;
    }
    return currentPosts.filter((post) => resolveMainPostId(post) != savedPostId);
  }

  return upsertMainPostInFeed(currentPosts, savedPost, {
    sortMode: feedQueryState?.feedSortMode,
  });
}

export function syncSavedMainPostIntoDetail(postDetail, savedPost) {
  return patchMainPostDetail(postDetail, resolveMainPostId(savedPost), savedPost);
}

export function syncMainPostEngagementIntoFeed(posts, mainPostId, engagementState, feedQueryState) {
  return patchMainPostInFeed(
    posts,
    mainPostId,
    buildMainPostEngagementPatch(engagementState),
    {
      sortMode: feedQueryState?.feedSortMode,
      recalculateHotScore: !Number.isFinite(Number(engagementState?.hotScore)),
      allowMetricRegression: true,
    },
  );
}

export function syncMainPostEngagementIntoDetail(postDetail, mainPostId, engagementState) {
  return patchMainPostDetail(
    postDetail,
    mainPostId,
    buildMainPostEngagementPatch(engagementState),
    {
      recalculateHotScore: !Number.isFinite(Number(engagementState?.hotScore)),
      allowMetricRegression: true,
    },
  );
}

export function syncCreatedSubPostIntoDetail(postDetail, mainPostId, latestMessageAt) {
  return updatePostDetailAfterSubPostCreated(postDetail, mainPostId, latestMessageAt);
}

export function syncDeletedSubPostIntoFeed(posts, mainPostId) {
  return patchMainPostInFeed(
    posts,
    mainPostId,
    (post) => updatePostDetailAfterSubPostDeleted(post, mainPostId),
    {
      allowMetricRegression: true,
    },
  );
}

export function syncDeletedSubPostIntoDetail(postDetail, mainPostId) {
  return updatePostDetailAfterSubPostDeleted(postDetail, mainPostId);
}

export function syncDeletedMainPostIntoFeed(posts, mainPostId) {
  const currentPosts = Array.isArray(posts) ? posts : [];
  return currentPosts.filter((post) => resolveMainPostId(post) != mainPostId);
}
