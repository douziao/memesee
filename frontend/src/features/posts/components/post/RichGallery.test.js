import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildRichGalleryAdjacentPrefetchCandidates,
  buildRichGalleryImageFailureState,
  buildRichGalleryImageSources,
  buildRichGalleryViewerPayload,
  clampRichGalleryIndex,
  canOpenRichGalleryViewer,
  calculateRichGalleryRenderSize,
  isRichGalleryImageReady,
} from "./RichGallery";

const richGallerySource = readFileSync(new URL("./RichGallery.jsx", import.meta.url), "utf8");

describe("calculateRichGalleryRenderSize", () => {
  it("fits normal images inside the gallery frame", () => {
    expect(calculateRichGalleryRenderSize({
      naturalSize: { width: 1600, height: 900 },
      frameSize: { width: 800, height: 450 },
    })).toEqual({
      width: 800,
      height: 450,
      imageWidth: 800,
      imageHeight: 450,
      hasPaddedHitArea: false,
    });
  });

  it("keeps ultra-wide images easy to click without cropping them", () => {
    expect(calculateRichGalleryRenderSize({
      naturalSize: { width: 4000, height: 320 },
      frameSize: { width: 800, height: 450 },
      minHitSide: 96,
    })).toEqual({
      width: 800,
      height: 96,
      imageWidth: 800,
      imageHeight: 64,
      hasPaddedHitArea: true,
    });
  });

  it("keeps ultra-tall images easy to click without cropping them", () => {
    expect(calculateRichGalleryRenderSize({
      naturalSize: { width: 320, height: 4000 },
      frameSize: { width: 800, height: 450 },
      minHitSide: 96,
    })).toEqual({
      width: 96,
      height: 450,
      imageWidth: 36,
      imageHeight: 450,
      hasPaddedHitArea: true,
    });
  });

  it("returns null until valid image and frame dimensions are available", () => {
    expect(calculateRichGalleryRenderSize({
      naturalSize: { width: 0, height: 900 },
      frameSize: { width: 800, height: 450 },
    })).toBeNull();
    expect(calculateRichGalleryRenderSize({
      naturalSize: { width: 1600, height: 900 },
      frameSize: { width: 0, height: 450 },
    })).toBeNull();
  });
});

describe("buildRichGalleryViewerPayload", () => {
  it("keeps lightbox indexes aligned when media sources include placeholders", () => {
    expect(buildRichGalleryViewerPayload({
      imageSources: [
        { processingStatus: "PROCESSING" },
        { src: "/media/ready-a.webp", originalUrl: "/media/original-a.webp" },
        { processingStatus: "FAILED" },
        { displayUrl: "/media/ready-b.webp" },
      ],
      richOriginalImages: ["", "", "", "/media/original-b.webp"],
      currentIndex: 3,
    })).toEqual({
      images: ["/media/ready-a.webp", "/media/ready-b.webp"],
      imageSources: [
        { src: "/media/ready-a.webp", originalUrl: "/media/original-a.webp" },
        { displayUrl: "/media/ready-b.webp" },
      ],
      originalImages: ["/media/original-a.webp", "/media/original-b.webp"],
      startIndex: 1,
      originalUrl: "/media/original-b.webp",
    });
  });

  it("returns an empty viewer payload for non-viewable media placeholders", () => {
    expect(buildRichGalleryViewerPayload({
      imageSources: [
        { processingStatus: "PROCESSING" },
        { processingStatus: "FAILED" },
      ],
      currentIndex: 0,
    })).toEqual({
      images: [],
      imageSources: [],
      originalImages: [],
      startIndex: -1,
      originalUrl: "",
    });
  });

  it("excludes non-ready media even when stale URLs are present", () => {
    expect(buildRichGalleryViewerPayload({
      imageSources: [
        { processingStatus: "PROCESSING", displayUrl: "/media/stale-processing.webp" },
        { processingStatus: "FAILED", src: "/media/stale-failed.webp" },
        { processingStatus: "READY", displayUrl: "/media/ready.webp" },
      ],
      currentIndex: 0,
    })).toEqual({
      images: ["/media/ready.webp"],
      imageSources: [
        { processingStatus: "READY", displayUrl: "/media/ready.webp" },
      ],
      originalImages: [""],
      startIndex: -1,
      originalUrl: "",
    });
  });

  it("preserves the clicked duplicate image when comparable gallery URLs repeat", () => {
    expect(buildRichGalleryViewerPayload({
      imageSources: [
        {
          src: "/media/repeated.webp?v=1",
          originalUrl: "/media/repeated-old.webp",
        },
        {
          src: "/media/other.webp",
          originalUrl: "/media/other-original.webp",
        },
        {
          src: "/media/repeated.webp?v=2#current",
          originalUrl: "/media/repeated-current.webp",
        },
      ],
      currentIndex: 2,
    })).toEqual({
      images: ["/media/repeated.webp?v=2#current", "/media/other.webp"],
      imageSources: [
        {
          src: "/media/repeated.webp?v=2#current",
          originalUrl: "/media/repeated-current.webp",
        },
        {
          src: "/media/other.webp",
          originalUrl: "/media/other-original.webp",
        },
      ],
      originalImages: ["/media/repeated-current.webp", "/media/other-original.webp"],
      startIndex: 0,
      originalUrl: "/media/repeated-current.webp",
    });
  });
});

