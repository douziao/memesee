import { describe, expect, it } from "vitest";
import { shouldShowPostDetailMediaSection } from "./PostDetailArticle";

describe("shouldShowPostDetailMediaSection", () => {
  it("shows rich media sections for processing sources without image URLs", () => {
    expect(shouldShowPostDetailMediaSection({
      selectedPost: { postMode: "rich" },
      galleryProps: {
        richDetailImages: [],
        richImageSources: [
          { processingStatus: "PROCESSING", width: 1600, height: 900 },
        ],
      },
    })).toBe(true);
  });

  it("does not show media sections for long posts without rich media", () => {
    expect(shouldShowPostDetailMediaSection({
      selectedPost: { postMode: "long" },
      galleryProps: {
        richDetailImages: ["/media/image.webp"],
        richImageSources: [],
      },
    })).toBe(false);
  });
});
