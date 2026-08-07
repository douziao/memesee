import { describe, expect, it } from "vitest";
import {
  buildPostPermalinkPath,
  buildPostPermalinkUrl,
  normalizePublicPostId,
} from "./postPermalink";

describe("postPermalink", () => {
  it("normalizes public post identifiers to positive integer strings", () => {
    expect(normalizePublicPostId(42)).toBe("42");
    expect(normalizePublicPostId("42")).toBe("42");
    expect(normalizePublicPostId(0)).toBe("");
    expect(normalizePublicPostId(-1)).toBe("");
    expect(normalizePublicPostId("abc")).toBe("");
  });

  it("builds public post and sub-post paths without private route state", () => {
    expect(buildPostPermalinkPath({ postId: 42 })).toBe("/posts/42");
    expect(buildPostPermalinkPath({
      postId: "42",
      targetSubPostId: "7",
    })).toBe("/posts/42?subPost=7");
    expect(buildPostPermalinkPath({
      postId: "42",
      targetSubPostId: "bad-id",
    })).toBe("/posts/42");
  });

  it("returns an empty permalink for invalid public post identifiers", () => {
    expect(buildPostPermalinkPath({ postId: "abc" })).toBe("");
    expect(buildPostPermalinkUrl({
      postId: -1,
      origin: "https://memesee.world",
    })).toBe("");
  });

  it("builds absolute URLs when an origin is available", () => {
    expect(buildPostPermalinkUrl({
      postId: 42,
      origin: "https://memesee.world",
      targetSubPostId: 7,
    })).toBe("https://memesee.world/posts/42?subPost=7");

    expect(buildPostPermalinkUrl({
      postId: 42,
      origin: "not a valid origin",
    })).toBe("/posts/42");
  });

  it("falls back to relative paths for non-web origins", () => {
    expect(buildPostPermalinkUrl({
      postId: 42,
      origin: "javascript:alert(1)",
      targetSubPostId: 7,
    })).toBe("/posts/42?subPost=7");

    expect(buildPostPermalinkUrl({
      postId: 42,
      origin: "file:///Users/nya/memesee/index.html",
    })).toBe("/posts/42");
  });
});
