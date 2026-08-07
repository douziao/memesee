import { describe, expect, it } from "vitest";
import { buildImageRetryUrl } from "./imageRetryUrl";

describe("buildImageRetryUrl", () => {
  it("keeps normal image URLs unchanged before a retry is requested", () => {
    expect(buildImageRetryUrl("/media/image.webp", 0)).toBe("/media/image.webp");
    expect(buildImageRetryUrl("/media/image.webp", "bad")).toBe("/media/image.webp");
    expect(buildImageRetryUrl("", 1)).toBe("");
  });

  it("adds a retry cache-bust parameter while preserving query strings and hashes", () => {
    expect(buildImageRetryUrl("/media/image.webp", 2)).toBe("/media/image.webp?__retry=2");
    expect(buildImageRetryUrl("/media/image.webp?size=large", 3))
      .toBe("/media/image.webp?size=large&__retry=3");
    expect(buildImageRetryUrl("/media/image.webp#preview", 4))
      .toBe("/media/image.webp?__retry=4#preview");
  });

  it("does not mutate inline or object URLs", () => {
    expect(buildImageRetryUrl("data:image/png;base64,abc", 1))
      .toBe("data:image/png;base64,abc");
    expect(buildImageRetryUrl("blob:https://example.test/image", 1))
      .toBe("blob:https://example.test/image");
  });
});
