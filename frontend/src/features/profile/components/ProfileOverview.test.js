import { describe, expect, it } from "vitest";
import { countLibraryMainPosts } from "./ProfileOverview";

describe("countLibraryMainPosts", () => {
  it("deduplicates main posts across direct and nested postId aliases", () => {
    expect(countLibraryMainPosts({
      profilePosts: [{ id: 42 }],
      profileSubPosts: [{ mainPost: { postId: 42 } }, { mainPostId: 7 }],
    })).toBe(2);
  });

  it("falls back to usable aliases when overview post ids are malformed", () => {
    expect(countLibraryMainPosts({
      profilePosts: [
        { id: "draft", postId: 42 },
        { id: 42 },
      ],
      profileSubPosts: [
        { mainPostId: "draft", postId: 42 },
        { mainPost: { id: "draft", postId: 7 } },
      ],
    })).toBe(2);
  });

  it("counts action-specific library posts from nested main post aliases", () => {
    expect(countLibraryMainPosts({
      postInteractions: [{ postId: 42, action: "favorite" }],
      subPostInteractions: [
        { mainPost: { postId: 42 }, action: "favorite" },
        { mainPost: { postId: 7 }, action: "like" },
      ],
      action: "favorite",
    })).toBe(1);
  });

  it("deduplicates action-specific interactions with malformed preferred ids", () => {
    expect(countLibraryMainPosts({
      postInteractions: [{ id: "draft", postId: 42, action: "favorite" }],
      subPostInteractions: [
        { mainPostId: "draft", postId: 42, action: "favorite" },
        { mainPost: { id: "draft", postId: 42 }, action: "favorite" },
      ],
      action: "favorite",
    })).toBe(1);
  });
});
