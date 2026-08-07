import { describe, expect, it } from "vitest";
import {
  buildPostMediaImageSources,
  buildPostPreviewImageSources,
} from "./mediaAssetHelpers";
import {
  buildResponsiveImageSource,
  buildResponsiveImageSources,
  FEED_IMAGE_SIZES,
} from "./responsiveImages";

describe("responsive image sources", () => {
  it("keeps feed preview sizes aligned with the three-column media grid", () => {
    expect(FEED_IMAGE_SIZES).toBe("(max-width: 720px) calc((100vw - 56px) / 3), 240px");
  });

  it("uses lightweight feed variants before larger display images", () => {
    const source = buildResponsiveImageSource({
      width: 1600,
      height: 900,
      thumbUrl: "/media/a-thumb.webp",
      smallUrl: "/media/a-small.webp",
      displayUrl: "/media/a-display.webp",
    }, {
      prefer: "feed",
      sizes: FEED_IMAGE_SIZES,
    });

    expect(source.src).toBe("/media/a-thumb.webp");
    expect(source.srcSet).toBe("/media/a-thumb.webp 480w, /media/a-small.webp 720w");
    expect(source.sizes).toBe(FEED_IMAGE_SIZES);
    expect(source.width).toBe(480);
    expect(source.height).toBe(270);
  });

  it("filters no-url ready assets by default", () => {
    const sources = buildResponsiveImageSources([
      { id: 1, processingStatus: "READY" },
      { id: 2, displayUrl: "/media/ready.webp", processingStatus: "READY" },
    ]);

    expect(sources).toHaveLength(1);
    expect(sources[0].displayUrl).toBe("/media/ready.webp");
  });

  it("can preserve no-url non-ready assets for detail placeholders", () => {
    const sources = buildResponsiveImageSources([
      { id: 1, width: 1200, height: 800, processingStatus: "PROCESSING" },
      { id: 2, processingStatus: "FAILED" },
      { id: 3, processingStatus: "READY" },
    ], {
      keepNonReadySources: true,
    });

    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.processingStatus)).toEqual(["PROCESSING", "FAILED"]);
    expect(sources[0].src).toBe("");
    expect(sources[0].displayUrl).toBe("");
    expect(sources[0].aspectRatio).toBe(1.5);
  });

  it("preserves processing detail media while keeping feed previews image-only", () => {
    const mediaAssets = [
      { id: 1, width: 1200, height: 800, processingStatus: "PROCESSING" },
      { id: 2, displayUrl: "/media/ready.webp", processingStatus: "READY" },
    ];

    const detailSources = buildPostMediaImageSources(mediaAssets);
    const previewSources = buildPostPreviewImageSources(mediaAssets);

    expect(detailSources).toHaveLength(2);
    expect(detailSources[0].processingStatus).toBe("PROCESSING");
    expect(previewSources).toHaveLength(1);
    expect(previewSources[0].displayUrl).toBe("/media/ready.webp");
  });

  it("treats missing preview media as an empty list", () => {
    expect(buildPostPreviewImageSources(null)).toEqual([]);
  });
});
