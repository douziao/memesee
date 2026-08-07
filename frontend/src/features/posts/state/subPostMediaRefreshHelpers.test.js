import { describe, expect, it } from "vitest";
import {
  collectPendingSubPostMediaAssetIds,
  collectSubPostIdsForMediaAssets,
  isSubPostMediaAssetRefreshPending,
  mergeRefreshedMediaAssetsIntoSubPost,
  mergeRefreshedMediaAssetsIntoSubPostList,
} from "./subPostMediaRefreshHelpers";

describe("sub-post media refresh helpers", () => {
  it("collects unique processing media asset ids from loaded sub-posts", () => {
    expect(collectPendingSubPostMediaAssetIds([
      {
        id: 7,
        mediaAssets: [
          { id: 11, processingStatus: "PROCESSING" },
          { id: 12, processingStatus: "READY" },
        ],
      },
      {
        id: 8,
        mediaAssets: [
          { id: "11", processingStatus: "PROCESSING" },
          { id: 13, processingStatus: "processing" },
        ],
      },
    ])).toEqual([11, 13]);

    expect(isSubPostMediaAssetRefreshPending({ id: 0, processingStatus: "PROCESSING" }))
      .toBe(false);
  });

  it("merges refreshed media metadata into sub-post media fields", () => {
    const subPost = {
      id: 7,
      mediaUrls: [],
      mediaOriginalUrls: [],
      mediaAssets: [
        {
          id: 11,
          processingStatus: "PROCESSING",
          width: 1600,
          height: 900,
        },
      ],
    };

    const nextSubPost = mergeRefreshedMediaAssetsIntoSubPost(subPost, [
      {
        id: 11,
        displayUrl: "/media/11/display.webp",
        thumbUrl: "/media/11/thumb.webp",
        originalUrl: "/media/11/original.webp",
        processingStatus: "READY",
        width: 1600,
        height: 900,
      },
    ], "https://api.example.com");

    expect(nextSubPost).not.toBe(subPost);
    expect(nextSubPost.mediaUrls).toEqual(["https://api.example.com/media/11/display.webp"]);
    expect(nextSubPost.mediaOriginalUrls).toEqual(["https://api.example.com/media/11/original.webp"]);
    expect(nextSubPost.mediaAssets[0]).toMatchObject({
      id: 11,
      displayUrl: "https://api.example.com/media/11/display.webp",
      processingStatus: "READY",
    });
    expect(nextSubPost.mediaImageSources[0]).toMatchObject({
      src: "https://api.example.com/media/11/display.webp",
      processingStatus: "READY",
    });
  });

  it("returns the original list when refreshed assets do not match loaded sub-posts", () => {
    const subPosts = [
      {
        id: 7,
        mediaAssets: [{ id: 11, processingStatus: "PROCESSING" }],
      },
    ];

    expect(mergeRefreshedMediaAssetsIntoSubPostList(subPosts, [
      { id: 12, displayUrl: "/media/12.webp", processingStatus: "READY" },
    ])).toBe(subPosts);
  });

  it("collects affected sub-post ids for refreshed media assets", () => {
    expect(collectSubPostIdsForMediaAssets([
      {
        id: "7",
        mediaAssets: [{ id: 11 }],
      },
      {
        subPostId: 8,
        mediaAssets: [{ id: 12 }],
      },
      {
        targetSubPostId: 9,
        mediaAssets: [{ id: 11 }],
      },
    ], [
      { id: 11 },
    ])).toEqual([7, 9]);
  });
});
