import { describe, expect, it } from "vitest";
import {
  buildPostDetailSelectedPostViewModel,
  buildPostDetailViewModel,
} from "./postDetailViewModelHelpers";

describe("post detail view-model helpers", () => {
  it("does not select post details for inactive or mismatched routes", () => {
    expect(buildPostDetailSelectedPostViewModel({
      route: { type: "home" },
      postDetail: { id: 42, likeCount: 9 },
    })).toEqual({
      selectedPost: null,
      selectedLikeCount: 0,
      selectedFavoriteCount: 0,
      richDetailImages: [],
      richOriginalImages: [],
      richImageSources: [],
    });

    expect(buildPostDetailSelectedPostViewModel({
      route: { type: "post", mainPostId: 43 },
      postDetail: { id: 42, likeCount: 9 },
    }).selectedPost).toBeNull();
  });

  it("selects matching non-rich posts and normalizes engagement counts", () => {
    const post = {
      id: 42,
      postMode: "plain",
      likeCount: "7",
      favoriteCount: "3",
      mediaUrls: ["ignored.jpg"],
    };

    expect(buildPostDetailSelectedPostViewModel({
      route: { type: "post", mainPostId: "42" },
      postDetail: post,
    })).toEqual({
      selectedPost: post,
      selectedLikeCount: 7,
      selectedFavoriteCount: 3,
      richDetailImages: [],
      richOriginalImages: [],
      richImageSources: [],
    });
  });

  it("normalizes malformed engagement counts to zero", () => {
    const viewModel = buildPostDetailSelectedPostViewModel({
      route: { type: "post", mainPostId: 42 },
      postDetail: {
        id: 42,
        postMode: "plain",
        likeCount: "not-a-number",
        favoriteCount: -3,
      },
    });

    expect(viewModel.selectedLikeCount).toBe(0);
    expect(viewModel.selectedFavoriteCount).toBe(0);
  });

  it("builds fallback rich image sources from display and original URLs", () => {
    const post = {
      id: 42,
      postMode: "rich",
      mediaUrls: ["display-1.jpg", "display-2.jpg"],
      mediaOriginalUrls: ["original-1.jpg"],
    };

    const viewModel = buildPostDetailSelectedPostViewModel({
      route: { type: "post", mainPostId: 42 },
      postDetail: post,
    });

    expect(viewModel.richDetailImages).toEqual(["display-1.jpg", "display-2.jpg"]);
    expect(viewModel.richOriginalImages).toEqual(["original-1.jpg"]);
    expect(viewModel.richImageSources).toEqual([
      {
        src: "display-1.jpg",
        displayUrl: "display-1.jpg",
        originalUrl: "original-1.jpg",
      },
      {
        src: "display-2.jpg",
        displayUrl: "display-2.jpg",
        originalUrl: "display-2.jpg",
      },
    ]);
  });

  it("prefers explicit rich image sources when available", () => {
    const explicitSources = [{
      src: "asset.jpg",
      displayUrl: "display.jpg",
      originalUrl: "original.jpg",
    }];

    expect(buildPostDetailSelectedPostViewModel({
      route: { type: "post", mainPostId: 42 },
      postDetail: {
        id: 42,
        postMode: "rich",
        mediaUrls: ["ignored.jpg"],
        mediaOriginalUrls: ["ignored-original.jpg"],
        mediaImageSources: explicitSources,
      },
    }).richImageSources).toBe(explicitSources);
  });

  it("filters invalid rich media URLs before building fallback sources", () => {
    const viewModel = buildPostDetailSelectedPostViewModel({
      route: { type: "post", mainPostId: 42 },
      postDetail: {
        id: 42,
        postMode: "rich",
        mediaUrls: [" display.jpg ", "", null, "second.jpg"],
        mediaOriginalUrls: [" original.jpg ", 42, ""],
      },
    });

    expect(viewModel.richDetailImages).toEqual(["display.jpg", "second.jpg"]);
    expect(viewModel.richOriginalImages).toEqual(["original.jpg"]);
    expect(viewModel.richImageSources).toEqual([
      {
        src: "display.jpg",
        displayUrl: "display.jpg",
        originalUrl: "original.jpg",
      },
      {
        src: "second.jpg",
        displayUrl: "second.jpg",
        originalUrl: "second.jpg",
      },
    ]);
  });

  it("filters invalid explicit rich image sources while keeping usable ones", () => {
    const usableSource = {
      displayUrl: "display.jpg",
    };

    expect(buildPostDetailSelectedPostViewModel({
      route: { type: "post", mainPostId: 42 },
      postDetail: {
        id: 42,
        postMode: "rich",
        mediaImageSources: [
          null,
          {},
          { src: " " },
          usableSource,
        ],
        mediaUrls: ["fallback.jpg"],
      },
    }).richImageSources).toEqual([usableSource]);
  });

  it("keeps non-ready explicit rich image sources so detail pages can show media status placeholders", () => {
    const processingSource = {
      id: 7,
      processingStatus: "PROCESSING",
      width: 1600,
      height: 900,
    };
    const failedSource = {
      id: 8,
      processingStatus: "FAILED",
    };

    expect(buildPostDetailSelectedPostViewModel({
      route: { type: "post", mainPostId: 42 },
      postDetail: {
        id: 42,
        postMode: "rich",
        mediaImageSources: [
          processingSource,
          failedSource,
          {},
        ],
        mediaUrls: ["fallback.jpg"],
      },
    }).richImageSources).toEqual([processingSource, failedSource]);
  });

  it("builds selected post and ordered sub-post thread view-models together", () => {
    const post = {
      id: 42,
      postMode: "plain",
      likeCount: 2,
      favoriteCount: 1,
    };
    const viewModel = buildPostDetailViewModel({
      route: { type: "post", mainPostId: 42 },
      postDetail: post,
      subPosts: [
        { id: 3, content: "third", createdAt: "2026-01-01T00:02:00.000Z" },
        { id: 1, content: "first", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: 2, parentId: 1, content: "branch", createdAt: "2026-01-01T00:01:00.000Z" },
      ],
    });

    expect(viewModel.selectedPost).toBe(post);
    expect(viewModel.selectedLikeCount).toBe(2);
    expect(viewModel.subPostNodeMap.get(1).branchSubPosts.map((item) => item.id)).toEqual([2]);
    expect(viewModel.orderedSubPostFloors.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("builds empty sub-post thread view-models from malformed input", () => {
    const viewModel = buildPostDetailViewModel({
      route: { type: "post", mainPostId: 42 },
      postDetail: { id: 42 },
      subPosts: null,
    });

    expect(viewModel.subPostNodeMap).toBeInstanceOf(Map);
    expect(viewModel.subPostNodeMap.size).toBe(0);
    expect(viewModel.orderedSubPostFloors).toEqual([]);
  });
});
