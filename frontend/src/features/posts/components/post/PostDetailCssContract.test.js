import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const postDetailCss = readFileSync(new URL("./PostDetail.css", import.meta.url), "utf8");

describe("PostDetail.css mobile action bar contract", () => {
  it("keeps interaction mobile overrides after the interaction base rules", () => {
    const taxonomyBaseIndex = postDetailCss.indexOf(".detail-post-taxonomy {");
    const interactionBaseIndex = postDetailCss.indexOf(".detail-interact-wrap {", taxonomyBaseIndex);
    const interactionMobileIndex = postDetailCss.indexOf("@media (max-width: 768px)", interactionBaseIndex);

    expect(taxonomyBaseIndex).toBeGreaterThan(-1);
    expect(interactionBaseIndex).toBeGreaterThan(taxonomyBaseIndex);
    expect(interactionMobileIndex).toBeGreaterThan(interactionBaseIndex);
    expect(
      postDetailCss.slice(taxonomyBaseIndex, interactionBaseIndex),
    ).not.toMatch(/@media \(max-width:\s*768px\)[\s\S]*\.detail-interact-wrap/);
  });

  it("keeps the post action bar in stable touch slots on mobile", () => {
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-interact-bar-post\s*{[^}]*display:\s*grid;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-interact-bar-post\s*{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(40px,\s*1fr\)\);/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-interact-mainline\.is-more-open \.detail-interact-bar-post\s*{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(40px,\s*1fr\)\);/,
    );
  });

  it("keeps share busy labels from resizing the desktop action bar", () => {
    expect(postDetailCss).toMatch(
      /\.detail-interact-bar-post \.detail-interact-btn-large \.action-label\s*{[^}]*white-space:\s*nowrap;/,
    );
    expect(postDetailCss).toMatch(
      /\.detail-interact-bar-post \.detail-interact-btn-share\s*{[^}]*min-width:\s*78px;/,
    );
    expect(postDetailCss).toMatch(
      /\.detail-interact-btn-share\[aria-busy="true"\]\s*{[^}]*opacity:\s*1;[^}]*cursor:\s*progress;/,
    );
  });

  it("keeps target-location share state visible without widening mobile slots", () => {
    expect(postDetailCss).toMatch(
      /\.detail-interact-btn-share\.is-target-share\s*{[^}]*border-color:\s*rgba\(20,\s*122,\s*125,\s*0\.28\);[^}]*color:\s*#155f62;/,
    );
    expect(postDetailCss).toMatch(
      /\.post-detail-paper \.detail-interact-btn-share\.is-target-share\s*{[^}]*border-color:\s*rgba\(20,\s*122,\s*125,\s*0\.38\);[^}]*color:\s*var\(--detail-teal\);/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-interact-bar-post \.detail-interact-btn-share\s*{[^}]*min-width:\s*40px;/,
    );
  });

  it("keeps share busy state inside mobile touch slots in the paper detail theme", () => {
    expect(postDetailCss).toMatch(
      /\.post-detail-paper \.detail-interact-btn-share\[aria-busy="true"\]\s*{[^}]*border-color:\s*rgba\(20,\s*122,\s*125,\s*0\.34\);[^}]*color:\s*var\(--detail-teal\);/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-interact-bar-post \.detail-interact-btn-share\s*{[^}]*min-width:\s*40px;/,
    );
  });

  it("keeps mobile share context visible without widening the action slots", () => {
    expect(postDetailCss).toMatch(
      /\.detail-share-mobile-status\s*{[^}]*display:\s*none;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-share-mobile-status\s*{[^}]*display:\s*inline-flex;[^}]*max-width:\s*100%;[^}]*overflow:\s*hidden;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-share-mobile-status span:last-child\s*{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-share-mobile-status\s*{[^}]*order:\s*1;[^}]*color:\s*var\(--detail-teal\);/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-interact-bar-post\s*{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(40px,\s*1fr\)\);/,
    );
  });

  it("lets expanded more-menu actions occupy their own mobile touch slots", () => {
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-post-more-wrap\.is-open,[\s\S]*\.post-detail-paper \.detail-post-more-wrap\.is-open \.detail-post-more-menu\s*{[^}]*display:\s*contents;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-interact-bar-post \.detail-interact-btn-large\s*{[^}]*width:\s*100%;[^}]*min-height:\s*40px;/,
    );
  });
});

