import { describe, expect, it } from "vitest";
import {
  buildPostSummaryText,
  buildSubPostSummaryText,
  compactPostSummaryText,
  POST_SUMMARY_MAX_LENGTH,
} from "./postSummaryText";

describe("postSummaryText", () => {
  it("uses an explicit preview when available", () => {
    expect(buildPostSummaryText({
      post: {
        preview: "  一段\n适合传播的摘要  ",
        content: "不应该使用正文",
      },
    })).toBe("一段 适合传播的摘要");
  });

  it("builds a markdown-free summary from content", () => {
    expect(buildPostSummaryText({
      post: {
        content: "正文包含 **Markdown** 和 ![图片](media:1)。",
      },
    })).toBe("正文包含 Markdown。");
  });

  it("removes dangling connectors left by stripped markdown images", () => {
    expect(buildPostSummaryText({
      post: {
        content: "A post with **Markdown** and ![image](media:1).",
      },
    })).toBe("A post with Markdown.");
  });

  it("uses fallback text when a post has no previewable content", () => {
    expect(buildPostSummaryText({
      post: {},
      fallback: "用户在 MemeSee 发布的社区讨论。",
    })).toBe("用户在 MemeSee 发布的社区讨论。");
  });

  it("builds media-only summaries for posts without text", () => {
    expect(buildPostSummaryText({
      post: {
        content: "",
        mediaImageSources: [
          { src: "/media/ready.webp", processingStatus: "READY" },
          { src: "/media/processing.webp", processingStatus: "PROCESSING" },
        ],
      },
    })).toBe("1张图");
  });

  it("keeps ready media counts visible in text post summaries", () => {
    expect(buildPostSummaryText({
      post: {
        content: "正文包含一张可传播的配图。",
        mediaAssets: [
          { id: 1, processingStatus: "READY" },
          { id: 2, processingStatus: "PROCESSING" },
        ],
      },
    })).toBe("正文包含一张可传播的配图。·1张图");
  });

  it("prefers ready-aware media arrays over explicit media counts", () => {
    expect(buildPostSummaryText({
      post: {
        content: "",
        mediaAssetCount: 3,
        mediaAssets: [
          { id: 1, processingStatus: "READY" },
          { id: 2, processingStatus: "PROCESSING" },
          { id: 3, processingStatus: "FAILED" },
        ],
      },
    })).toBe("1张图");
  });

  it("limits summaries to the shared metadata length budget", () => {
    const value = "甲".repeat(POST_SUMMARY_MAX_LENGTH + 20);

    expect(compactPostSummaryText(value)).toHaveLength(POST_SUMMARY_MAX_LENGTH);
    expect(compactPostSummaryText(value).endsWith("…")).toBe(true);
  });

  it("builds media-only summaries for sub-posts without text", () => {
    expect(buildSubPostSummaryText({
      subPost: {
        content: "   ",
        mediaAssets: [{ id: 1 }],
      },
    })).toBe("1张图");

    expect(buildSubPostSummaryText({
      subPost: {
        mediaAssetCount: 3,
      },
    })).toBe("3张图");
  });

  it("upgrades legacy no-content sub-post previews when media is available", () => {
    expect(buildSubPostSummaryText({
      subPost: {
        subPostPreview: "无内容",
        mediaAssets: [{ id: 1 }, { id: 2 }],
      },
    })).toBe("2张图");
  });

  it("prefers readable sub-post text over media-only summaries", () => {
    expect(buildSubPostSummaryText({
      subPost: {
        content: "正文包含 **Markdown** 和 ![图片](media:1)。",
        mediaAssets: [{ id: 1 }],
      },
    })).toBe("正文包含 Markdown。");
  });
});
