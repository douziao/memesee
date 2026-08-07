import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const profileCss = readFileSync(new URL("./Profile.css", import.meta.url), "utf8");

describe("Profile.css notification mobile contract", () => {
  it("wraps empty and sync status copy instead of allowing horizontal overflow", () => {
    expect(profileCss).toMatch(
      /\.profile-empty-inline\s*{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-sync-status\s*{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-sync-status > span\s*{[^}]*min-width:\s*0;/,
    );
  });

  it("stacks notification sync recovery actions into full-width touch targets on mobile", () => {
    expect(profileCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.profile-notification-sync-status\s*{[^}]*align-items:\s*flex-start;[^}]*flex-direction:\s*column;/,
    );
    expect(profileCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.profile-notification-sync-status \.neo-btn\s*{[^}]*justify-content:\s*center;[^}]*min-height:\s*40px;[^}]*width:\s*100%;/,
    );
  });

  it("keeps notification category tabs scrollable with stable count badges", () => {
    expect(profileCss).toMatch(
      /\.profile-notification-tabs\s*{[^}]*display:\s*flex;[^}]*overflow-x:\s*auto;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-tabs button\s*{[^}]*flex:\s*0 0 auto;[^}]*min-width:\s*0;[^}]*white-space:\s*nowrap;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-tabs strong\s*{[^}]*flex:\s*0 0 auto;/,
    );
  });

  it("keeps notification rows shrinkable with long actor and target text", () => {
    expect(profileCss).toMatch(
      /\.profile-notification-entry\s*{[^}]*grid-template-columns:\s*38px minmax\(0,\s*1fr\) 18px;[^}]*min-width:\s*0;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-main\s*{[^}]*min-width:\s*0;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-actor-line strong\s*{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-detail\s*{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-unavailable\s*{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(profileCss).toMatch(
      /\.profile-notification-target\s*{[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;/,
    );
  });

  it("keeps paper notification rows and mobile actor timestamps from overflowing", () => {
    expect(profileCss).toMatch(
      /\.profile-paper \.profile-notification-entry\s*{[^}]*grid-template-columns:\s*42px minmax\(0,\s*1fr\) 18px;[^}]*min-width:\s*0;/,
    );
    expect(profileCss).toMatch(
      /\.profile-paper \.profile-notification-detail\s*{[^}]*min-width:\s*0;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(profileCss).toMatch(
      /\.profile-paper \.profile-notification-unavailable\s*{[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(profileCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.profile-paper \.profile-notification-actor-line em\s*{[^}]*grid-column:\s*2;[^}]*justify-self:\s*start;[^}]*max-width:\s*100%;/,
    );
  });

  it("keeps profile community share rows compact and independently tappable", () => {
    expect(profileCss).toMatch(
      /\.profile-post-share\s*{[^}]*min-width:\s*66px;[^}]*min-height:\s*30px;[^}]*display:\s*inline-flex;[^}]*white-space:\s*nowrap;/,
    );
    expect(profileCss).toMatch(
      /\.profile-post-share:disabled\s*{[^}]*opacity:\s*1;[^}]*cursor:\s*progress;/,
    );
    expect(profileCss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*\.profile-post-share\s*{[^}]*min-width:\s*40px;[^}]*min-height:\s*32px;/,
    );
  });

  it("keeps paper profile community share buttons aligned with the paper action style", () => {
    expect(profileCss).toMatch(
      /\.profile-paper \.profile-header-logout-btn,[\s\S]*\.profile-paper \.profile-post-share,[\s\S]*\.profile-paper \.profile-post-more\s*{[^}]*border:\s*2px solid rgba\(47,\s*36,\s*27,\s*0\.22\);/,
    );
    expect(profileCss).toMatch(
      /\.profile-paper \.profile-header-logout-btn:hover:not\(:disabled\),[\s\S]*\.profile-paper \.profile-post-share:hover:not\(:disabled\),[\s\S]*\.profile-paper \.profile-post-more:hover,/,
    );
  });
});
