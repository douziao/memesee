import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageBuildersSource = readFileSync(
  new URL("./appLayoutPageBuilders.js", import.meta.url),
  "utf8",
);

describe("buildFeedProps share action contract", () => {
  it("passes main-post share actions into the home feed props", () => {
    expect(pageBuildersSource).toContain("sharePost: actions.sharePost");
    expect(pageBuildersSource).toContain("isSharingPost: actions.isSharingPost");
  });
});
