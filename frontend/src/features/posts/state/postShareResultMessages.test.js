import { describe, expect, it } from "vitest";
import { POST_SHARE_RESULTS } from "../../../shared/platform/postShareResults";
import { UI_MESSAGES } from "../../../shared/state/uiMessages";
import { resolvePostShareResultMessage } from "./postShareResultMessages";

describe("resolvePostShareResultMessage", () => {
  it("maps native share, copy, and failure results to user-visible messages", () => {
    expect(resolvePostShareResultMessage(POST_SHARE_RESULTS.shared))
      .toBe(UI_MESSAGES.postShared);
    expect(resolvePostShareResultMessage(POST_SHARE_RESULTS.copied))
      .toBe(UI_MESSAGES.postLinkCopied);
    expect(resolvePostShareResultMessage(POST_SHARE_RESULTS.failed))
      .toBe(UI_MESSAGES.postShareFailed);
  });

  it("keeps native share cancellation silent because the user intentionally dismissed it", () => {
    expect(resolvePostShareResultMessage(POST_SHARE_RESULTS.canceled)).toBe("");
  });

  it("uses contextual copy messages for sub-post share links", () => {
    expect(resolvePostShareResultMessage(POST_SHARE_RESULTS.copied, {
      copiedMessage: UI_MESSAGES.subPostLinkCopied,
    })).toBe(UI_MESSAGES.subPostLinkCopied);
  });

  it("keeps copied sub-post share feedback explicit about target location", () => {
    expect(resolvePostShareResultMessage(POST_SHARE_RESULTS.copied, {
      copiedMessage: UI_MESSAGES.subPostLinkCopied,
    })).toBe("定位分享已复制。");
  });

  it("uses contextual native-share messages for sub-post deep links", () => {
    expect(resolvePostShareResultMessage(POST_SHARE_RESULTS.shared, {
      sharedMessage: UI_MESSAGES.subPostShared,
    })).toBe(UI_MESSAGES.subPostShared);
  });

  it("uses contextual failure messages for sub-post deep links", () => {
    expect(resolvePostShareResultMessage(POST_SHARE_RESULTS.failed, {
      failedMessage: UI_MESSAGES.subPostShareFailed,
    })).toBe(UI_MESSAGES.subPostShareFailed);
  });

  it("does not point failed sub-post shares at the possibly unscoped current URL", () => {
    const message = resolvePostShareResultMessage(POST_SHARE_RESULTS.failed, {
      failedMessage: UI_MESSAGES.subPostShareFailed,
    });

    expect(message).toBe("定位链接未能分享，请稍后重试。");
    expect(message).not.toContain("当前链接");
  });

  it("ignores unknown share results", () => {
    expect(resolvePostShareResultMessage("unknown")).toBe("");
  });
});
