import { describe, expect, it } from "vitest";
import {
  isPostMediaSourceReady,
  normalizePostMediaGridSourceItems,
  postMediaImageUrl,
} from "./PostMediaGrid";

describe("post media feed image readiness", () => {
  it("only treats ready media as loadable feed preview images", () => {
    expect(isPostMediaSourceReady({ processingStatus: "READY" })).toBe(true);
    expect(isPostMediaSourceReady({})).toBe(true);
    expect(isPostMediaSourceReady({ processingStatus: "PROCESSING", displayUrl: "/media/stale.webp" }))
      .toBe(false);
    expect(isPostMediaSourceReady({ processingStatus: "FAILED", src: "/media/broken.webp" }))
      .toBe(false);
  });

  it("does not return stale URLs for non-ready feed media", () => {
    expect(postMediaImageUrl({
      processingStatus: "PROCESSING",
      displayUrl: "/media/stale-processing.webp",
    })).toBe("");
    expect(postMediaImageUrl({
      processingStatus: "FAILED",
      src: "/media/stale-failed.webp",
    })).toBe("");
    expect(postMediaImageUrl({
      processingStatus: "READY",
      src: "/media/ready.webp",
    })).toBe("/media/ready.webp");
  });

  it("normalizes mixed feed preview media sources without rendering blank ready tiles", () => {
    expect(normalizePostMediaGridSourceItems({
      previewImageSources: [
        "/media/legacy-string.webp",
        "",
        { processingStatus: "READY" },
        { processingStatus: "PROCESSING" },
        { processingStatus: "FAILED" },
        { src: "/media/ready.webp", processingStatus: "READY" },
      ],
      previewImages: ["/media/fallback.webp"],
    })).toEqual([
      {
        src: "/media/legacy-string.webp",
        displayUrl: "/media/legacy-string.webp",
        processingStatus: "READY",
      },
      { processingStatus: "PROCESSING" },
      { processingStatus: "FAILED" },
      { src: "/media/ready.webp", processingStatus: "READY" },
    ]);
  });

  it("falls back to legacy previewImages when responsive sources are unavailable", () => {
    expect(normalizePostMediaGridSourceItems({
      previewImages: ["/media/a.webp", ""],
    })).toEqual([
      {
        src: "/media/a.webp",
        displayUrl: "/media/a.webp",
      },
    ]);
  });
});
