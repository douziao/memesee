import {
  normalizeMainPostId,
  resolveMainPostId,
} from "../../posts/state/mainPostIdentityHelpers";

export function emptyProfileInteractions() {
  return { postInteractions: [], subPostInteractions: [] };
}

function levelCriterionLabel(key) {
  switch (key) {
    case "communities_visited":
      return "\u8FDB\u5165\u4E0D\u540C\u793E\u533A";
    case "read_posts":
      return "\u7D2F\u8BA1\u9605\u8BFB\u4E3B\u5E16";
    case "read_minutes":
      return "\u7D2F\u8BA1\u9605\u8BFB\u65F6\u957F";
    case "active_days":
      return "\u7D2F\u8BA1\u6D3B\u8DC3\u5929\u6570";
    case "likes_given":
      return "\u7D2F\u8BA1\u70B9\u8D5E\u6B21\u6570";
    case "likes_received":
      return "\u7D2F\u8BA1\u83B7\u5F97\u70B9\u8D5E";
    case "main_post_communities":
    case "sub_post_communities":
      return "\u4E3B\u5E16\u8986\u76D6\u793E\u533A";
    case "recent_active_days":
      return "\u8FD1100\u5929\u6D3B\u8DC3\u5929\u6570";
    case "recent_main_post_communities":
    case "recent_sub_post_communities":
      return "\u8FD1100\u5929\u4E3B\u5E16\u8986\u76D6\u793E\u533A";
    case "recent_view_posts_ratio":
      return "\u8FD1100\u5929\u9605\u8BFB\u65B0\u4E3B\u5E16";
    case "recent_likes_received":
      return "\u8FD1100\u5929\u83B7\u5F97\u70B9\u8D5E";
    case "recent_likes_given":
      return "\u8FD1100\u5929\u70B9\u8D5E\u6B21\u6570";
    default:
      return "";
  }
}

export function buildProfileDashboard(levelProgress, userLevel) {
  const dashboardPercent = Math.max(
    0,
    Math.min(100, Number(levelProgress?.completionPercent || 0)),
  );
  const dashboardCurrentLevel = Number.isFinite(Number(levelProgress?.currentLevel))
    ? Number(levelProgress.currentLevel)
    : userLevel;
  const dashboardNextLevel = levelProgress?.maxLevel
    ? dashboardCurrentLevel
    : (Number.isFinite(Number(levelProgress?.nextLevel))
      ? Number(levelProgress.nextLevel)
      : Math.min(3, dashboardCurrentLevel + 1));
  const dashboardCriteria = (Array.isArray(levelProgress?.criteria) ? levelProgress.criteria : [])
    .map((criterion) => {
      const key = String(criterion?.key || "");
      return {
        ...criterion,
        key,
        compactLabel: levelCriterionLabel(key),
      };
    });

  return {
    dashboardPercent,
    dashboardCurrentLevel,
    dashboardNextLevel,
    dashboardCriteria,
    pendingDashboardCriteria: dashboardCriteria.filter((criterion) => !criterion.achieved),
  };
}

export function buildProfilePostsByCommunity(orderedCommunities, profilePosts) {
  const groups = new Map(
    (Array.isArray(orderedCommunities) ? orderedCommunities : []).map((community) => [
      community.slug,
      { slug: community.slug, name: community.name, posts: [] },
    ]),
  );

  (Array.isArray(profilePosts) ? profilePosts : []).forEach((post) => {
    const slug = post.communitySlug || "unknown";
    if (!groups.has(slug)) {
      groups.set(slug, {
        slug,
        name: post.communityName || slug,
        posts: [],
      });
    }
    groups.get(slug).posts.push(post);
  });

  return Array.from(groups.values()).filter((group) => group.posts.length > 0);
}

function profilePostTimestamp(post) {
  return Date.parse(post?.latestActivityAt || post?.updatedAt || post?.createdAt) || 0;
}

function profileMainPostId(post) {
  return resolveMainPostId(post);
}

function profileSubPostId(subPost) {
  return normalizeMainPostId(subPost?.subPostId)
    || normalizeMainPostId(subPost?.targetSubPostId)
    || normalizeMainPostId(subPost?.id);
}

function profileSubPostMainPostId(item) {
  return normalizeMainPostId(item?.mainPostId)
    || normalizeMainPostId(item?.postId)
    || resolveMainPostId(item?.mainPost);
}

