import { describe, expect, it } from "vitest";
import { UI_MESSAGES } from "./uiMessages";

describe("UI_MESSAGES", () => {
  it("describes fallback share copies as copied share text", () => {
    expect(UI_MESSAGES.postShared).toBe("分享已发送。");
    expect(UI_MESSAGES.subPostShared).toBe("子帖定位链接已分享。");
    expect(UI_MESSAGES.postLinkCopied).toBe("分享已复制。");
    expect(UI_MESSAGES.subPostLinkCopied).toBe("定位分享已复制。");
    expect(UI_MESSAGES.subPostLocationLinkCopied).toBe("子帖定位链接已复制。");
    expect(UI_MESSAGES.subPostLocationLinkCopyFailed).toBe("子帖定位链接复制失败，请稍后重试。");
    expect(UI_MESSAGES.postShareCanceled).toBe("已取消分享。");
    expect(UI_MESSAGES.postShareFailed).toBe("分享或复制未成功，请稍后重试。");
    expect(UI_MESSAGES.subPostShareFailed).toBe("定位链接未能分享，请稍后重试。");
  });
});
