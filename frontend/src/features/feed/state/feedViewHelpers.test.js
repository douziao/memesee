import { describe, expect, it } from "vitest";
import {
  normalizeFeedPage,
  resolveFeedContinuation,
  shouldSkipFeedAppend,
} from "./feedViewHelpers";

describe("normalizeFeedPage", () => {
  it("normalizes malformed feed page payloads", () => {
    expect(normalizeFeedPage(null)).toEqual({
      posts: [],
      nextCursor: "",
      hasMore: false,
    });
    expect(normalizeFeedPage({
      posts: null,
      nextCursor: 123,
      hasMore: "yes",
    })).toEqual({
      posts: [],
      nextCursor: "",
      hasMore: true,
    });
  });
});

describe("shouldSkipFeedAppend", () => {
  it("blocks append requests that cannot make progress", () => {
    expect(shouldSkipFeedAppend({
      append: false,
      loadingPosts: true,
      loadingMorePosts: true,
      feedHasMore: false,
      feedCursor: "",
    })).toBe(false);

    expect(shouldSkipFeedAppend({
      append: true,
      loadingPosts: false,
      loadingMorePosts: false,
      feedHasMore: true,
      feedCursor: "cursor-1",
    })).toBe(false);

    expect(shouldSkipFeedAppend({
      append: true,
      loadingPosts: true,
      loadingMorePosts: false,
      feedHasMore: true,
      feedCursor: "cursor-1",
    })).toBe(true);

    expect(shouldSkipFeedAppend({
      append: true,
      loadingPosts: false,
      loadingMorePosts: false,
      feedHasMore: true,
      feedCursor: "",
    })).toBe(true);
  });
});

describe("resolveFeedContinuation", () => {
  it("requires a cursor before keeping hasMore true", () => {
    expect(resolveFeedContinuation({
      append: false,
      previousCursor: "",
      nextCursor: "",
      hasMore: true,
    })).toEqual({
      nextCursor: "",
      hasMore: false,
    });
  });

  it("keeps normal first-page and append pagination progress", () => {
    expect(resolveFeedContinuation({
      append: false,
      previousCursor: "",
      nextCursor: "cursor-1",
      hasMore: true,
    })).toEqual({
      nextCursor: "cursor-1",
      hasMore: true,
    });

    expect(resolveFeedContinuation({
      append: true,
      previousCursor: "cursor-1",
      nextCursor: "cursor-2",
      hasMore: true,
    })).toEqual({
      nextCursor: "cursor-2",
      hasMore: true,
    });
  });

  it("stops append pagination when a response repeats the requested cursor", () => {
    expect(resolveFeedContinuation({
      append: true,
      previousCursor: "cursor-1",
      nextCursor: "cursor-1",
      hasMore: true,
    })).toEqual({
      nextCursor: "",
      hasMore: false,
    });
  });
});
