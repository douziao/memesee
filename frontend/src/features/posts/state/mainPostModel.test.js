import { describe, expect, it } from "vitest";
import { normalizePostPayload } from "./mainPostModel";

describe("normalizePostPayload", () => {
  it("builds cleaned local previews from markdown content", () => {
    const post = normalizePostPayload({
      id: 42,
      title: "Preview post",
      content: "正文包含 **Markdown** 和 ![图片](media:1)。",
    });

    expect(post.preview).toBe("正文包含 Markdown。");
  });
});
