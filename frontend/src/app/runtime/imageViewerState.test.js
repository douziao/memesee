import { describe, expect, it } from "vitest";
import {
  buildImageViewerState,
  comparableImageKey,
  dedupeImageViewerImages,
  resolveImageViewerIndex,
} from "./imageViewerState";

describe("image viewer state helpers", () => {
  it("builds a normalized viewer payload from gallery images and original image candidates", () => {
    expect(buildImageViewerState({
      url: "/media/b-display.webp?v=2#preview",
      sourceImages: ["/media/a-display.webp", "/media/b-display.webp?v=1"],
      options: {
        originalImages: ["", "/media/b-original.webp"],
        imageSources: [
          {
            src: "/media/a-display.webp",
            originalUrl: "/media/a-original.webp",
          },
          {
            src: "/media/b-display.webp",
            originalUrl: "/media/b-source-original.webp",
          },
        ],
      },
      apiBase: "/api",
      origin: "https://memesee.example",
    })).toEqual({
      images: ["/api/media/a-display.webp", "/api/media/b-display.webp?v=1"],
      index: 1,
      originalImages: ["/api/media/a-original.webp", "/api/media/b-original.webp"],
      imageSources: [
        {
          src: "/api/media/a-display.webp",
          displayUrl: "/api/media/a-display.webp",
          originalUrl: "/api/media/a-original.webp",
        },
        {
          src: "/api/media/b-display.webp",
          displayUrl: "/api/media/b-display.webp",
          originalUrl: "/api/media/b-source-original.webp",
        },
      ],
    });
  });

  it("falls back to image sources when no explicit gallery is provided", () => {
    expect(buildImageViewerState({
      url: "/media/ready-b.webp",
      options: {
        imageSources: [
          { src: "/media/ready-a.webp" },
          { displayUrl: "/media/ready-b.webp", originalUrl: "/media/original-b.webp" },
        ],
      },
      apiBase: "/api",
      origin: "https://memesee.example",
    })).toMatchObject({
      images: ["/api/media/ready-a.webp", "/api/media/ready-b.webp"],
      index: 1,
      originalImages: ["", "/api/media/original-b.webp"],
    });
  });

  it("returns null when the requested image URL is empty", () => {
    expect(buildImageViewerState({ url: "", sourceImages: ["/media/a.webp"] })).toBeNull();
  });

  it("dedupes viewer images by comparable URL while preserving the requested duplicate", () => {
    expect(buildImageViewerState({
      url: "/media/a-display.webp?v=2",
      sourceImages: [
        "/media/a-display.webp?v=1",
        "/media/b-display.webp",
        "/media/a-display.webp?v=2",
      ],
      options: {
        originalImages: [
          "/media/a-original-old.webp",
          "/media/b-original.webp",
          "/media/a-original-current.webp",
        ],
      },
      origin: "https://memesee.example",
    })).toMatchObject({
      images: ["/media/a-display.webp?v=2", "/media/b-display.webp"],
      index: 0,
      originalImages: ["/media/a-original-current.webp", "/media/b-original.webp"],
    });
  });

  it("compares image URLs without cache-busting version params or hash fragments", () => {
    expect(comparableImageKey(
      "/media/a.webp?v=12#section",
      "/api",
      "https://memesee.example",
    )).toBe("/api/media/a.webp");
  });

  it("uses a valid preferred index before URL matching", () => {
    expect(resolveImageViewerIndex(
      ["/media/a.webp", "/media/b.webp"],
      "/media/a.webp",
      1,
    )).toBe(1);
  });

  it("keeps the first entry for non-target duplicate viewer images", () => {
    expect(dedupeImageViewerImages([
      "/media/a.webp?v=1",
      "/media/b.webp",
      "/media/a.webp?v=2",
    ], {
      targetUrl: "/media/b.webp",
      preferredIndex: 1,
      origin: "https://memesee.example",
    })).toEqual([
      {
        image: "/media/a.webp?v=1",
        sourceIndex: 0,
      },
      {
        image: "/media/b.webp",
        sourceIndex: 1,
      },
    ]);
  });
});
