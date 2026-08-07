import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const composerCss = readFileSync(new URL("./Composer.css", import.meta.url), "utf8");

describe("Composer.css mobile status contract", () => {
  it("keeps mobile status overrides after the base status rules", () => {
    const submitBaseIndex = composerCss.indexOf(".composer-submit-status {");
    const previewBaseIndex = composerCss.indexOf(".composer-preview-status {");
    const uploadBaseIndex = composerCss.indexOf(".composer-upload-status {");
    const mobileStatusIndex = composerCss.indexOf("@media (max-width: 768px)", uploadBaseIndex);

    expect(submitBaseIndex).toBeGreaterThan(-1);
    expect(previewBaseIndex).toBeGreaterThan(-1);
    expect(uploadBaseIndex).toBeGreaterThan(-1);
    expect(mobileStatusIndex).toBeGreaterThan(submitBaseIndex);
    expect(mobileStatusIndex).toBeGreaterThan(previewBaseIndex);
    expect(mobileStatusIndex).toBeGreaterThan(uploadBaseIndex);
  });

  it("stacks upload, submit, and preview statuses on narrow screens", () => {
    expect(composerCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.composer-upload-status,[\s\S]*\.composer-submit-status,[\s\S]*\.composer-preview-status\s*{[^}]*align-items:\s*flex-start;[^}]*flex-direction:\s*column;/,
    );
  });

  it("keeps status text shrinkable and wraps long recovery copy", () => {
    expect(composerCss).toMatch(
      /\.composer-upload-status\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(composerCss).toMatch(
      /\.composer-submit-status\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(composerCss).toMatch(
      /\.composer-preview-status\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(composerCss).toMatch(/\.composer-upload-status > span\s*{[^}]*min-width:\s*0;/);
    expect(composerCss).toMatch(/\.composer-submit-status > span\s*{[^}]*min-width:\s*0;/);
    expect(composerCss).toMatch(/\.composer-preview-status > span\s*{[^}]*min-width:\s*0;/);
  });

  it("keeps mobile recovery actions in full-width touch targets", () => {
    expect(composerCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.composer-preview-status-actions\s*{[^}]*flex-wrap:\s*wrap;[^}]*width:\s*100%;/,
    );
    expect(composerCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.composer-preview-status-btn,[\s\S]*\.composer-submit-retry-btn,[\s\S]*\.composer-upload-retry-btn\s*{[^}]*justify-content:\s*center;[^}]*min-height:\s*40px;[^}]*width:\s*100%;/,
    );
  });

  it("keeps the submit disabled reason compact and mobile-safe", () => {
    expect(composerCss).toMatch(
      /\.compose-tools-submit-wrap\s*{[^}]*justify-content:\s*flex-end;[^}]*flex-wrap:\s*wrap;/,
    );
    expect(composerCss).toMatch(
      /\.composer-submit-disabled-reason\s*{[^}]*flex:\s*1 0 100%;[^}]*min-width:\s*0;[^}]*max-width:\s*360px;[^}]*overflow-wrap:\s*anywhere;[^}]*text-align:\s*right;/,
    );
    expect(composerCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.composer-submit-disabled-reason\s*{[^}]*max-width:\s*100%;[^}]*text-align:\s*center;/,
    );
    expect(composerCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.composer-paper \.composer-submit-disabled-reason\s*{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*text-align:\s*center;/,
    );
  });

  it("keeps composer taxonomy shrinkable with long community and tag text", () => {
    expect(composerCss).toMatch(
      /\.compose-taxonomy-preview\s*{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/,
    );
    expect(composerCss).toMatch(
      /\.compose-taxonomy-community\s*{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/,
    );
    expect(composerCss).toMatch(
      /\.compose-taxonomy-community > span:first-child\s*{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
    );
    expect(composerCss).toMatch(
      /\.compose-taxonomy-community-icon\s*{[^}]*flex:\s*0 0 auto;/,
    );
    expect(composerCss).toMatch(
      /\.compose-tag-preview-list\s*{[^}]*flex-wrap:\s*wrap;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/,
    );
    expect(composerCss).toMatch(
      /\.compose-tag-chip-editable > span:first-child\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
  });

  it("lets paper composer taxonomy occupy the mobile content width", () => {
    expect(composerCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.composer-paper \.compose-taxonomy-preview\s*{[^}]*align-items:\s*flex-start;[^}]*width:\s*100%;/,
    );
    expect(composerCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.composer-paper \.compose-taxonomy-community-wrap,[\s\S]*\.composer-paper \.compose-tag-preview-list\s*{[^}]*max-width:\s*100%;/,
    );
  });
});
