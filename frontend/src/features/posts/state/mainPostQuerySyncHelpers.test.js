import { describe, expect, it } from "vitest";
import {
  syncLoadedMainPostIntoFeed,
  syncSavedMainPostIntoFeed,
  syncSavedMainPostIntoDetail,
  syncDeletedMainPostIntoFeed,
  syncDeletedSubPostIntoDetail,
  syncDeletedSubPostIntoFeed,
} from "./mainPostQuerySyncHelpers";

describe("loaded main post feed sync", () => {
  it("hydrates feed card display fields from a freshly loaded detail post", () => {
    const posts = [
      {
        id: 42,
        title: "旧标题",
        content: "旧正文",
        preview: "旧摘要",
        postMode: "rich",
        communitySlug: "lobby",
        communityName: "大厅",
        tags: ["旧"],
        mediaUrls: ["/old.webp"],
        mediaAssets: [{ id: 1, url: "/old.webp" }],
        previewImages: ["/old.webp"],
        likedByMe: false,
        favoritedByMe: false,
        viewCount: 10,
        likeCount: 1,
        favoriteCount: 1,
        subPostCount: 1,
        hotScore: 6,
        createdAt: "2026-01-01T00:00:00.000Z",
        latestActivityAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const nextPosts = syncLoadedMainPostIntoFeed(posts, {
      id: 42,
      title: "新标题",
      content: "新正文",
      preview: "新摘要",
      postMode: "long",
      communitySlug: "product",
      communityName: "产品",
      tags: ["新"],
      mediaUrls: [],
      mediaOriginalUrls: [],
      mediaAssets: [],
      mediaImageSources: [],
      previewImages: [],
      previewImageSources: [],
      likedByMe: true,
      favoritedByMe: true,
      viewCount: 12,
      likeCount: 2,
      favoriteCount: 3,
      subPostCount: 4,
      hotScore: 21,
      updatedAt: "2026-01-02T00:00:00.000Z",
      latestActivityAt: "2026-01-02T00:00:00.000Z",
      latestActivityAtText: "刚刚",
    }, {
      feedSortMode: "latest_message",
    });

    expect(nextPosts[0]).toMatchObject({
      id: 42,
      title: "新标题",
      content: "新正文",
      preview: "新摘要",
      postMode: "long",
      communitySlug: "product",
      communityName: "产品",
      tags: ["新"],
      mediaUrls: [],
      mediaAssets: [],
      previewImages: [],
      likedByMe: true,
      favoritedByMe: true,
      viewCount: 12,
      likeCount: 2,
      favoriteCount: 3,
      subPostCount: 4,
      latestActivityAt: "2026-01-02T00:00:00.000Z",
      latestActivityAtText: "刚刚",
    });
  });

  it("treats freshly loaded detail counts as authoritative when they decrease", () => {
    const nextPosts = syncLoadedMainPostIntoFeed([
      {
        id: 42,
        title: "旧卡片",
        viewCount: 9,
        likeCount: 8,
        favoriteCount: 4,
        subPostCount: 3,
      },
    ], {
      id: 42,
      viewCount: 10,
      likeCount: 6,
      favoriteCount: 2,
      subPostCount: 1,
    }, {
      feedSortMode: "latest_message",
    });

    expect(nextPosts[0]).toMatchObject({
      viewCount: 10,
      likeCount: 6,
      favoriteCount: 2,
      subPostCount: 1,
    });
  });
});

describe("saved main post feed sync", () => {
  it("removes an edited post from the current feed when it no longer matches the feed target", () => {
    const posts = [
      {
        id: 42,
        title: "原本在大厅",
        communitySlug: "lobby",
      },
      {
        id: 7,
        title: "仍在大厅",
        communitySlug: "lobby",
      },
    ];

    const nextPosts = syncSavedMainPostIntoFeed(posts, {
      id: 42,
      title: "已移动到产品社区",
      communitySlug: "product",
    }, {
      selectedCommunitySlug: "memes",
      feedSortMode: "latest_message",
    });

    expect(nextPosts).toEqual([posts[1]]);
  });

  it("upserts a saved post when it still belongs in the current feed", () => {
    const nextPosts = syncSavedMainPostIntoFeed([
      {
        id: 7,
        title: "旧帖子",
        communitySlug: "lobby",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ], {
      id: 42,
      title: "新发布",
      communitySlug: "lobby",
      createdAt: "2026-01-02T00:00:00.000Z",
    }, {
      selectedCommunitySlug: "lobby",
      feedSortMode: "latest_message",
    });

    expect(nextPosts.map((post) => post.id)).toEqual([42, 7]);
  });

  it("accepts postId aliases when syncing saved posts into the feed", () => {
    const nextPosts = syncSavedMainPostIntoFeed([
      {
        id: 7,
        title: "旧帖子",
        communitySlug: "lobby",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ], {
      postId: 42,
      title: "新发布",
      communitySlug: "lobby",
      createdAt: "2026-01-02T00:00:00.000Z",
    }, {
      selectedCommunitySlug: "lobby",
      feedSortMode: "latest_message",
    });

    expect(nextPosts[0]).toMatchObject({
      id: 42,
      title: "新发布",
    });
    expect(nextPosts.map((post) => post.id)).toEqual([42, 7]);
  });

  it("removes postId alias saved posts that no longer belong in the current feed", () => {
    const posts = [
      {
        postId: 42,
        title: "原本在大厅",
        communitySlug: "lobby",
      },
      {
        id: 7,
        title: "仍在大厅",
        communitySlug: "lobby",
      },
    ];

    const nextPosts = syncSavedMainPostIntoFeed(posts, {
      postId: 42,
      title: "已移动到产品社区",
      communitySlug: "product",
    }, {
      selectedCommunitySlug: "memes",
      feedSortMode: "latest_message",
    });

    expect(nextPosts).toEqual([posts[1]]);
  });
});

describe("saved main post detail sync", () => {
  it("accepts postId aliases when syncing saved posts into the current detail", () => {
    const nextDetail = syncSavedMainPostIntoDetail({
      id: 42,
      title: "旧标题",
    }, {
      postId: 42,
      title: "新标题",
    });

    expect(nextDetail).toMatchObject({
      id: 42,
      title: "新标题",
    });
  });
});

describe("deleted sub-post main post sync", () => {
  it("syncs deleted sub-post counts into feed without touching other posts", () => {
    const posts = [
      {
        id: 42,
        title: "目标主帖",
        viewCount: 10,
        subPostCount: 3,
        likeCount: 0,
        favoriteCount: 0,
      },
      {
        id: 7,
        title: "其他主帖",
        subPostCount: 5,
      },
    ];

    const nextPosts = syncDeletedSubPostIntoFeed(posts, 42);

    expect(nextPosts[0].subPostCount).toBe(2);
    expect(nextPosts[1]).toBe(posts[1]);
  });

  it("syncs deleted sub-post counts into the current detail post", () => {
    const nextDetail = syncDeletedSubPostIntoDetail({
      id: 42,
      subPostCount: 1,
    }, 42);

    expect(nextDetail.subPostCount).toBe(0);
  });
});

describe("deleted main post sync", () => {
  it("removes deleted main posts when API and UI id types differ", () => {
    const posts = [
      {
        id: "42",
        title: "Deleted",
      },
      {
        id: 7,
        title: "Remaining",
      },
    ];

    expect(syncDeletedMainPostIntoFeed(posts, 42)).toEqual([posts[1]]);
  });
});
