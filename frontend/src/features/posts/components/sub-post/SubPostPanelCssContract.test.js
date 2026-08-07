import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const subPostPanelCss = readFileSync(new URL("./SubPostPanel.css", import.meta.url), "utf8");

describe("SubPostPanel.css mobile recovery contract", () => {
  it("keeps target sub-post highlighting available outside the paper theme", () => {
    expect(subPostPanelCss).toMatch(
      /\.sub-post-root-thread\s*{[^}]*position:\s*relative;[^}]*border-bottom:/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-root-thread\.is-target-location::after\s*{[^}]*position:\s*absolute;[^}]*width:\s*3px;[^}]*pointer-events:\s*none;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-root-thread\.is-target-highlight\s*{[^}]*animation:\s*sub-post-target-highlight 2\.2s ease-out;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-root-thread\.is-target-highlight::before\s*{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;[^}]*z-index:\s*0;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-root-thread\.is-target-highlight > \.sub-post-item,[\s\S]*\.sub-post-root-thread\.is-target-highlight > \.sub-post-sub-list-wrap\s*{[^}]*position:\s*relative;[^}]*z-index:\s*1;/,
    );
  });

  it("keeps branch reply targets addressable without root-floor styling", () => {
    expect(subPostPanelCss).toMatch(
      /\.sub-post-branch-item\s*{[^}]*position:\s*relative;[^}]*border:\s*0;[^}]*background:\s*transparent;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-branch-item\.is-target-location::after\s*{[^}]*position:\s*absolute;[^}]*width:\s*3px;[^}]*pointer-events:\s*none;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-branch-item\.is-target-highlight\s*{[^}]*animation:\s*sub-post-target-highlight 2\.2s ease-out;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-branch-item\.is-target-highlight::before\s*{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;[^}]*z-index:\s*0;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-branch-item\.is-target-highlight > \*\s*{[^}]*position:\s*relative;[^}]*z-index:\s*1;/,
    );
  });

  it("keeps the paper theme target location marker independent from the animation overlay", () => {
    expect(subPostPanelCss).toMatch(
      /\.post-detail-paper \.sub-post-root-thread\.is-target-location::after\s*{[^}]*left:\s*-10px;[^}]*background:\s*var\(--detail-teal\);[^}]*box-shadow:/,
    );
    expect(subPostPanelCss).toMatch(
      /\.post-detail-paper \.sub-post-root-thread\.is-target-highlight::before\s*{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;[^}]*z-index:\s*0;/,
    );
  });

  it("keeps the paper theme branch target marker independent from the animation overlay", () => {
    expect(subPostPanelCss).toMatch(
      /\.post-detail-paper \.sub-post-branch-item\.is-target-location::after\s*{[^}]*left:\s*-10px;[^}]*background:\s*var\(--detail-teal\);[^}]*box-shadow:/,
    );
    expect(subPostPanelCss).toMatch(
      /\.post-detail-paper \.sub-post-branch-item\.is-target-highlight::before\s*{[^}]*inset:\s*3px -8px 3px -10px;[^}]*background:\s*rgba\(233, 251, 249, 0\.72\);[^}]*box-shadow:/,
    );
  });

  it("keeps mobile retry controls in full-width touch targets", () => {
    expect(subPostPanelCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.sub-post-empty-login,[\s\S]*\.post-detail-paper \.sub-post-target-copy,[\s\S]*\.post-detail-paper \.sub-post-load-more-retry\s*{[^}]*min-height:\s*40px;[^}]*width:\s*100%;/,
    );
  });

  it("keeps media upload retry controls visible and full-width on mobile", () => {
    expect(subPostPanelCss).toMatch(
      /\.sub-post-media-upload-retry\s*{[^}]*min-height:\s*30px;[^}]*border:[^}]*rgba\(143, 45, 40, 0\.3\);[^}]*cursor:\s*pointer;/,
    );
    expect(subPostPanelCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.sub-post-media-upload-retry\s*{[^}]*min-height:\s*38px;[^}]*width:\s*100%;/,
    );
  });

  it("keeps media status refresh controls visible and full-width on mobile", () => {
    expect(subPostPanelCss).toMatch(
      /\.sub-post-media-refresh\s*{[^}]*min-height:\s*30px;[^}]*border:[^}]*rgba\(20, 122, 125, 0\.3\);[^}]*cursor:\s*pointer;/,
    );
    expect(subPostPanelCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.sub-post-media-refresh\s*{[^}]*min-height:\s*38px;[^}]*width:\s*100%;/,
    );
  });

  it("keeps guest discussion login prompts readable and tappable on mobile", () => {
    expect(subPostPanelCss).toMatch(
      /\.sub-post-guest-discussion\s*{[^}]*width:\s*fit-content;[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(subPostPanelCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.sub-post-guest-discussion\s*{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;[^}]*width:\s*100%;/,
    );
    expect(subPostPanelCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.sub-post-guest-discussion-login,[\s\S]*\.post-detail-paper \.sub-post-load-more-retry\s*{[^}]*min-height:\s*40px;[^}]*width:\s*100%;/,
    );
  });

  it("wraps long sub-post recovery messages without forcing horizontal overflow", () => {
    expect(subPostPanelCss).toMatch(
      /\.post-detail-paper \.sub-post-load-more-failure span,[\s\S]*\.post-detail-paper \.sub-post-target-preview-text\s*{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-target-preview\s*{[^}]*display:\s*inline-flex;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-target-preview-text\s*{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
    );
  });

  it("keeps the located target preview full-width in stacked mobile target states", () => {
    expect(subPostPanelCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.sub-post-target-state,[\s\S]*\.post-detail-paper \.sub-post-guest-discussion\s*{[^}]*flex-direction:\s*column;[^}]*width:\s*100%;/,
    );
    expect(subPostPanelCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.sub-post-target-preview\s*{[^}]*width:\s*100%;/,
    );
  });

  it("keeps located floor headers from overflowing on narrow share landings", () => {
    expect(subPostPanelCss).toMatch(
      /\.sub-post-head-row\s*{[^}]*display:\s*flex;[^}]*gap:\s*8px;[^}]*min-width:\s*0;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-user\s*{[^}]*display:\s*flex;[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-author-name\s*{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-target-floor-badge\s*{[^}]*display:\s*inline-flex;[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-time-floor\s*{[^}]*white-space:\s*nowrap;[^}]*flex:\s*0 0 auto;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-post-branch-head\s*{[^}]*display:\s*flex;[^}]*flex-wrap:\s*nowrap;[^}]*min-width:\s*0;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-author\s*{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(subPostPanelCss).toMatch(
      /\.sub-time\s*{[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap;/,
    );
  });

  it("stacks load-more failure recovery on narrow screens", () => {
    expect(subPostPanelCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.sub-post-load-more-failure\s*{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;/,
    );
  });
});
