import { describe, expect, it } from "vitest";
import {
  mergeFeedSnapshotWithKnownState,
  mergePostPages,
  patchMainPostDetail,
  patchMainPostInFeed,
  resolveMainPostId,
  upsertMainPostInFeed,
} from "./mainPostStateHelpers";

describe("main post state sync helpers", () => {
  it("resolves main post ids through the shared identity helper", () => {
    expect(resolveMainPostId({ id: "draft", postId: 42 })).toBe(42);
    expect(resolveMainPostId({ mainPostId: "42" })).toBe(42);
  });

  it("merges feed snapshots into known posts when id types differ", () => {
    const existingPost = {
      id: 42,
      title: "Old",
      likeCount: 1,
    };

    const nextPosts = mergeFeedSnapshotWithKnownState([
      existingPost,
    ], [
      {
        id: "42",
        title: "New",
        likeCount: 2,
      },
    ]);

    expect(nextPosts).toHaveLength(1);
    expect(nextPosts[0]).toMatchObject({
      id: "42",
      title: "New",
      likeCount: 2,
    });
  });

  it("merges feed snapshots into known posts when incoming posts use postId", () => {
    const nextPosts = mergeFeedSnapshotWithKnownState([
      {
        id: 42,
        title: "Old",
        likeCount: 1,
      },
    ], [
      {
        postId: 42,
        title: "New",
        likeCount: 2,
      },
    ]);

    expect(nextPosts).toHaveLength(1);
    expect(nextPosts[0]).toMatchObject({
      postId: 42,
      title: "New",
      likeCount: 2,
    });
  });

  it("merges paged posts instead of duplicating mixed-type ids", () => {
    const nextPosts = mergePostPages([
      {
        id: 42,
        title: "Old",
      },
    ], [
      {
        id: "42",
        title: "Updated",
      },
    ]);

    expect(nextPosts).toHaveLength(1);
    expect(nextPosts[0]).toMatchObject({
      id: "42",
      title: "Updated",
    });
  });

  it("merges paged posts instead of duplicating postId aliases", () => {
    const nextPosts = mergePostPages([
      {
        postId: 42,
        title: "Old",
      },
    ], [
      {
        id: 42,
        title: "Updated",
      },
    ]);

    expect(nextPosts).toHaveLength(1);
    expect(nextPosts[0]).toMatchObject({
      id: 42,
      title: "Updated",
    });
  });

  it("patches feed and detail posts when id types differ", () => {
    const posts = [
      {
        id: "42",
        title: "Old",
      },
      {
        id: 7,
        title: "Other",
      },
    ];

    const nextPosts = patchMainPostInFeed(posts, 42, { title: "New" });

    expect(nextPosts[0]).toMatchObject({
      id: "42",
      title: "New",
    });
    expect(nextPosts[1]).toBe(posts[1]);

    expect(patchMainPostDetail({
      id: "42",
      title: "Old",
    }, 42, { title: "New" })).toMatchObject({
      id: "42",
      title: "New",
    });
  });

  it("patches feed and detail posts that only expose postId aliases", () => {
    const posts = [
      {
        postId: 42,
        title: "Old",
      },
      {
        id: 7,
        title: "Other",
      },
    ];

    const nextPosts = patchMainPostInFeed(posts, 42, { title: "New" });

    expect(nextPosts[0]).toMatchObject({
      postId: 42,
      title: "New",
    });
    expect(nextPosts[1]).toBe(posts[1]);

    expect(patchMainPostDetail({
      postId: 42,
      title: "Old",
    }, 42, { title: "New" })).toMatchObject({
      postId: 42,
      title: "New",
    });
  });

  it("upserts mixed-type ids without duplicating feed cards", () => {
    const nextPosts = upsertMainPostInFeed([
      {
        id: 42,
        title: "Old",
      },
    ], {
      id: "42",
      title: "New",
    });

    expect(nextPosts).toHaveLength(1);
    expect(nextPosts[0]).toMatchObject({
      id: 42,
      title: "New",
    });
  });

  it("upserts postId aliases as feed cards with normalized ids", () => {
    const nextPosts = upsertMainPostInFeed([
      {
        id: 42,
        title: "Old",
      },
    ], {
      postId: 42,
      title: "New",
    });

    expect(nextPosts).toHaveLength(1);
    expect(nextPosts[0]).toMatchObject({
      id: 42,
      postId: 42,
      title: "New",
    });
  });

  it("ignores upserts without a usable post id", () => {
    const posts = [
      {
        id: 42,
        title: "Old",
      },
    ];

    expect(upsertMainPostInFeed(posts, { title: "Missing id" })).toBe(posts);
  });
});
