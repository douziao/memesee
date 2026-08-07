import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyProfileInteractionChanges,
  removeProfileInteractionsForDeletedPost,
  removeProfileInteractionsForDeletedSubPost,
  removeProfilePostListItem,
  removeProfileSubPostListItem,
  removeProfileSubPostsForMainPost,
  resolveActiveProfileCommunity,
  syncExistingProfilePostListItem,
  syncExistingProfileSubPostListItem,
  syncProfileInteractionsForSavedPost,
  updateProfileInteractionsForPostAction,
  updateProfileInteractionsForSubPostAction,
  updateProfilePostInteractionList,
  updateProfileSubPostInteractionList,
  upsertProfilePostList,
} from "./profileViewHelpers";
import { normalizeProfilePositiveId } from "./profileIdHelpers";

const profileViewHelpersSource = readFileSync(
  new URL("./profileViewHelpers.js", import.meta.url),
  "utf8",
);

describe("normalizeProfilePositiveId", () => {
  it("accepts positive integer ids and rejects malformed profile ids", () => {
    expect(normalizeProfilePositiveId(42)).toBe(42);
    expect(normalizeProfilePositiveId("42")).toBe(42);
    expect(normalizeProfilePositiveId("")).toBe(0);
    expect(normalizeProfilePositiveId(0)).toBe(0);
    expect(normalizeProfilePositiveId(-1)).toBe(0);
    expect(normalizeProfilePositiveId(1.5)).toBe(0);
    expect(normalizeProfilePositiveId("abc")).toBe(0);
  });

  it("uses the lightweight shared identity helper instead of main post state helpers", () => {
    expect(profileViewHelpersSource).toContain("mainPostIdentityHelpers");
    expect(profileViewHelpersSource).not.toContain("mainPostStateHelpers");
  });
});

describe("resolveActiveProfileCommunity", () => {
  it("returns an existing active community group when posts are still present", () => {
    const group = {
      slug: "lobby",
      name: "大厅",
      posts: [{ id: 42 }],
    };

    expect(resolveActiveProfileCommunity([group], "lobby", [])).toBe(group);
  });

  it("keeps an empty active community view after posts move elsewhere", () => {
    expect(resolveActiveProfileCommunity([], "lobby", [{
        slug: "lobby",
        name: "大厅",
      }])).toEqual({
      slug: "lobby",
      name: "大厅",
      posts: [],
    });
  });

  it("returns null when no profile community is active", () => {
    expect(resolveActiveProfileCommunity([], "", [])).toBeNull();
  });
});