export function upsertProfilePostList(profilePosts, savedPost) {
  const normalizedSavedPostId = profileMainPostId(savedPost);
  if (!normalizedSavedPostId) {
    return Array.isArray(profilePosts) ? profilePosts : [];
  }
  const currentPosts = Array.isArray(profilePosts) ? profilePosts : [];
  const existingPost = currentPosts.find(
    (post) => profileMainPostId(post) === normalizedSavedPostId,
  );
  return [
    {
      ...(existingPost || {}),
      ...savedPost,
      id: normalizedSavedPostId,
      postId: normalizedSavedPostId,
    },
    ...currentPosts.filter(
      (post) => profileMainPostId(post) !== normalizedSavedPostId,
    ),
  ].sort((left, right) => profilePostTimestamp(right) - profilePostTimestamp(left));
}

export function syncExistingProfilePostListItem(profilePosts, postSnapshot) {
  const currentPosts = Array.isArray(profilePosts) ? profilePosts : [];
  const normalizedPostId = profileMainPostId(postSnapshot);
  if (!normalizedPostId) {
    return currentPosts;
  }
  let changed = false;
  const nextPosts = currentPosts.map((item) => {
    const itemPostId = profileMainPostId(item);
    if (itemPostId !== normalizedPostId) {
      return item;
    }
    changed = true;
    return {
      ...item,
      ...postSnapshot,
      title: postSnapshot?.title || item.title,
      id: normalizedPostId,
      postId: normalizedPostId,
    };
  });
  if (!changed) {
    return currentPosts;
  }
  return nextPosts.sort((left, right) => profilePostTimestamp(right) - profilePostTimestamp(left));
}

export function removeProfilePostListItem(profilePosts, mainPostId) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  const currentPosts = Array.isArray(profilePosts) ? profilePosts : [];
  if (!normalizedMainPostId) {
    return currentPosts;
  }
  return currentPosts.filter(
    (item) => profileMainPostId(item) !== normalizedMainPostId,
  );
}

export function removeProfileSubPostsForMainPost(profileSubPosts, mainPostId) {
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  const currentSubPosts = Array.isArray(profileSubPosts) ? profileSubPosts : [];
  if (!normalizedMainPostId) {
    return currentSubPosts;
  }
  return currentSubPosts.filter((item) => {
    const itemMainPostId = profileSubPostMainPostId(item);
    return itemMainPostId !== normalizedMainPostId;
  });
}

export function removeProfileSubPostListItem(profileSubPosts, subPostId) {
  const normalizedSubPostId = normalizeMainPostId(subPostId);
  const currentSubPosts = Array.isArray(profileSubPosts) ? profileSubPosts : [];
  if (!normalizedSubPostId) {
    return currentSubPosts;
  }
  return currentSubPosts.filter(
    (item) => profileSubPostId(item) != normalizedSubPostId,
  );
}

export function syncExistingProfileSubPostListItem(profileSubPosts, subPostSnapshot) {
  const id = profileSubPostId(subPostSnapshot);
  return (Array.isArray(profileSubPosts) ? profileSubPosts : []).map((item) =>
    id && profileSubPostId(item) === id
      ? { ...item, ...subPostSnapshot, id: normalizeMainPostId(item?.id) || id, subPostId: id }
      : item,
  );
}

function interactionTimestamp(item) {
  return Date.parse(item?.interactedAt) || 0;
}

function normalizeInteractionAction(action) {
  const value = String(action || "").trim();
  return value === "like" || value === "favorite" ? value : "";
}

export function updateProfilePostInteractionList(
  postInteractions,
  {
    post,
    action,
    active,
    interactedAt = new Date().toISOString(),
  } = {},
) {
  const currentInteractions = Array.isArray(postInteractions) ? postInteractions : [];
  const normalizedAction = normalizeInteractionAction(action);
  const normalizedPostId = profileMainPostId(post);
  if (!normalizedAction || !normalizedPostId) {
    return currentInteractions;
  }

  const withoutCurrentAction = currentInteractions.filter(
    (item) =>
      profileMainPostId(item) !== normalizedPostId ||
      item?.action !== normalizedAction,
  );
  if (!active) {
    return withoutCurrentAction;
  }

  return [
    {
      ...post,
      id: normalizedPostId,
      postId: normalizedPostId,
      postTitle: post?.postTitle || post?.title || "",
      action: normalizedAction,
      interactedAt,
      interactedAtText: "",
      likedByMe: normalizedAction === "like",
      favoritedByMe: normalizedAction === "favorite",
    },
    ...withoutCurrentAction,
  ].sort((left, right) => interactionTimestamp(right) - interactionTimestamp(left));
}

