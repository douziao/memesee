import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeFeedSource = readFileSync(new URL("./HomeFeed.jsx", import.meta.url), "utf8");

describe("HomeFeed share action contract", () => {
  it("does not expose a share action in the home feed", () => {
    expect(homeFeedSource).not.toContain("sharePost");
    expect(homeFeedSource).not.toContain("isSharingPost");
  });
});
