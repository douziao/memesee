import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageBuildersSource = readFileSync(
  new URL("./appLayoutPageBuilders.js", import.meta.url),
  "utf8",
);

describe("buildFeedProps share action contract", () => {
  it("does not pass the share action into home feed props", () => {
    expect(pageBuildersSource).not.toContain("sharePost: actions.sharePost");
    expect(pageBuildersSource).not.toContain("isSharingPost: actions.isSharingPost");
  });
});
