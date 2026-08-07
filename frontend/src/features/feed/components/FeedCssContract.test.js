import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const feedCss = readFileSync(new URL("./Feed.css", import.meta.url), "utf8");

describe("Feed.css status-card recovery controls", () => {
  it("keeps retry buttons visually disabled inside status cards", () => {
    expect(feedCss).toContain(".feed-status-card .neo-btn:disabled");
    expect(feedCss).toMatch(/\.feed-status-card \.neo-btn:disabled\s*{[^}]*cursor:\s*not-allowed;/s);
    expect(feedCss).toMatch(/\.feed-status-card \.neo-btn:disabled\s*{[^}]*opacity:/s);
  });

  it("stacks status-card actions on narrow screens", () => {
    expect(feedCss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*\.feed-status-card \.btn-group\s*{[^}]*flex-direction:\s*column;/);
    expect(feedCss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*\.feed-status-card \.neo-btn\s*{[^}]*width:\s*100%;/);
    expect(feedCss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*\.feed-status-card \.neo-btn\s*{[^}]*min-height:\s*42px;/);
  });
});
