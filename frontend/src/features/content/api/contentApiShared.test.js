import { describe, expect, it } from "vitest";
import {
  buildAuthHeaders,
  normalizeAssetUrl,
} from "./contentApiShared";

describe("content API shared helpers", () => {
  it("normalizes absolute and relative asset URLs", () => {
    expect(normalizeAssetUrl("", "")).toBe("");
    expect(normalizeAssetUrl("/api", "/media-assets/1/binary")).toBe("/api/media-assets/1/binary");
    expect(normalizeAssetUrl("https://example.com/api/", "media-assets/1/binary"))
      .toBe("https://example.com/api/media-assets/1/binary");
    expect(normalizeAssetUrl("/api", "https://cdn.example.com/image.webp"))
      .toBe("https://cdn.example.com/image.webp");
  });

  it("builds auth headers only when a token exists", () => {
    expect(buildAuthHeaders("token")).toEqual({ Authorization: "Bearer token" });
    expect(buildAuthHeaders("")).toBeUndefined();
  });
});