describe("PostDetail.css taxonomy mobile contract", () => {
  it("keeps taxonomy base sizing separate from themed color and weight overrides", () => {
    expect(postDetailCss).toMatch(
      /\.detail-post-taxonomy\s*{[^}]*gap:\s*8px;/,
    );
    expect(postDetailCss).toMatch(
      /\.detail-community-tag-text,[\s\S]*\.detail-tag-chip-text\s*{[^}]*line-height:\s*1\.2;/,
    );
    expect(postDetailCss).toMatch(
      /\.post-detail-paper \.detail-post-taxonomy\s*{[^}]*margin-top:\s*1px;[^}]*}/,
    );
    expect(postDetailCss).not.toMatch(
      /\.post-detail-paper \.detail-post-taxonomy\s*{[^}]*gap:\s*8px;/,
    );
    expect(postDetailCss).not.toMatch(
      /\.post-detail-paper \.detail-community-tag-text,[\s\S]*\.post-detail-paper \.detail-tag-chip-text\s*{[^}]*line-height:\s*1\.2;/,
    );
  });

  it("only keeps taxonomy mobile overrides that differ from the base layout", () => {
    expect(postDetailCss).not.toMatch(
      /\.detail-post-taxonomy\s*{\s*gap:\s*8px;\s*}/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-tag-list\s*{[^}]*gap:\s*6px;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-community-tag-text,[\s\S]*\.detail-tag-chip-text\s*{[^}]*font-size:\s*0\.86rem;/,
    );
  });

  it("keeps taxonomy shrinkable with long community and tag text", () => {
    expect(postDetailCss).toMatch(
      /\.detail-post-taxonomy\s*{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/,
    );
    expect(postDetailCss).toMatch(
      /\.detail-tag-list\s*{[^}]*flex-wrap:\s*wrap;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/,
    );
    expect(postDetailCss).toMatch(
      /\.detail-community-tag-text,[\s\S]*\.detail-tag-chip-text\s*{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/,
    );
    expect(postDetailCss).toMatch(
      /\.detail-community-tag-text,[\s\S]*\.detail-tag-chip-text\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
  });

  it("lets paper detail taxonomy occupy the mobile content width", () => {
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-post-taxonomy\s*{[^}]*align-items:\s*flex-start;[^}]*width:\s*100%;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.detail-tag-list\s*{[^}]*max-width:\s*100%;/,
    );
  });
});

describe("PostDetail.css interaction mobile contract", () => {
  it("keeps the non-themed interaction bar mobile adjustments grouped together", () => {
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-interact-wrap\s*{[^}]*align-items:\s*stretch;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-interact-bar-post\s*{[^}]*gap:\s*8px;[^}]*flex-wrap:\s*wrap;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-interact-btn-large\s*{[^}]*min-height:\s*38px;[^}]*padding:\s*7px 11px;/,
    );
  });

  it("stacks guest engagement recovery copy and login action on mobile", () => {
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-guest-engagement\s*{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.detail-guest-engagement-login\s*{[^}]*min-height:\s*40px;[^}]*width:\s*100%;/,
    );
  });
});

describe("PostDetail.css markdown readability contract", () => {
  it("wraps long inline markdown content without disabling block scrolling", () => {
    expect(postDetailCss).toMatch(
      /\.markdown-content a\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(postDetailCss).toMatch(
      /\.markdown-content code\s*{[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(postDetailCss).toMatch(
      /\.markdown-content pre code\s*{[^}]*min-width:\s*max-content;[^}]*overflow-wrap:\s*normal;/,
    );
  });

  it("keeps wide markdown blocks horizontally scrollable on touch screens", () => {
    expect(postDetailCss).toMatch(
      /\.markdown-content pre\s*{[^}]*overflow:\s*auto;[^}]*-webkit-overflow-scrolling:\s*touch;/,
    );
    expect(postDetailCss).toMatch(
      /\.markdown-content \.markdown-table-scroll\s*{[^}]*overflow-x:\s*auto;[^}]*-webkit-overflow-scrolling:\s*touch;/,
    );
    expect(postDetailCss).toMatch(
      /\.markdown-content \.markdown-table-scroll:focus-visible\s*{[^}]*outline:\s*2px solid/,
    );
    expect(postDetailCss).toMatch(
      /\.markdown-content table\s*{[^}]*width:\s*max-content;[^}]*min-width:\s*100%;/,
    );
  });

  it("keeps full-width markdown image sizing in the shared markdown layer", () => {
    expect(postDetailCss).toMatch(
      /\.markdown-content \.markdown-image-frame\.is-full-width \.markdown-inline-image\s*{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*max-height:\s*none;/,
    );
    expect(postDetailCss).not.toMatch(
      /\.post-detail-paper \.markdown-content \.markdown-image-frame\.is-full-width/,
    );
  });
});

describe("PostDetail.css rich gallery mobile contract", () => {
  it("keeps gallery controls in stable full-width touch slots on mobile", () => {
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.post-rich-gallery-controls\s*{[^}]*grid-template-columns:\s*40px minmax\(0,\s*1fr\) 40px;[^}]*width:\s*100%;[^}]*min-height:\s*48px;/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.post-rich-gallery-nav\s*{[^}]*width:\s*40px;[^}]*height:\s*40px;[^}]*min-width:\s*40px;/,
    );
  });

  it("lets narrow gallery index content shrink and wrap without horizontal overflow", () => {
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.post-rich-gallery-index\s*{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\);/,
    );
    expect(postDetailCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.post-detail-paper \.post-rich-gallery-count\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
  });

  it("keeps gallery image failure recovery readable and touch-friendly", () => {
    expect(postDetailCss).toMatch(
      /\.post-detail-paper \.post-rich-gallery-image-fallback\s*{[^}]*flex-direction:\s*column;[^}]*gap:\s*10px;/,
    );
    expect(postDetailCss).toMatch(
      /\.post-detail-paper \.post-rich-gallery-image-failure-label,[\s\S]*\.post-detail-paper \.post-rich-gallery-image-failure-hint\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(postDetailCss).toMatch(
      /\.post-detail-paper \.post-rich-gallery-image-retry\s*{[^}]*min-height:\s*40px;[^}]*min-width:\s*96px;/,
    );
  });
});
