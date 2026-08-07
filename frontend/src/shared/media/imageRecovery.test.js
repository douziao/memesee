import { describe, expect, it } from "vitest";
import {
  IMAGE_LOAD_FAILED_LABEL,
  IMAGE_RETRY_LABEL,
  buildImageFailureRecoveryState,
  buildRetryableImageSourceState,
  incrementImageRetryTokenMap,
  updateImageFlagMap,
} from "./imageRecovery";

describe("buildImageFailureRecoveryState", () => {
  it("keeps recovery UI hidden while the image is still usable", () => {
    expect(buildImageFailureRecoveryState({
      imageUrl: "/media/display.webp",
      imageFailed: false,
    })).toEqual({
      show: false,
      message: "",
      hint: "",
      retryLabel: IMAGE_RETRY_LABEL,
    });
    expect(buildImageFailureRecoveryState({
      imageUrl: "",
      imageFailed: true,
    }).show).toBe(false);
  });

  it("explains a single-image failure without implying navigation is available", () => {
    expect(buildImageFailureRecoveryState({
      imageUrl: "/media/display.webp",
      imageFailed: true,
    })).toEqual({
      show: true,
      message: IMAGE_LOAD_FAILED_LABEL,
      hint: "可以重新加载当前图片。",
      retryLabel: IMAGE_RETRY_LABEL,
    });
  });

  it("mentions adjacent-image recovery when alternatives exist", () => {
    expect(buildImageFailureRecoveryState({
      imageUrl: "/media/display.webp",
      imageFailed: true,
      hasAlternativeImages: true,
    })).toEqual({
      show: true,
      message: IMAGE_LOAD_FAILED_LABEL,
      hint: "可以重新加载当前图片，或切换其它图片。",
      retryLabel: IMAGE_RETRY_LABEL,
    });
  });
});

describe("buildRetryableImageSourceState", () => {
  it("keeps the original image source before retry", () => {
    const imageSource = {
      src: "/media/display.webp",
      srcSet: "/media/display-640.webp 640w",
    };

    expect(buildRetryableImageSourceState({
      imageUrl: "/media/display.webp",
      imageSource,
      retryToken: 0,
    })).toEqual({
      retryImageUrl: "/media/display.webp",
      retryImageSource: imageSource,
    });
  });

  it("cache-busts retries and bypasses stale srcSet candidates", () => {
    expect(buildRetryableImageSourceState({
      imageUrl: "/media/display.webp?size=large#view",
      imageSource: {
        src: "/media/display.webp",
        srcSet: "/media/display-640.webp 640w",
        sizes: "100vw",
      },
      retryToken: 2,
    })).toEqual({
      retryImageUrl: "/media/display.webp?size=large&__retry=2#view",
      retryImageSource: {
        src: "/media/display.webp",
        srcSet: "",
        sizes: "100vw",
      },
    });
  });
});

describe("updateImageFlagMap", () => {
  it("sets image flags without changing the map when the value is already stable", () => {
    const failedMap = {
      "/media/display.webp": true,
    };

    expect(updateImageFlagMap(failedMap, "/media/display.webp", true)).toBe(failedMap);
    expect(updateImageFlagMap(failedMap, "", false)).toBe(failedMap);
    expect(updateImageFlagMap(failedMap, "/media/display.webp", false)).toEqual({
      "/media/display.webp": false,
    });
    expect(updateImageFlagMap(failedMap, "/media/other.webp", true)).toEqual({
      "/media/display.webp": true,
      "/media/other.webp": true,
    });
  });

  it("tolerates malformed maps while preserving no-op semantics", () => {
    expect(updateImageFlagMap(null, "", true)).toEqual({});
    expect(updateImageFlagMap(null, "/media/display.webp", true)).toEqual({
      "/media/display.webp": true,
    });
  });
});

describe("incrementImageRetryTokenMap", () => {
  it("increments retry tokens by image URL", () => {
    expect(incrementImageRetryTokenMap({
      "/media/display.webp": 2,
    }, "/media/display.webp")).toEqual({
      "/media/display.webp": 3,
    });
    expect(incrementImageRetryTokenMap({}, "/media/display.webp")).toEqual({
      "/media/display.webp": 1,
    });
  });

  it("normalizes malformed retry token maps and ignores missing image URLs", () => {
    const retryTokenMap = {
      "/media/display.webp": "bad",
    };

    expect(incrementImageRetryTokenMap(retryTokenMap, "/media/display.webp")).toEqual({
      "/media/display.webp": 1,
    });
    expect(incrementImageRetryTokenMap(retryTokenMap, "")).toBe(retryTokenMap);
    expect(incrementImageRetryTokenMap(null, "")).toEqual({});
  });
});
