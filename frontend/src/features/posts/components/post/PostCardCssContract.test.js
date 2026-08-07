import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const postCardCss = readFileSync(new URL("./PostCard.css", import.meta.url), "utf8");

describe("PostCard.css share action contract", () => {
  it("keeps feed card share actions above the open-card cover", () => {
    expect(postCardCss).toMatch(
      /\.post-open-cover\s*{[^}]*z-index:\s*10;/,
    );
    expect(postCardCss).toMatch(
      /\.post-card-share-btn\s*{[^}]*position:\s*relative;[^}]*z-index:\s*12;/,
    );
  });

  it("keeps the feed card footer shrinkable with a compact share button", () => {
    expect(postCardCss).toMatch(
      /\.post-foot-right\s*{[^}]*min-width:\s*0;[^}]*flex-wrap:\s*wrap;/,
    );
    expect(postCardCss).toMatch(
      /\.post-card-share-btn\s*{[^}]*min-height:\s*30px;[^}]*min-width:\s*66px;[^}]*white-space:\s*nowrap;/,
    );
  });

  it("keeps feed card share actions touch-friendly on mobile", () => {
    expect(postCardCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-card-share-btn\s*{[^}]*min-height:\s*32px;[^}]*min-width:\s*40px;/,
    );
  });
});
