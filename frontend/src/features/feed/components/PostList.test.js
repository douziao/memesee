import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildFeedLoadMoreState,
  buildFeedStatusState,
  feedPreviewImagePriority,
} from "./PostList";

const postListSource = readFileSync(new URL("./PostList.jsx", import.meta.url), "utf8");

describe("feedPreviewImagePriority", () => {
  it("prioritizes only the first visible feed previews", () => {
    expect(feedPreviewImagePriority(0)).toBe("high");
    expect(feedPreviewImagePriority(1)).toBe("eager");
    expect(feedPreviewImagePriority(2)).toBe("");
    expect(feedPreviewImagePriority(12)).toBe("");
  });

  it("keeps the first image high priority but suppresses eager loading on constrained networks", () => {
    expect(feedPreviewImagePriority(0, { canEagerLoad: false })).toBe("high");
    expect(feedPreviewImagePriority(1, { canEagerLoad: false })).toBe("");
    expect(feedPreviewImagePriority(2, { canEagerLoad: false })).toBe("");
  });
});

describe("buildFeedStatusState", () => {
  it("keeps loading, error, and empty feed states distinct", () => {
    expect(buildFeedStatusState({
      loadingPosts: true,
      hasPosts: false,
      feedError: "",
    }).type).toBe("loading");

    expect(buildFeedStatusState({
      loadingPosts: false,
      hasPosts: false,
      feedError: "信息流加载失败，请稍后重试。",
    })).toEqual({
      type: "error",
      title: "主帖加载失败",
      description: "信息流加载失败，请稍后重试。",
      actionLabel: "重试加载",
    });

    expect(buildFeedStatusState({
      loadingPosts: false,
      hasPosts: false,
      feedError: "",
    }).type).toBe("empty");
  });

  it("does not replace an existing feed with an error state", () => {
    expect(buildFeedStatusState({
      loadingPosts: false,
      hasPosts: true,
      feedError: "信息流加载失败，请稍后重试。",
    })).toEqual({ type: "" });
  });
});

describe("buildFeedLoadMoreState", () => {
  it("keeps load-more loading, error, more, and done states distinct", () => {
    expect(buildFeedLoadMoreState({
      loadingMorePosts: true,
      loadingMorePostsError: "加载更多失败，请稍后重试。",
      feedHasMore: true,
    })).toEqual({
      type: "loading",
      label: "正在加载更多内容...",
    });

    expect(buildFeedLoadMoreState({
      loadingMorePosts: false,
      loadingMorePostsError: "加载更多失败，请稍后重试。",
      feedHasMore: true,
    })).toEqual({
      type: "error",
      label: "加载更多失败，请稍后重试。",
      actionLabel: "重试加载更多",
    });

    expect(buildFeedLoadMoreState({
      loadingMorePosts: false,
      loadingMorePostsError: "",
      feedHasMore: true,
    })).toEqual({
      type: "more",
      label: "继续下滑查看更多",
    });

    expect(buildFeedLoadMoreState({
      loadingMorePosts: false,
      loadingMorePostsError: "",
      feedHasMore: false,
    })).toEqual({
      type: "done",
      label: "已经到底了",
    });
  });
});

describe("PostList share action contract", () => {
  it("does not render share actions for feed cards", () => {
    expect(postListSource).not.toContain("sharePost,");
    expect(postListSource).not.toContain("isSharingPost,");
    expect(postListSource).not.toContain("sharePost={sharePost}");
    expect(postListSource).not.toContain("isSharingPost={isSharingPost}");
  });
});
