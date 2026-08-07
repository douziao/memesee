import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveMarkdownMediaViewerStartIndex } from "./MarkdownMediaImage";

const markdownMediaImageSource = readFileSync(new URL("./MarkdownMediaImage.jsx", import.meta.url), "utf8");

describe("resolveMarkdownMediaViewerStartIndex", () => {
  it("uses an explicit viewer start index for repeated image URLs", () => {
    expect(resolveMarkdownMediaViewerStartIndex({
      imageUrl: "/media/repeated.webp",
      viewerImages: [
        "/media/repeated.webp",
        "/media/other.webp",
        "/media/repeated.webp",
      ],
      viewerStartIndex: 2,
    })).toBe(2);
  });

  it("falls back to the first matching image URL when the explicit index is invalid", () => {
    expect(resolveMarkdownMediaViewerStartIndex({
      imageUrl: "/media/repeated.webp",
      viewerImages: [
        "/media/repeated.webp",
        "/media/other.webp",
        "/media/repeated.webp",
      ],
      viewerStartIndex: 99,
    })).toBe(0);
  });

  it("falls back with comparable URLs when cache-busting params differ", () => {
    expect(resolveMarkdownMediaViewerStartIndex({
      imageUrl: "/media/repeated.webp?v=2#current",
      viewerImages: [
        "/media/other.webp",
        "/media/repeated.webp?v=1#old",
      ],
      viewerStartIndex: 99,
    })).toBe(1);
  });

  it("returns zero when the image is not present in the viewer payload", () => {
    expect(resolveMarkdownMediaViewerStartIndex({
      imageUrl: "/media/missing.webp",
      viewerImages: ["/media/a.webp"],
    })).toBe(0);
  });
});

describe("MarkdownMediaImage recovery accessibility contract", () => {
  it("announces image failures and links retry controls to the failure label", () => {
    expect(markdownMediaImageSource).toContain("const recoveryDescriptionId = `${useId()}-markdown-image-recovery`;");
    expect(markdownMediaImageSource).toMatch(
      /<span className="markdown-image-fallback" role="alert" aria-live="assertive">/,
    );
    expect(markdownMediaImageSource).toMatch(
      /<span id=\{recoveryDescriptionId\} className="markdown-image-failure-label">/,
    );
    expect(markdownMediaImageSource).toMatch(
      /aria-describedby=\{recoveryDescriptionId\}/,
    );
  });
});