describe("buildRichGalleryImageSources", () => {
  it("normalizes legacy image arrays and skips empty detail images", () => {
    expect(buildRichGalleryImageSources({
      richDetailImages: [" /media/a.webp ", "", null, "/media/b.webp"],
      richOriginalImages: [" /media/original-a.webp ", "", "", ""],
    })).toEqual([
      {
        src: "/media/a.webp",
        displayUrl: "/media/a.webp",
        originalUrl: "/media/original-a.webp",
        loadingPriority: "eager",
        fetchPriority: "high",
      },
      {
        src: "/media/b.webp",
        displayUrl: "/media/b.webp",
        originalUrl: "/media/b.webp",
        loadingPriority: "lazy",
        fetchPriority: "low",
      },
    ]);
  });

  it("drops malformed ready sources while preserving media status placeholders", () => {
    expect(buildRichGalleryImageSources({
      richImageSources: [
        null,
        " ",
        [],
        { src: "   ", displayUrl: "" },
        { processingStatus: "PROCESSING", displayUrl: " /media/stale.webp " },
        { processingStatus: "FAILED" },
        { src: " /media/ready.webp ", originalUrl: " /media/original.webp " },
      ],
    })).toEqual([
      {
        processingStatus: "PROCESSING",
        displayUrl: "/media/stale.webp",
        loadingPriority: "eager",
        fetchPriority: "high",
      },
      {
        processingStatus: "FAILED",
        loadingPriority: "lazy",
        fetchPriority: "low",
      },
      {
        src: "/media/ready.webp",
        originalUrl: "/media/original.webp",
        loadingPriority: "lazy",
        fetchPriority: "low",
      },
    ]);
  });

  it("keeps original-image fallbacks aligned after malformed structured entries are removed", () => {
    expect(buildRichGalleryImageSources({
      richImageSources: [
        { src: "" },
        { displayUrl: " /media/ready.webp " },
      ],
      richOriginalImages: [
        "/media/ignored.webp",
        " /media/original-ready.webp ",
      ],
    })).toEqual([
      {
        displayUrl: "/media/ready.webp",
        originalUrl: "/media/original-ready.webp",
        loadingPriority: "eager",
        fetchPriority: "high",
      },
    ]);
  });
});

describe("isRichGalleryImageReady", () => {
  it("only treats ready media as viewable", () => {
    expect(isRichGalleryImageReady({ processingStatus: "READY" })).toBe(true);
    expect(isRichGalleryImageReady({})).toBe(true);
    expect(isRichGalleryImageReady({ processingStatus: "PROCESSING", displayUrl: "/media/a.webp" }))
      .toBe(false);
    expect(isRichGalleryImageReady({ processingStatus: "FAILED", src: "/media/b.webp" }))
      .toBe(false);
  });
});

describe("canOpenRichGalleryViewer", () => {
  it("only allows opening a loaded image that is present in the viewer payload", () => {
    expect(canOpenRichGalleryViewer({
      currentImage: "/media/ready.webp",
      imageFailed: false,
      viewerPayload: { startIndex: 0 },
    })).toBe(true);

    expect(canOpenRichGalleryViewer({
      currentImage: "",
      imageFailed: false,
      viewerPayload: { startIndex: -1 },
    })).toBe(false);

    expect(canOpenRichGalleryViewer({
      currentImage: "/media/broken.webp",
      imageFailed: true,
      viewerPayload: { startIndex: 0 },
    })).toBe(false);

    expect(canOpenRichGalleryViewer({
      currentImage: "/media/not-in-viewer.webp",
      imageFailed: false,
      viewerPayload: { startIndex: -1 },
    })).toBe(false);
  });
});