export function updateProfileInteractionsForPostAction(
  profileInteractions,
  interactionChange,
) {
  const currentInteractions = profileInteractions || emptyProfileInteractions();
  return {
    postInteractions: updateProfilePostInteractionList(
      currentInteractions.postInteractions,
      interactionChange,
    ),
    subPostInteractions: Array.isArray(currentInteractions.subPostInteractions)
      ? currentInteractions.subPostInteractions
      : [],
  };
}

export function updateProfileSubPostInteractionList(
  subPostInteractions,
  {
    subPost,
    mainPost,
    action,
    active,
    interactedAt = new Date().toISOString(),
  } = {},
) {
  const currentInteractions = Array.isArray(subPostInteractions) ? subPostInteractions : [];
  const normalizedAction = normalizeInteractionAction(action);
  const normalizedSubPostId = profileSubPostId(subPost);
  if (!normalizedAction || !normalizedSubPostId) {
    return currentInteractions;
  }

  const withoutCurrentAction = currentInteractions.filter(
    (item) =>
      profileSubPostId(item) !== normalizedSubPostId ||
      item?.action !== normalizedAction,
  );
  if (!active) {
    return withoutCurrentAction;
  }

  const normalizedMainPostId =
    profileMainPostId(mainPost) || profileSubPostMainPostId(subPost) || null;
  const resolvedMainPost = mainPost
    ? {
      ...mainPost,
      id: normalizedMainPostId,
      postId: normalizedMainPostId,
    }
    : subPost?.mainPost;

  return [
    {
      ...subPost,
      subPostId: normalizedSubPostId,
      id: subPost?.id || normalizedSubPostId,
      postId: normalizedMainPostId,
      mainPostId: normalizedMainPostId,
      postTitle: mainPost?.title || subPost?.postTitle || subPost?.mainPostTitle || "",
      mainPostTitle: mainPost?.title || subPost?.mainPostTitle || subPost?.postTitle || "",
      mainPost: resolvedMainPost,
      author: subPost?.author || subPost?.authorUsername || "",
      authorUsername: subPost?.authorUsername || subPost?.author || "",
      subPostPreview: subPost?.subPostPreview || subPost?.content || "",
      action: normalizedAction,
      interactedAt,
      interactedAtText: "",
      likedByMe: normalizedAction === "like",
      favoritedByMe: normalizedAction === "favorite",
    },
    ...withoutCurrentAction,
  ].sort((left, right) => interactionTimestamp(right) - interactionTimestamp(left));
}

export function updateProfileInteractionsForSubPostAction(
  profileInteractions,
  interactionChange,
) {
  const currentInteractions = profileInteractions || emptyProfileInteractions();
  return {
    postInteractions: Array.isArray(currentInteractions.postInteractions)
      ? currentInteractions.postInteractions
      : [],
    subPostInteractions: updateProfileSubPostInteractionList(
      currentInteractions.subPostInteractions,
      interactionChange,
    ),
  };
}

export function applyProfileInteractionChanges(profileInteractions, interactionChanges) {
  const changes = Array.isArray(interactionChanges) ? interactionChanges : [];
  return changes.reduce((nextInteractions, entry) => {
    const target = String(entry?.target || entry?.type || "").trim();
    const interactionChange = entry?.change || entry?.interactionChange || entry;
    if (target === "post" || target === "main-post" || target === "mainPost") {
      return updateProfileInteractionsForPostAction(nextInteractions, interactionChange);
    }
    if (target === "sub-post" || target === "subPost") {
      return updateProfileInteractionsForSubPostAction(nextInteractions, interactionChange);
    }
    return nextInteractions;
  }, profileInteractions || emptyProfileInteractions());
}

