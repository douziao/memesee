import { describe, expect, it } from "vitest";
import {
  buildImageViewerPayloadFromEntries,
  comparableImageKey,
  dedupeImageViewerImages,
  resolveImageViewerIndex,
} from "./imageViewerPayload";

describe("image viewer payload helpers", () => {
  it("compares image URLs without version params or hash fragments", () => {
    expect(comparableImageKey(
      "/media/a.webp?v=12#preview",
      "/api",
      "https://memesee.example",
    )).toBe("/api/media/a.webp");
  });

  it("finds a comparable image when exact URLs differ only by cache-busting data", () => {
    expect(resolveImageViewerIndex(
      [
        "/media/a.webp?v=1#old",
        "/media/b.webp",
      ],
      "/media/a.webp?v=2#current",
      undefined,
      { origin: "https://memesee.example" },
    )).toBe(0);
  });

  it("dedupes comparable viewer images while preserving the requested duplicate", () => {
    expect(dedupeImageViewerImages([
      "/media/a.webp?v=1",
      "/media/b.webp",
      "/media/a.webp?v=2",
    ], {
      targetUrl: "/media/a.webp?v=2",
      preferredIndex: 2,
      origin: "https://memesee.example",
    })).toEqual([
      {
        image: "/media/a.webp?v=2",
        sourceIndex: 2,
      },
      {
        image: "/media/b.webp",
        sourceIndex: 1,
      },
    ]);
  });

  it("builds aligned viewer payloads from source-indexed entries", () => {
    expect(buildImageViewerPayloadFromEntries({
      entries: [
        {
          imageUrl: "/media/a.webp",
          originalUrl: "/media/a-original.webp",
          imageSource: { src: "/media/a.webp" },
          sourceIndex: 1,
        },
        {
          imageUrl: "/media/b.webp",
          originalUrl: "/media/b-original.webp",
          imageSource: { displayUrl: "/media/b.webp" },
          sourceIndex: 3,
        },
      ],
      currentSourceIndex: 3,
    })).toEqual({
      images: ["/media/a.webp", "/media/b.webp"],
      imageSources: [
        { src: "/media/a.webp" },
        { displayUrl: "/media/b.webp" },
      ],
      originalImages: ["/media/a-original.webp", "/media/b-original.webp"],
      startIndex: 1,
      originalUrl: "/media/b-original.webp",
    });
  });

  it("preserves the requested duplicate entry when building a viewer payload", () => {
    expect(buildImageViewerPayloadFromEntries({
      entries: [
        {
          imageUrl: "/media/repeated.webp?v=1",
          originalUrl: "/media/repeated-old.webp",
          imageSource: { src: "/media/repeated.webp?v=1" },
          sourceIndex: 0,
        },
        {
          imageUrl: "/media/other.webp",
          originalUrl: "/media/other-original.webp",
          imageSource: { src: "/media/other.webp" },
          sourceIndex: 1,
        },
        {
          imageUrl: "/media/repeated.webp?v=2#current",
          originalUrl: "/media/repeated-current.webp",
          imageSource: { src: "/media/repeated.webp?v=2#current" },
          sourceIndex: 2,
        },
      ],
      currentSourceIndex: 2,
      origin: "https://memesee.example",
    })).toEqual({
      images: ["/media/repeated.webp?v=2#current", "/media/other.webp"],
      imageSources: [
        { src: "/media/repeated.webp?v=2#current" },
        { src: "/media/other.webp" },
      ],
      originalImages: ["/media/repeated-current.webp", "/media/other-original.webp"],
      startIndex: 0,
      originalUrl: "/media/repeated-current.webp",
    });
  });

  it("keeps the gallery available but marks a non-viewable current source as not openable", () => {
    expect(buildImageViewerPayloadFromEntries({
      entries: [
        {
          imageUrl: "/media/ready.webp",
          imageSource: { src: "/media/ready.webp" },
          sourceIndex: 1,
        },
      ],
      currentSourceIndex: 0,
    })).toEqual({
      images: ["/media/ready.webp"],
      imageSources: [{ src: "/media/ready.webp" }],
      originalImages: [""],
      startIndex: -1,
      originalUrl: "",
    });
  });
});
