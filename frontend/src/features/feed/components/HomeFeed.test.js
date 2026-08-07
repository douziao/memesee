import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeFeedSource = readFileSync(new URL("./HomeFeed.jsx", import.meta.url), "utf8");

describe("HomeFeed share action contract", () => {
  it("passes feed share actions through to the post list", () => {
    expect(homeFeedSource).toContain("sharePost,");
    expect(homeFeedSource).toContain("isSharingPost,");
    expect(homeFeedSource).toContain("sharePost={sharePost}");
    expect(homeFeedSource).toContain("isSharingPost={isSharingPost}");
  });
});