export function syncProfileInteractionsForSavedPost(profileInteractions, savedPost) {
  const currentInteractions = profileInteractions || emptyProfileInteractions();
  const normalizedPostId = profileMainPostId(savedPost);
  if (!normalizedPostId) {
    return {
      postInteractions: Array.isArray(currentInteractions.postInteractions)
        ? currentInteractions.postInteractions
        : [],
      subPostInteractions: Array.isArray(currentInteractions.subPostInteractions)
        ? currentInteractions.subPostInteractions
        : [],
    };
  }

  const nextPostTitle = savedPost?.title || savedPost?.postTitle || "";
  const postInteractions = (Array.isArray(currentInteractions.postInteractions)
    ? currentInteractions.postInteractions
    : []).map((item) => {
    const itemPostId = profileMainPostId(item);
    if (itemPostId !== normalizedPostId) {
      return item;
    }
    return {
      ...item,
      ...savedPost,
      title: nextPostTitle || item.title,
      id: normalizedPostId,
      postId: normalizedPostId,
      postTitle: nextPostTitle || item.postTitle || item.title || "",
    };
  });

  const subPostInteractions = (Array.isArray(currentInteractions.subPostInteractions)
    ? currentInteractions.subPostInteractions
    : []).map((item) => {
    const itemMainPostId = profileSubPostMainPostId(item);
    if (itemMainPostId !== normalizedPostId) {
      return item;
    }
    return {
      ...item,
      postId: normalizedPostId,
      mainPostId: normalizedPostId,
      postTitle: nextPostTitle || item.postTitle || "",
      mainPostTitle: nextPostTitle || item.mainPostTitle || item.postTitle || "",
      mainPost: {
        ...(item.mainPost || {}),
        ...savedPost,
        title: nextPostTitle || item.mainPost?.title,
        id: normalizedPostId,
        postId: normalizedPostId,
      },
    };
  });

  return {
    postInteractions,
    subPostInteractions,
  };
}

export function removeProfileInteractionsForDeletedPost(profileInteractions, mainPostId) {
  const currentInteractions = profileInteractions || emptyProfileInteractions();
  const normalizedMainPostId = normalizeMainPostId(mainPostId);
  const postInteractions = Array.isArray(currentInteractions.postInteractions)
    ? currentInteractions.postInteractions
    : [];
  const subPostInteractions = Array.isArray(currentInteractions.subPostInteractions)
    ? currentInteractions.subPostInteractions
    : [];
  if (!normalizedMainPostId) {
    return {
      postInteractions,
      subPostInteractions,
    };
  }
  return {
    postInteractions: postInteractions.filter(
      (item) => profileMainPostId(item) !== normalizedMainPostId,
    ),
    subPostInteractions: subPostInteractions.filter((item) => {
      const itemMainPostId = profileSubPostMainPostId(item);
      return itemMainPostId !== normalizedMainPostId;
    }),
  };
}

export function removeProfileInteractionsForDeletedSubPost(profileInteractions, subPostId) {
  const currentInteractions = profileInteractions || emptyProfileInteractions();
  const normalizedSubPostId = normalizeMainPostId(subPostId);
  const postInteractions = Array.isArray(currentInteractions.postInteractions)
    ? currentInteractions.postInteractions
    : [];
  const subPostInteractions = Array.isArray(currentInteractions.subPostInteractions)
    ? currentInteractions.subPostInteractions
    : [];
  if (!normalizedSubPostId) {
    return {
      postInteractions,
      subPostInteractions,
    };
  }
  return {
    postInteractions,
    subPostInteractions: subPostInteractions.filter(
      (item) => profileSubPostId(item) !== normalizedSubPostId,
    ),
  };
}

export function buildProfileCommunitySummaries(profilePostsByCommunity) {
  return (Array.isArray(profilePostsByCommunity) ? profilePostsByCommunity : []).map((group) => ({
    slug: group.slug,
    name: group.name,
    count: group.posts.length,
  }));
}

export function resolveActiveProfileCommunity(
  profilePostsByCommunity,
  activeProfileCommunitySlug,
  orderedCommunities,
) {
  const slug = String(activeProfileCommunitySlug || "").trim();
  if (!slug) {
    return null;
  }
  const existing = (Array.isArray(profilePostsByCommunity) ? profilePostsByCommunity : [])
    .find((group) => group.slug === slug);
  if (existing) {
    return existing;
  }
  const community = (Array.isArray(orderedCommunities) ? orderedCommunities : [])
    .find((item) => item?.slug === slug);
  return {
    slug,
    name: community?.name || slug,
    posts: [],
  };
}
