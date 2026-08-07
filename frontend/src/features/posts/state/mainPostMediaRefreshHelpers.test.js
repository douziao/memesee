import { describe, expect, it } from "vitest";
import {
  collectMainPostIdsForMediaAssets,
  collectPendingMainPostMediaAssetIds,
  isMainPostMediaAssetRefreshPending,
  mergeRefreshedMediaAssetsIntoMainPost,
  mergeRefreshedMediaAssetsIntoMainPostList,
} from "./mainPostMediaRefreshHelpers";

describe("main post media refresh helpers", () => {
  it("collects unique processing media asset ids from visible posts", () => {
    expect(collectPendingMainPostMediaAssetIds([
      {
        id: 1,
        mediaAssets: [
          { id: 7, processingStatus: "PROCESSING" },
          { id: 8, processingStatus: "READY" },
        ],
      },
      {
        id: 2,
        mediaAssets: [
          { id: "7", processingStatus: "PROCESSING" },
          { id: 9, processingStatus: "FAILED" },
          { id: 10, processingStatus: "processing" },
        ],
      },
    ])).toEqual([7, 10]);

    expect(isMainPostMediaAssetRefreshPending({ id: 0, processingStatus: "PROCESSING" }))
      .toBe(false);
  });

  it("merges refreshed media metadata and rebuilds post media view fields", () => {
    const post = {
      id: 42,
      postMode: "rich",
      mediaUrls: [],
      mediaOriginalUrls: [],
      previewImages: [],
      mediaAssets: [
        {
          id: 7,
          processingStatus: "PROCESSING",
          width: 1600,
          height: 900,
        },
      ],
    };

    const nextPost = mergeRefreshedMediaAssetsIntoMainPost(post, [
      {
        id: 7,
        displayUrl: "/media/7/display.webp",
        thumbUrl: "/media/7/thumb.webp",
        originalUrl: "/media/7/original.webp",
        processingStatus: "READY",
        width: 1600,
        height: 900,
      },
    ], "https://api.example.com");

    expect(nextPost).not.toBe(post);
    expect(nextPost.mediaAssets[0]).toMatchObject({
      id: 7,
      displayUrl: "https://api.example.com/media/7/display.webp",
      thumbUrl: "https://api.example.com/media/7/thumb.webp",
      originalUrl: "https://api.example.com/media/7/original.webp",
      processingStatus: "READY",
    });
    expect(nextPost.mediaUrls).toEqual(["https://api.example.com/media/7/display.webp"]);
    expect(nextPost.mediaOriginalUrls).toEqual(["https://api.example.com/media/7/original.webp"]);
    expect(nextPost.previewImages).toEqual(["https://api.example.com/media/7/thumb.webp"]);
    expect(nextPost.mediaImageSources[0]).toMatchObject({
      src: "https://api.example.com/media/7/display.webp",
      displayUrl: "https://api.example.com/media/7/display.webp",
      processingStatus: "READY",
    });
    expect(nextPost.previewImageSources[0]).toMatchObject({
      src: "https://api.example.com/media/7/thumb.webp",
      processingStatus: "READY",
    });
  });

  it("returns the original post list when refreshed assets are not present", () => {
    const posts = [
      {
        id: 42,
        mediaAssets: [{ id: 7, processingStatus: "PROCESSING" }],
      },
    ];

    expect(mergeRefreshedMediaAssetsIntoMainPostList(posts, [
      { id: 8, processingStatus: "READY", displayUrl: "/media/8.webp" },
    ])).toBe(posts);
  });

  it("collects affected main post ids for refreshed media assets", () => {
    expect(collectMainPostIdsForMediaAssets([
      {
        id: "42",
        mediaAssets: [{ id: 7 }],
      },
      {
        postId: 43,
        mediaAssets: [{ id: 8 }],
      },
      {
        id: 44,
        mediaAssets: [{ id: 7 }],
      },
    ], [
      { id: 7 },
    ])).toEqual([42, 44]);
  });
});