describe("buildRichGalleryImageFailureState", () => {
  it("keeps recovery hidden while the current gallery image is usable", () => {
    expect(buildRichGalleryImageFailureState({
      currentImage: "/media/ready.webp",
      imageFailed: false,
    })).toEqual({
      show: false,
      message: "",
      hint: "",
      retryLabel: "重新加载",
    });
  });

  it("offers retry-only recovery for a single failed gallery image", () => {
    expect(buildRichGalleryImageFailureState({
      currentImage: "/media/broken.webp",
      imageFailed: true,
      hasMultipleImages: false,
    })).toEqual({
      show: true,
      message: "图片加载失败",
      hint: "可以重新加载当前图片。",
      retryLabel: "重新加载",
    });
  });

  it("mentions image switching when adjacent gallery images are available", () => {
    expect(buildRichGalleryImageFailureState({
      currentImage: "/media/broken.webp",
      imageFailed: true,
      hasMultipleImages: true,
    })).toEqual({
      show: true,
      message: "图片加载失败",
      hint: "可以重新加载当前图片，或切换其它图片。",
      retryLabel: "重新加载",
    });
  });
});

describe("RichGallery image recovery accessibility contract", () => {
  it("keeps retry recovery outside the image button and linked to failure copy", () => {
    expect(richGallerySource).toContain("const recoveryDescriptionId = `${useId()}-rich-gallery-image-recovery`;");
    expect(richGallerySource).toMatch(
      /<span className="post-rich-gallery-image-fallback" role="alert" aria-live="assertive">/,
    );
    expect(richGallerySource).toMatch(
      /<span id=\{recoveryDescriptionId\} className="post-rich-gallery-image-failure-label">/,
    );
    expect(richGallerySource).toMatch(
      /aria-describedby=\{recoveryDescriptionId\}/,
    );
    expect(richGallerySource).not.toMatch(
      /<button[\s\S]*className=\{[\s\S]*post-rich-gallery-image-shell[\s\S]*post-rich-gallery-image-retry[\s\S]*<\/button>\s*<\/button>/,
    );
  });
});

describe("clampRichGalleryIndex", () => {
  it("keeps the current gallery index inside the available media range", () => {
    expect(clampRichGalleryIndex(0, 3)).toBe(0);
    expect(clampRichGalleryIndex(2, 3)).toBe(2);
    expect(clampRichGalleryIndex(8, 3)).toBe(2);
    expect(clampRichGalleryIndex(-4, 3)).toBe(0);
    expect(clampRichGalleryIndex(1.8, 3)).toBe(1);
    expect(clampRichGalleryIndex("bad", 3)).toBe(0);
    expect(clampRichGalleryIndex(4, 0)).toBe(0);
  });
});

describe("buildRichGalleryAdjacentPrefetchCandidates", () => {
  it("returns the previous and next image around the current index", () => {
    expect(buildRichGalleryAdjacentPrefetchCandidates({
      displayImages: ["/media/a.webp", "/media/b.webp", "/media/c.webp"],
      currentIndex: 1,
      currentImage: "/media/b.webp",
    })).toEqual(["/media/a.webp", "/media/c.webp"]);
  });

  it("filters empty, duplicate, current, loaded, and failed image URLs", () => {
    expect(buildRichGalleryAdjacentPrefetchCandidates({
      displayImages: [
        "/media/current.webp",
        " /media/current.webp ",
        "/media/loaded.webp",
      ],
      currentIndex: 1,
      currentImage: "/media/current.webp",
      loadedImageMap: {
        "/media/loaded.webp": true,
      },
    })).toEqual([]);

    expect(buildRichGalleryAdjacentPrefetchCandidates({
      displayImages: [
        "/media/repeated.webp",
        "/media/current.webp",
        " /media/repeated.webp ",
      ],
      currentIndex: 1,
      currentImage: "/media/current.webp",
    })).toEqual(["/media/repeated.webp"]);

    expect(buildRichGalleryAdjacentPrefetchCandidates({
      displayImages: [
        "",
        "/media/current.webp",
        "/media/failed.webp",
      ],
      currentIndex: 1,
      currentImage: "/media/current.webp",
      failedImageMap: {
        "/media/failed.webp": true,
      },
    })).toEqual([]);
  });

  it("handles malformed input and out-of-range indexes", () => {
    expect(buildRichGalleryAdjacentPrefetchCandidates()).toEqual([]);
    expect(buildRichGalleryAdjacentPrefetchCandidates({
      displayImages: "bad",
      currentIndex: 1,
    })).toEqual([]);
    expect(buildRichGalleryAdjacentPrefetchCandidates({
      displayImages: ["/media/a.webp", "/media/b.webp"],
      currentIndex: 99,
      currentImage: "/media/b.webp",
    })).toEqual(["/media/a.webp"]);
  });
});