describe("upsertProfilePostList", () => {
  it("inserts a newly published post into the profile list", () => {
    const nextPosts = upsertProfilePostList([
      {
        id: 1,
        title: "旧主帖",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ], {
      id: 2,
      title: "新发布",
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    expect(nextPosts.map((post) => post.id)).toEqual([2, 1]);
  });

  it("updates an existing post after editing without duplicating it", () => {
    const nextPosts = upsertProfilePostList([
      {
        id: 1,
        title: "旧标题",
        content: "旧正文",
        communitySlug: "lobby",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        title: "其他主帖",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ], {
      id: 1,
      title: "新标题",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });

    expect(nextPosts).toHaveLength(2);
    expect(nextPosts[0]).toMatchObject({
      id: 1,
      title: "新标题",
      content: "旧正文",
      communitySlug: "lobby",
    });
  });

  it("accepts postId aliases when saving a published profile post", () => {
    const nextPosts = upsertProfilePostList([
      {
        postId: 42,
        title: "旧标题",
        content: "旧正文",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ], {
      postId: 42,
      title: "新标题",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });

    expect(nextPosts).toEqual([{
      id: 42,
      postId: 42,
      title: "新标题",
      content: "旧正文",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    }]);
  });

  it("falls back to postId when a saved profile post has a malformed id", () => {
    const nextPosts = upsertProfilePostList([
      {
        id: 42,
        title: "旧标题",
        content: "旧正文",
      },
    ], {
      id: "draft",
      postId: 42,
      title: "新标题",
    });

    expect(nextPosts).toEqual([{
      id: 42,
      postId: 42,
      title: "新标题",
      content: "旧正文",
    }]);
  });

  it("ignores unusable saved posts", () => {
    const posts = [{ id: 1, title: "旧主帖" }];

    expect(upsertProfilePostList(posts, null)).toBe(posts);
    expect(upsertProfilePostList(posts, { title: "缺少 id" })).toBe(posts);
  });
});

describe("syncExistingProfilePostListItem", () => {
  it("updates an existing published profile post from a fresh detail snapshot", () => {
    const nextPosts = syncExistingProfilePostListItem([
      {
        id: 42,
        title: "旧标题",
        preview: "旧摘要",
        mediaUrls: ["/old.webp"],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 7,
        title: "保留",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ], {
      id: 42,
      title: "新标题",
      preview: "新摘要",
      mediaUrls: ["/new.webp"],
      latestActivityAt: "2026-01-03T00:00:00.000Z",
    });

    expect(nextPosts[0]).toMatchObject({
      id: 42,
      postId: 42,
      title: "新标题",
      preview: "新摘要",
      mediaUrls: ["/new.webp"],
    });
    expect(nextPosts[1].id).toBe(7);
  });

  it("does not insert ordinary detail snapshots into published profile posts", () => {
    const posts = [{ id: 7, title: "我发布的主帖" }];

    expect(syncExistingProfilePostListItem(posts, {
      id: 42,
      title: "只是浏览过的主帖",
    })).toBe(posts);
  });

  it("keeps existing profile post titles when fresh snapshots omit them as undefined", () => {
    const snapshot = {
      id: 42,
      title: undefined,
      latestActivityAt: "2026-01-03T00:00:00.000Z",
    };
    const nextPosts = syncExistingProfilePostListItem([{
      id: 42,
      title: "保留标题",
      preview: "保留摘要",
      mediaUrls: ["/old.webp"],
    }], snapshot);

    expect(nextPosts[0]).toMatchObject({
      id: 42,
      title: "保留标题",
      latestActivityAt: "2026-01-03T00:00:00.000Z",
    });
    expect(snapshot.title).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(snapshot, "title")).toBe(true);
  });
});

describe("deleted profile post cleanup", () => {
  it("removes the deleted main post from published profile posts", () => {
    const posts = [
      { id: 42, title: "已删除" },
      { id: 7, title: "保留" },
    ];

    expect(removeProfilePostListItem(posts, 42)).toEqual([
      { id: 7, title: "保留" },
    ]);
    expect(removeProfilePostListItem(posts, 0)).toBe(posts);
  });

  it("removes profile sub-post rows that belong to the deleted main post", () => {
    const subPosts = [
      { id: 1, mainPostId: 42, content: "同主帖" },
      { id: 2, postId: 42, content: "同主帖 postId" },
      { id: 3, mainPost: { id: 42 }, content: "同主帖嵌套" },
      { id: 5, mainPost: { postId: 42 }, content: "同主帖嵌套 postId" },
      { id: 4, mainPostId: 7, content: "保留" },
    ];

    expect(removeProfileSubPostsForMainPost(subPosts, 42)).toEqual([
      { id: 4, mainPostId: 7, content: "保留" },
    ]);
  });

  it("removes profile sub-post rows when malformed mainPostId fields have valid fallbacks", () => {
    const subPosts = [
      { id: 1, mainPostId: "draft", postId: 42, content: "同主帖 postId 兜底" },
      { id: 2, mainPostId: "draft", mainPost: { postId: 42 }, content: "同主帖嵌套兜底" },
      { id: 3, mainPostId: "draft", postId: 7, content: "保留" },
    ];

    expect(removeProfileSubPostsForMainPost(subPosts, 42)).toEqual([
      { id: 3, mainPostId: "draft", postId: 7, content: "保留" },
    ]);
  });

  it("removes library interactions that point at the deleted main post", () => {
    const interactions = {
      postInteractions: [
        { id: 42, postId: 42, action: "favorite" },
        { id: 7, postId: 7, action: "like" },
      ],
      subPostInteractions: [
        { id: 1, subPostId: 1, mainPostId: 42, action: "like" },
        { id: 2, subPostId: 2, postId: 42, action: "favorite" },
        { id: 3, subPostId: 3, mainPost: { id: 42 }, action: "like" },
        { id: 5, subPostId: 5, mainPost: { postId: 42 }, action: "favorite" },
        { id: 4, subPostId: 4, mainPostId: 7, action: "favorite" },
      ],
    };

    expect(removeProfileInteractionsForDeletedPost(interactions, 42)).toEqual({
      postInteractions: [
        { id: 7, postId: 7, action: "like" },
      ],
      subPostInteractions: [
        { id: 4, subPostId: 4, mainPostId: 7, action: "favorite" },
      ],
    });
  });

  it("preserves normalized interaction lists for unusable deleted post ids", () => {
    const interactions = {
      postInteractions: [{ id: 42, action: "like" }],
      subPostInteractions: [{ id: 7, action: "favorite" }],
    };

    expect(removeProfileInteractionsForDeletedPost(interactions, null)).toEqual(interactions);
  });
});

describe("deleted profile sub-post cleanup", () => {
  it("removes the deleted sub-post from published profile sub-posts by either id field", () => {
    const subPosts = [
      { id: 7, content: "按 id 删除" },
      { subPostId: 7, content: "按 subPostId 删除" },
      { id: 8, subPostId: 8, content: "保留" },
    ];

    expect(removeProfileSubPostListItem(subPosts, "7")).toEqual([
      { id: 8, subPostId: 8, content: "保留" },
    ]);
    expect(removeProfileSubPostListItem(subPosts, null)).toBe(subPosts);
  });

  it("falls back to id when a profile sub-post row has a malformed subPostId", () => {
    const subPosts = [
      { id: 7, subPostId: "draft", content: "按 id 兜底删除" },
      { id: 8, subPostId: "draft", content: "保留" },
    ];

    expect(removeProfileSubPostListItem(subPosts, 7)).toEqual([
      { id: 8, subPostId: "draft", content: "保留" },
    ]);
  });

  it("falls back to targetSubPostId when profile sub-post preferred ids are malformed", () => {
    const subPosts = [
      { id: "draft", subPostId: "draft", targetSubPostId: 7, content: "按 targetSubPostId 删除" },
      { id: 8, subPostId: 8, targetSubPostId: 8, content: "保留" },
    ];

    expect(removeProfileSubPostListItem(subPosts, 7)).toEqual([
      { id: 8, subPostId: 8, targetSubPostId: 8, content: "保留" },
    ]);
  });

  it("removes library interactions that point at the deleted sub-post", () => {
    const interactions = {
      postInteractions: [
        { id: 42, postId: 42, action: "favorite" },
      ],
      subPostInteractions: [
        { id: 7, subPostId: 7, mainPostId: 42, action: "like" },
        { id: 7, subPostId: 7, mainPostId: 42, action: "favorite" },
        { id: 8, subPostId: 8, mainPostId: 42, action: "like" },
      ],
    };

    expect(removeProfileInteractionsForDeletedSubPost(interactions, 7)).toEqual({
      postInteractions: [
        { id: 42, postId: 42, action: "favorite" },
      ],
      subPostInteractions: [
        { id: 8, subPostId: 8, mainPostId: 42, action: "like" },
      ],
    });
  });

  it("removes library interactions when malformed subPostId fields have valid id fallbacks", () => {
    const interactions = {
      postInteractions: [],
      subPostInteractions: [
        { id: 7, subPostId: "draft", action: "like" },
        { id: 8, subPostId: "draft", action: "favorite" },
      ],
    };

    expect(removeProfileInteractionsForDeletedSubPost(interactions, 7)).toEqual({
      postInteractions: [],
      subPostInteractions: [
        { id: 8, subPostId: "draft", action: "favorite" },
      ],
    });
  });

  it("removes library interactions when targetSubPostId aliases identify the deleted sub-post", () => {
    const interactions = {
      postInteractions: [],
      subPostInteractions: [
        { id: "draft", subPostId: "draft", targetSubPostId: 7, action: "like" },
        { id: 8, subPostId: 8, targetSubPostId: 8, action: "favorite" },
      ],
    };

    expect(removeProfileInteractionsForDeletedSubPost(interactions, 7)).toEqual({
      postInteractions: [],
      subPostInteractions: [
        { id: 8, subPostId: 8, targetSubPostId: 8, action: "favorite" },
      ],
    });
  });

  it("preserves normalized interaction lists for unusable deleted sub-post ids", () => {
    const interactions = {
      postInteractions: [{ id: 42, action: "like" }],
      subPostInteractions: [{ id: 7, action: "favorite" }],
    };

    expect(removeProfileInteractionsForDeletedSubPost(interactions, null)).toEqual(interactions);
    expect(removeProfileInteractionsForDeletedSubPost(null, 7)).toEqual({
      postInteractions: [],
      subPostInteractions: [],
    });
  });
});

describe("syncExistingProfileSubPostListItem", () => {
  it("updates an existing published profile sub-post from an interaction snapshot", () => {
    const subPosts = [
      {
        id: 7,
        subPostId: 7,
        content: "旧子帖",
        likeCount: 1,
        likedByMe: false,
      },
      {
        id: 8,
        subPostId: 8,
        content: "保留",
      },
    ];

    expect(syncExistingProfileSubPostListItem(subPosts, {
      id: 7,
      content: "旧子帖",
      likeCount: 2,
      likedByMe: true,
    })).toEqual([
      {
        id: 7,
        subPostId: 7,
        content: "旧子帖",
        likeCount: 2,
        likedByMe: true,
      },
      {
        id: 8,
        subPostId: 8,
        content: "保留",
      },
    ]);
  });

  it("does not insert ordinary sub-post snapshots into published profile sub-posts", () => {
    const subPosts = [{ id: 8, subPostId: 8, content: "我发布的子帖" }];

    expect(syncExistingProfileSubPostListItem(subPosts, {
      id: 7,
      content: "别人发布的子帖",
      likeCount: 2,
    })).toEqual(subPosts);
  });

  it("updates existing profile sub-post rows when preferred ids are malformed", () => {
    expect(syncExistingProfileSubPostListItem([
      {
        id: 7,
        subPostId: "draft",
        content: "按 id 命中",
        favoriteCount: 1,
      },
    ], {
      id: "draft",
      subPostId: 7,
      favoriteCount: 2,
      favoritedByMe: true,
    })).toEqual([
      {
        id: 7,
        subPostId: 7,
        content: "按 id 命中",
        favoriteCount: 2,
        favoritedByMe: true,
      },
    ]);
  });

  it("updates existing profile sub-post rows using targetSubPostId aliases", () => {
    expect(syncExistingProfileSubPostListItem([
      {
        id: "draft",
        subPostId: "draft",
        targetSubPostId: 7,
        content: "按 targetSubPostId 命中",
        likeCount: 1,
      },
    ], {
      id: "draft",
      subPostId: "draft",
      targetSubPostId: 7,
      likeCount: 2,
      likedByMe: true,
    })).toEqual([
      {
        id: 7,
        subPostId: 7,
        targetSubPostId: 7,
        content: "按 targetSubPostId 命中",
        likeCount: 2,
        likedByMe: true,
      },
    ]);
  });
});

describe("syncProfileInteractionsForSavedPost", () => {
  it("updates matching main-post interaction records after a post is edited", () => {
    const nextInteractions = syncProfileInteractionsForSavedPost({
      postInteractions: [{
        id: 42,
        postId: 42,
        title: "旧标题",
        postTitle: "旧标题",
        action: "favorite",
      }],
      subPostInteractions: [],
    }, {
      id: 42,
      title: "新标题",
      communitySlug: "product",
    });

    expect(nextInteractions.postInteractions).toEqual([{
      id: 42,
      postId: 42,
      title: "新标题",
      postTitle: "新标题",
      communitySlug: "product",
      action: "favorite",
    }]);
  });

  it("updates main-post context inside matching sub-post interaction records", () => {
    const nextInteractions = syncProfileInteractionsForSavedPost({
      postInteractions: [{ id: 7, postId: 7, title: "其他主帖", action: "like" }],
      subPostInteractions: [{
        id: 99,
        subPostId: 99,
        postId: 42,
        mainPostId: 42,
        postTitle: "旧主帖",
        mainPostTitle: "旧主帖",
        mainPost: {
          id: 42,
          title: "旧主帖",
          communitySlug: "lobby",
        },
        action: "like",
      }],
    }, {
      id: 42,
      title: "新主帖",
      communitySlug: "product",
    });

    expect(nextInteractions.postInteractions[0].title).toBe("其他主帖");
    expect(nextInteractions.subPostInteractions[0]).toMatchObject({
      postId: 42,
      mainPostId: 42,
      postTitle: "新主帖",
      mainPostTitle: "新主帖",
      mainPost: {
        id: 42,
        postId: 42,
        title: "新主帖",
        communitySlug: "product",
      },
    });
  });

  it("updates sub-post interaction context when the nested main post uses postId", () => {
    const nextInteractions = syncProfileInteractionsForSavedPost({
      postInteractions: [],
      subPostInteractions: [{
        subPostId: 99,
        mainPost: {
          postId: 42,
          title: "旧主帖",
        },
        action: "favorite",
      }],
    }, {
      postId: 42,
      title: "新主帖",
    });

    expect(nextInteractions.subPostInteractions[0]).toMatchObject({
      postId: 42,
      mainPostId: 42,
      mainPostTitle: "新主帖",
      mainPost: {
        id: 42,
        postId: 42,
        title: "新主帖",
      },
    });
  });

  it("keeps interaction titles when partial saved snapshots omit the title", () => {
    const savedPost = {
      id: 42,
      title: undefined,
      communitySlug: "product",
    };
    const nextInteractions = syncProfileInteractionsForSavedPost({
      postInteractions: [{
        id: 42,
        postId: 42,
        title: "保留主帖",
        postTitle: "保留主帖",
        action: "favorite",
      }],
      subPostInteractions: [{
        subPostId: 99,
        postId: 42,
        mainPostId: 42,
        postTitle: "保留主帖",
        mainPostTitle: "保留主帖",
        mainPost: {
          id: 42,
          title: "保留主帖",
          communitySlug: "lobby",
        },
        action: "like",
      }],
    }, savedPost);

    expect(nextInteractions.postInteractions[0]).toMatchObject({
      title: "保留主帖",
      postTitle: "保留主帖",
      communitySlug: "product",
    });
    expect(nextInteractions.subPostInteractions[0]).toMatchObject({
      postTitle: "保留主帖",
      mainPostTitle: "保留主帖",
      mainPost: {
        title: "保留主帖",
        communitySlug: "product",
      },
    });
    expect(savedPost.title).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(savedPost, "title")).toBe(true);
  });

  it("preserves interaction lists when the saved post is unusable", () => {
    const interactions = {
      postInteractions: [{ id: 42, action: "like" }],
      subPostInteractions: [{ id: 7, action: "favorite" }],
    };

    expect(syncProfileInteractionsForSavedPost(interactions, null)).toEqual(interactions);
  });
});

describe("updateProfilePostInteractionList", () => {
  it("adds an active main-post interaction to the library list", () => {
    const nextInteractions = updateProfilePostInteractionList([], {
      post: {
        id: 42,
        title: "被收藏的主帖",
        communitySlug: "lobby",
      },
      action: "favorite",
      active: true,
      interactedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(nextInteractions).toEqual([{
      id: 42,
      postId: 42,
      title: "被收藏的主帖",
      postTitle: "被收藏的主帖",
      communitySlug: "lobby",
      action: "favorite",
      interactedAt: "2026-01-02T00:00:00.000Z",
      interactedAtText: "",
      likedByMe: false,
      favoritedByMe: true,
    }]);
  });

  it("removes only the matching action when a post interaction becomes inactive", () => {
    const nextInteractions = updateProfilePostInteractionList([
      {
        id: 42,
        postId: 42,
        title: "同时点赞收藏",
        action: "like",
      },
      {
        id: 42,
        postId: 42,
        title: "同时点赞收藏",
        action: "favorite",
      },
    ], {
      post: { id: 42 },
      action: "favorite",
      active: false,
    });

    expect(nextInteractions).toEqual([{
      id: 42,
      postId: 42,
      title: "同时点赞收藏",
      action: "like",
    }]);
  });

  it("ignores unusable interaction changes", () => {
    const interactions = [{ id: 42, action: "like" }];

    expect(updateProfilePostInteractionList(interactions, {
      post: { id: 42 },
      action: "share",
      active: true,
    })).toBe(interactions);
    expect(updateProfilePostInteractionList(interactions, {
      post: {},
      action: "like",
      active: true,
    })).toBe(interactions);
  });
});

describe("updateProfileInteractionsForPostAction", () => {
  it("updates post interactions while preserving sub-post interactions", () => {
    const nextInteractions = updateProfileInteractionsForPostAction({
      postInteractions: [],
      subPostInteractions: [{ id: 7, action: "favorite" }],
    }, {
      post: { id: 42, title: "新点赞" },
      action: "like",
      active: true,
      interactedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(nextInteractions.postInteractions).toHaveLength(1);
    expect(nextInteractions.postInteractions[0]).toMatchObject({
      id: 42,
      action: "like",
      likedByMe: true,
    });
    expect(nextInteractions.subPostInteractions).toEqual([{ id: 7, action: "favorite" }]);
  });
});

describe("updateProfileSubPostInteractionList", () => {
  it("adds an active sub-post interaction with its main post context", () => {
    const nextInteractions = updateProfileSubPostInteractionList([], {
      subPost: {
        id: 7,
        content: "这是一条子帖",
        author: "alice",
      },
      mainPost: {
        id: 42,
        title: "主帖标题",
        communitySlug: "lobby",
      },
      action: "like",
      active: true,
      interactedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(nextInteractions).toEqual([{
      id: 7,
      subPostId: 7,
      postId: 42,
      mainPostId: 42,
      postTitle: "主帖标题",
      mainPostTitle: "主帖标题",
      mainPost: {
        id: 42,
        postId: 42,
        title: "主帖标题",
        communitySlug: "lobby",
      },
      content: "这是一条子帖",
      author: "alice",
      authorUsername: "alice",
      subPostPreview: "这是一条子帖",
      action: "like",
      interactedAt: "2026-01-02T00:00:00.000Z",
      interactedAtText: "",
      likedByMe: true,
      favoritedByMe: false,
    }]);
  });

  it("adds an active sub-post interaction when the main post only exposes postId", () => {
    const nextInteractions = updateProfileSubPostInteractionList([], {
      subPost: {
        id: 7,
        content: "这是一条子帖",
      },
      mainPost: {
        postId: 42,
        title: "主帖标题",
      },
      action: "favorite",
      active: true,
      interactedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(nextInteractions[0]).toMatchObject({
      id: 7,
      subPostId: 7,
      postId: 42,
      mainPostId: 42,
      mainPost: {
        id: 42,
        postId: 42,
      },
      favoritedByMe: true,
    });
  });

  it("builds sub-post interactions from fallback ids when preferred fields are malformed", () => {
    const nextInteractions = updateProfileSubPostInteractionList([], {
      subPost: {
        id: 7,
        subPostId: "draft",
        mainPostId: "draft",
        postId: 42,
        content: "这是一条子帖",
      },
      mainPost: {
        id: "draft",
        postId: 42,
        title: "主帖标题",
      },
      action: "like",
      active: true,
      interactedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(nextInteractions[0]).toMatchObject({
      id: 7,
      subPostId: 7,
      postId: 42,
      mainPostId: 42,
      postTitle: "主帖标题",
      likedByMe: true,
    });
  });

  it("removes only the matching sub-post action when inactive", () => {
    const nextInteractions = updateProfileSubPostInteractionList([
      {
        subPostId: 7,
        action: "like",
      },
      {
        subPostId: 7,
        action: "favorite",
      },
    ], {
      subPost: { id: 7 },
      action: "like",
      active: false,
    });

    expect(nextInteractions).toEqual([{
      subPostId: 7,
      action: "favorite",
    }]);
  });
});

describe("updateProfileInteractionsForSubPostAction", () => {
  it("updates sub-post interactions while preserving main-post interactions", () => {
    const nextInteractions = updateProfileInteractionsForSubPostAction({
      postInteractions: [{ id: 42, action: "favorite" }],
      subPostInteractions: [],
    }, {
      subPost: { id: 7, content: "新收藏" },
      mainPost: { id: 42, title: "主帖" },
      action: "favorite",
      active: true,
      interactedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(nextInteractions.postInteractions).toEqual([{ id: 42, action: "favorite" }]);
    expect(nextInteractions.subPostInteractions).toHaveLength(1);
    expect(nextInteractions.subPostInteractions[0]).toMatchObject({
      subPostId: 7,
      action: "favorite",
      favoritedByMe: true,
    });
  });
});

describe("applyProfileInteractionChanges", () => {
  it("replays local sub-post interaction changes over freshly loaded server interactions", () => {
    const nextInteractions = applyProfileInteractionChanges({
      postInteractions: [{ id: 42, postId: 42, action: "like" }],
      subPostInteractions: [],
    }, [
      {
        target: "sub-post",
        change: {
          subPost: { id: 7, content: "刚刚点赞的子帖" },
          mainPost: { id: 42, title: "主帖" },
          action: "like",
          active: true,
          interactedAt: "2026-01-02T00:00:00.000Z",
        },
      },
    ]);

    expect(nextInteractions.postInteractions).toEqual([{ id: 42, postId: 42, action: "like" }]);
    expect(nextInteractions.subPostInteractions).toHaveLength(1);
    expect(nextInteractions.subPostInteractions[0]).toMatchObject({
      subPostId: 7,
      postId: 42,
      action: "like",
      likedByMe: true,
      subPostPreview: "刚刚点赞的子帖",
    });
  });

  it("lets local inactive interactions remove stale server rows", () => {
    const nextInteractions = applyProfileInteractionChanges({
      postInteractions: [{ id: 42, postId: 42, action: "favorite" }],
      subPostInteractions: [{ id: 7, subPostId: 7, mainPostId: 42, action: "like" }],
    }, [
      {
        target: "sub-post",
        change: {
          subPost: { id: 7 },
          mainPost: { id: 42 },
          action: "like",
          active: false,
        },
      },
      {
        target: "post",
        change: {
          post: { id: 42 },
          action: "favorite",
          active: false,
        },
      },
    ]);

    expect(nextInteractions).toEqual({
      postInteractions: [],
      subPostInteractions: [],
    });
  });

  it("ignores malformed pending interaction entries", () => {
    const interactions = {
      postInteractions: [{ id: 42, action: "like" }],
      subPostInteractions: [{ id: 7, action: "favorite" }],
    };

    expect(applyProfileInteractionChanges(interactions, [
      null,
      { target: "unknown", change: { id: 1 } },
    ])).toEqual(interactions);
  });
});
