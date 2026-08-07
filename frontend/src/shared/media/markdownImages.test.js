import { describe, expect, it } from "vitest";
import {
  buildMarkdownImageGallery,
  buildMarkdownImageStyles,
  findMarkdownImageGalleryStartIndex,
  isMarkdownImageSourceReady,
  markdownImageStatusLabel,
  resolveMarkdownImageData,
} from "./markdownImages";

describe("markdown image layout", () => {
  it("reserves image space from responsive source dimensions", () => {
    const { frameStyle, imageStyle } = buildMarkdownImageStyles({
      imageSource: {
        width: 1600,
        height: 900,
      },
    });

    expect(frameStyle).toEqual({ aspectRatio: "1600 / 900" });
    expect(imageStyle).toEqual({});
  });

  it("uses explicit markdown dimensions for the reserved aspect ratio", () => {
    const { frameStyle, imageStyle } = buildMarkdownImageStyles({
      width: "640px",
      height: "360px",
      imageSource: {
        width: 1600,
        height: 1200,
      },
    });

    expect(frameStyle).toEqual({
      width: "640px",
      maxWidth: "100%",
      aspectRatio: "640 / 360",
    });
    expect(imageStyle).toEqual({
      width: "100%",
      maxWidth: "100%",
      height: "auto",
      maxHeight: "360px",
    });
  });

  it("resolves media references with stable frame aspect ratios", () => {
    const mediaAssetMap = new Map([
      [42, {
        id: 42,
        width: 1600,
        height: 900,
        mediumUrl: "/media/42-medium.webp",
      }],
    ]);

    const imageData = resolveMarkdownImageData({
      src: "media:42",
      alt: "sample",
      mediaAssetMap,
    });

    expect(imageData.frameStyle).toEqual({ aspectRatio: "1080 / 608" });
    expect(imageData.imageSource.width).toBe(1080);
    expect(imageData.imageSource.height).toBe(608);
  });

  it("keeps non-ready media as status placeholders without loading stale URLs", () => {
    const mediaAssetMap = new Map([
      [42, {
        id: 42,
        width: 1600,
        height: 900,
        mediumUrl: "/media/stale-medium.webp",
        processingStatus: "PROCESSING",
      }],
    ]);

    const imageData = resolveMarkdownImageData({
      src: "media:42",
      alt: "sample",
      mediaAssetMap,
    });

    expect(imageData.imageUrl).toBe("");
    expect(imageData.imageReady).toBe(false);
    expect(imageData.statusLabel).toBe("图片处理中");
    expect(imageData.frameStyle).toEqual({ aspectRatio: "1080 / 608" });
  });

  it("keeps missing media references visible as status placeholders", () => {
    const imageData = resolveMarkdownImageData({
      src: "media:missing-public-id",
      alt: "missing sample",
      mediaAssetMap: new Map(),
    });

    expect(imageData.imageUrl).toBe("");
    expect(imageData.imageReady).toBe(false);
    expect(imageData.statusLabel).toBe("图片已不在当前草稿中");
    expect(imageData.parsedAlt.alt).toBe("missing sample");
  });

  it("excludes non-ready media from the markdown lightbox gallery", () => {
    const mediaAssetMap = new Map([
      [1, {
        id: 1,
        width: 1600,
        height: 900,
        mediumUrl: "/media/stale-processing.webp",
        processingStatus: "PROCESSING",
      }],
      [2, {
        id: 2,
        width: 1600,
        height: 900,
        mediumUrl: "/media/ready.webp",
        processingStatus: "READY",
      }],
    ]);

    expect(buildMarkdownImageGallery({
      content: "![a](media:1)\n![b](media:2)",
      mediaAssetMap,
    }).map((entry) => entry.imageUrl)).toEqual(["/media/ready.webp"]);
  });

  it("keeps repeated markdown images in gallery reading order", () => {
    const mediaAssetMap = new Map([
      [1, {
        id: 1,
        width: 1600,
        height: 900,
        mediumUrl: "/media/repeated.webp",
        originalUrl: "/media/repeated-original.webp",
        processingStatus: "READY",
      }],
      [2, {
        id: 2,
        width: 1600,
        height: 900,
        mediumUrl: "/media/other.webp",
        processingStatus: "READY",
      }],
    ]);

    const gallery = buildMarkdownImageGallery({
      content: "![a](media:1)\n![b](media:2)\n![c](media:1)",
      mediaAssetMap,
    });

    expect(gallery.map((entry) => entry.imageUrl)).toEqual([
      "/media/repeated.webp",
      "/media/other.webp",
      "/media/repeated.webp",
    ]);
    expect(gallery.map((entry) => ({
      sourceSrc: entry.sourceSrc,
      sourceOccurrenceIndex: entry.sourceOccurrenceIndex,
      markdownIndex: entry.markdownIndex,
    }))).toEqual([
      { sourceSrc: "media:1", sourceOccurrenceIndex: 0, markdownIndex: 0 },
      { sourceSrc: "media:2", sourceOccurrenceIndex: 0, markdownIndex: 1 },
      { sourceSrc: "media:1", sourceOccurrenceIndex: 1, markdownIndex: 2 },
    ]);
  });

  it("finds the clicked duplicate image gallery position", () => {
    const gallery = [
      { imageUrl: "/media/repeated.webp", sourceSrc: "media:1", sourceOccurrenceIndex: 0 },
      { imageUrl: "/media/other.webp", sourceSrc: "media:2", sourceOccurrenceIndex: 0 },
      { imageUrl: "/media/repeated.webp", sourceSrc: "media:1", sourceOccurrenceIndex: 1 },
    ];

    expect(findMarkdownImageGalleryStartIndex({
      gallery,
      src: "media:1",
      imageUrl: "/media/repeated.webp",
      sourceOccurrenceIndex: 1,
    })).toBe(2);

    expect(findMarkdownImageGalleryStartIndex({
      gallery,
      src: "media:missing",
      imageUrl: "/media/repeated.webp",
      sourceOccurrenceIndex: "bad",
    })).toBe(0);

    expect(findMarkdownImageGalleryStartIndex({
      gallery: [],
      src: "media:1",
      imageUrl: "/media/repeated.webp",
    })).toBe(-1);
  });

  it("labels markdown image readiness consistently", () => {
    expect(isMarkdownImageSourceReady({ processingStatus: "READY" })).toBe(true);
    expect(isMarkdownImageSourceReady({})).toBe(true);
    expect(isMarkdownImageSourceReady({ processingStatus: "FAILED" })).toBe(false);
    expect(markdownImageStatusLabel({ processingStatus: "FAILED" })).toBe("处理失败");
    expect(markdownImageStatusLabel({ processingStatus: "PROCESSING" })).toBe("图片处理中");
  });
});
