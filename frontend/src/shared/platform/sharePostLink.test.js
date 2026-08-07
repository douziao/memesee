import { describe, expect, it, vi } from "vitest";
import {
  buildPostNativeSharePayloadCandidates,
  buildPostShareClipboardText,
  buildPostShareContextText,
  buildPostSharePayload,
  buildPostShareUrl,
  copyTextToClipboard,
  normalizePostShareId,
  POST_SHARE_RESULTS,
  resolvePostShareId,
  sharePostLink,
} from "./sharePostLink";

function createClipboardDocumentMock({ execCommand }) {
  const appended = [];
  const documentLike = {
    body: {
      appendChild: vi.fn((element) => {
        appended.push(element);
      }),
      removeChild: vi.fn((element) => {
        const index = appended.indexOf(element);
        if (index >= 0) {
          appended.splice(index, 1);
        }
      }),
    },
    createElement: vi.fn(() => ({
      value: "",
      style: {},
      setAttribute: vi.fn(),
      select: vi.fn(),
    })),
    execCommand,
  };
  return {
    appended,
    documentLike,
  };
}

describe("sharePostLink", () => {
  it("builds stable post share URLs and payloads with a concise shared summary", () => {
    const post = {
      id: 42,
      title: "  一次\n产品迭代  ",
      content: "这里是正文预览，包含 **Markdown** 和 ![图片](media:1)。",
      communityName: "产品讨论",
      author: "nya",
    };

    expect(buildPostShareUrl({ post, origin: "https://memesee.world" }))
      .toBe("https://memesee.world/posts/42");
    expect(buildPostSharePayload({ post, url: "/posts/42" })).toEqual({
      title: "一次 产品迭代",
      text: "这里是正文预览，包含 Markdown。\n来自 MemeSee · 产品讨论 · @nya",
      url: "/posts/42",
    });
  });

  it("falls back to the title when no share preview is available", () => {
    expect(buildPostSharePayload({
      post: { id: 42, title: "帖子标题" },
      url: "/posts/42",
    })).toEqual({
      title: "帖子标题",
      text: "来自 MemeSee",
      url: "/posts/42",
    });
  });

  it("uses media-only summaries in share payloads", () => {
    expect(buildPostSharePayload({
      post: {
        id: 42,
        title: "图片主帖",
        mediaImageSources: [
          { processingStatus: "READY", displayUrl: "/media/ready.webp" },
          { processingStatus: "FAILED", displayUrl: "/media/failed.webp" },
        ],
      },
      url: "/posts/42",
    })).toEqual({
      title: "图片主帖",
      text: "1张图\n来自 MemeSee",
      url: "/posts/42",
    });
  });

  it("keeps ready media counts in rich text share payloads", () => {
    expect(buildPostShareClipboardText({
      post: {
        id: 42,
        title: "图文主帖",
        content: "这段正文需要和配图一起被转发。",
        communityName: "图片分享",
        authorUsername: "gallery-user",
        mediaAssets: [
          { id: 1, processingStatus: "READY" },
          { id: 2, processingStatus: "FAILED" },
        ],
      },
      url: "https://memesee.world/posts/42",
    })).toBe(
      "图文主帖\n这段正文需要和配图一起被转发。·1张图\n来自 MemeSee · 图片分享 · @gallery-user\nhttps://memesee.world/posts/42",
    );
  });

  it("builds compact share context from community and author fields", () => {
    expect(buildPostShareContextText({
      communityName: "  产品讨论  ",
      author: "@nya",
    })).toBe("来自 MemeSee · 产品讨论 · @nya");

    expect(buildPostShareContextText({
      communitySlug: "memes",
      authorUsername: "alice",
    })).toBe("来自 MemeSee · memes · @alice");
  });

  it("builds readable clipboard text for fallback sharing", () => {
    expect(buildPostShareClipboardText({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
        communityName: "产品讨论",
        author: "nya",
      },
      url: "https://memesee.world/posts/42",
    })).toBe(
      "帖子标题\n这是一段适合转发的摘要\n来自 MemeSee · 产品讨论 · @nya\nhttps://memesee.world/posts/42",
    );
  });

  it("does not duplicate the title in clipboard text when preview is empty", () => {
    expect(buildPostShareClipboardText({
      post: { id: 42, title: "帖子标题" },
      url: "https://memesee.world/posts/42",
    })).toBe("帖子标题\n来自 MemeSee\nhttps://memesee.world/posts/42");
  });

  it("only builds share URLs for positive integer post IDs", () => {
    expect(normalizePostShareId(42)).toBe("42");
    expect(normalizePostShareId("42")).toBe("42");
    expect(normalizePostShareId(0)).toBe("");
    expect(normalizePostShareId(-1)).toBe("");
    expect(normalizePostShareId("abc")).toBe("");

    expect(buildPostShareUrl({ post: { id: "42" }, origin: "" })).toBe("/posts/42");
    expect(buildPostShareUrl({ post: { id: -1 }, origin: "https://memesee.world" })).toBe("");
    expect(buildPostShareUrl({ post: { id: "abc" }, origin: "https://memesee.world" })).toBe("");
  });

  it("accepts stable post id aliases when building public share links", () => {
    expect(resolvePostShareId({ id: "draft", postId: "42" })).toBe("42");
    expect(resolvePostShareId({ id: "draft", mainPostId: "42" })).toBe("42");
    expect(resolvePostShareId({ id: "draft", postId: "bad-id" })).toBe("");

    expect(buildPostShareUrl({
      post: { postId: "42" },
      origin: "https://memesee.world",
      targetSubPostId: "7",
    })).toBe("https://memesee.world/posts/42?subPost=7");
    expect(buildPostShareUrl({
      post: { mainPostId: "42" },
      origin: "",
    })).toBe("/posts/42");
  });

  it("builds public sub-post deep links without leaking private route context", () => {
    expect(buildPostShareUrl({
      post: { id: 42 },
      origin: "https://memesee.world",
      targetSubPostId: "7",
    })).toBe("https://memesee.world/posts/42?subPost=7");

    expect(buildPostShareUrl({
      post: { id: 42 },
      origin: "",
      targetSubPostId: "bad-id",
    })).toBe("/posts/42");
  });

  it("keeps share URLs relative when the runtime origin is not a public web origin", () => {
    expect(buildPostShareUrl({
      post: { id: 42 },
      origin: "javascript:alert(1)",
      targetSubPostId: "7",
    })).toBe("/posts/42?subPost=7");

    expect(buildPostShareUrl({
      post: { id: 42 },
      origin: "file:///Users/nya/memesee/index.html",
    })).toBe("/posts/42");
  });

  it("adds target sub-post context to share payloads and clipboard text", () => {
    const post = {
      id: 42,
      title: "帖子标题",
      preview: "这是一段适合转发的摘要",
      communityName: "产品讨论",
      author: "nya",
    };

    expect(buildPostSharePayload({
      post,
      url: "https://memesee.world/posts/42?subPost=7",
      targetSubPostId: "7",
    })).toEqual({
      title: "帖子标题",
      text: "定位到子帖 #7\n这是一段适合转发的摘要\n来自 MemeSee · 产品讨论 · @nya",
      url: "https://memesee.world/posts/42?subPost=7",
    });

    expect(buildPostShareClipboardText({
      post,
      url: "https://memesee.world/posts/42?subPost=7",
      targetSubPostId: "7",
    })).toBe(
      "帖子标题\n定位到子帖 #7\n这是一段适合转发的摘要\n来自 MemeSee · 产品讨论 · @nya\nhttps://memesee.world/posts/42?subPost=7",
    );
  });

  it("uses enriched target sub-post author and summary in share text", () => {
    const post = {
      id: 42,
      title: "帖子标题 · @alice 的子帖",
      preview: "这条子帖更适合直接转发。",
      communityName: "产品讨论",
      author: "nya",
      shareTargetAuthor: "@alice",
      shareTargetPreview: "这条子帖更适合直接转发。",
    };

    expect(buildPostSharePayload({
      post,
      url: "https://memesee.world/posts/42?subPost=7",
      targetSubPostId: "7",
    })).toEqual({
      title: "帖子标题 · @alice 的子帖",
      text: "定位到 @alice 的子帖 #7\n这条子帖更适合直接转发。\n来自 MemeSee · 产品讨论 · @nya",
      url: "https://memesee.world/posts/42?subPost=7",
    });
  });

  it("builds progressively simpler native share payload candidates", () => {
    expect(buildPostNativeSharePayloadCandidates({
      title: " 帖子标题 ",
      text: "这是一段适合转发的摘要\n来自 MemeSee",
      url: " https://memesee.world/posts/42 ",
    })).toEqual([
      {
        title: "帖子标题",
        text: "这是一段适合转发的摘要\n来自 MemeSee",
        url: "https://memesee.world/posts/42",
      },
      {
        title: "帖子标题",
        url: "https://memesee.world/posts/42",
      },
      {
        url: "https://memesee.world/posts/42",
      },
    ]);

    expect(buildPostNativeSharePayloadCandidates({
      title: "帖子标题",
      url: "",
    })).toEqual([]);
  });

  it("drops malformed sub-post target context from share text", () => {
    expect(buildPostSharePayload({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
      },
      url: "https://memesee.world/posts/42",
      targetSubPostId: "bad-id",
    })).toEqual({
      title: "帖子标题",
      text: "这是一段适合转发的摘要\n来自 MemeSee",
      url: "https://memesee.world/posts/42",
    });
  });

  it("keeps target context visible when the summary would duplicate the title", () => {
    expect(buildPostShareClipboardText({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "帖子标题",
      },
      url: "https://memesee.world/posts/42?subPost=7",
      targetSubPostId: 7,
    })).toBe(
      "帖子标题\n定位到子帖 #7\n来自 MemeSee\nhttps://memesee.world/posts/42?subPost=7",
    );
  });

  it("uses native share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
        communityName: "产品讨论",
        author: "nya",
      },
      url: "https://memesee.world/posts/42",
      navigatorLike: {
        share,
        canShare: () => true,
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.shared);
    expect(share).toHaveBeenCalledWith({
      title: "帖子标题",
      text: "这是一段适合转发的摘要\n来自 MemeSee · 产品讨论 · @nya",
      url: "https://memesee.world/posts/42",
    });
  });

  it("passes target sub-post context to native share payloads", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
      },
      url: "https://memesee.world/posts/42?subPost=7",
      targetSubPostId: "7",
      navigatorLike: {
        share,
        canShare: () => true,
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.shared);
    expect(share).toHaveBeenCalledWith({
      title: "帖子标题",
      text: "定位到子帖 #7\n这是一段适合转发的摘要\n来自 MemeSee",
      url: "https://memesee.world/posts/42?subPost=7",
    });
  });

  it("passes enriched target sub-post context to native share payloads", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: {
        id: 42,
        title: "帖子标题 · @alice 的子帖",
        preview: "这条子帖更适合直接转发。",
        shareTargetAuthor: "alice",
      },
      url: "https://memesee.world/posts/42?subPost=7",
      targetSubPostId: "7",
      navigatorLike: {
        share,
        canShare: () => true,
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.shared);
    expect(share).toHaveBeenCalledWith({
      title: "帖子标题 · @alice 的子帖",
      text: "定位到 @alice 的子帖 #7\n这条子帖更适合直接转发。\n来自 MemeSee",
      url: "https://memesee.world/posts/42?subPost=7",
    });
  });

  it("uses a simplified native share payload when the full payload is unsupported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
      },
      url: "https://memesee.world/posts/42",
      navigatorLike: {
        share,
        canShare: (payload) => !payload.text && Boolean(payload.title && payload.url),
        clipboard: { writeText },
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.shared);
    expect(share).toHaveBeenCalledWith({
      title: "帖子标题",
      url: "https://memesee.world/posts/42",
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("uses URL-only native share when only links are supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
      },
      url: "https://memesee.world/posts/42",
      navigatorLike: {
        share,
        canShare: (payload) => Object.keys(payload).length === 1 && Boolean(payload.url),
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.shared);
    expect(share).toHaveBeenCalledWith({
      url: "https://memesee.world/posts/42",
    });
  });

  it("falls back to clipboard when native share capability checks fail", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
      },
      url: "https://memesee.world/posts/42",
      navigatorLike: {
        share,
        canShare: vi.fn(() => {
          throw new Error("unsupported share data");
        }),
        clipboard: { writeText },
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.copied);
    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(
      "帖子标题\n这是一段适合转发的摘要\n来自 MemeSee\nhttps://memesee.world/posts/42",
    );
  });

  it("does not copy links after a canceled native share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: { id: 42, title: "帖子标题" },
      url: "https://memesee.world/posts/42",
      navigatorLike: {
        share: vi.fn().mockRejectedValue({ name: "AbortError" }),
        clipboard: { writeText },
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.canceled);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies readable share text when native share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
      },
      url: "https://memesee.world/posts/42",
      navigatorLike: {
        clipboard: { writeText },
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.copied);
    expect(writeText).toHaveBeenCalledWith(
      "帖子标题\n这是一段适合转发的摘要\n来自 MemeSee\nhttps://memesee.world/posts/42",
    );
  });

  it("shares posts that only expose public post id aliases", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: {
        postId: "42",
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
      },
      url: "https://memesee.world/posts/42",
      navigatorLike: {
        clipboard: { writeText },
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.copied);
    expect(writeText).toHaveBeenCalledWith(
      "帖子标题\n这是一段适合转发的摘要\n来自 MemeSee\nhttps://memesee.world/posts/42",
    );
  });

  it("falls back to legacy clipboard copy when async clipboard write is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("permission denied"));
    const execCommand = vi.fn(() => true);
    const { appended, documentLike } = createClipboardDocumentMock({ execCommand });

    const result = await sharePostLink({
      post: {
        id: 42,
        title: "帖子标题",
        preview: "这是一段适合转发的摘要",
      },
      url: "https://memesee.world/posts/42",
      navigatorLike: {
        clipboard: { writeText },
      },
      documentLike,
    });

    expect(result).toBe(POST_SHARE_RESULTS.copied);
    expect(writeText).toHaveBeenCalledWith(
      "帖子标题\n这是一段适合转发的摘要\n来自 MemeSee\nhttps://memesee.world/posts/42",
    );
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(appended).toHaveLength(0);
  });

  it("removes the fallback textarea when legacy clipboard copy fails", async () => {
    const { appended, documentLike } = createClipboardDocumentMock({
      execCommand: vi.fn(() => false),
    });

    await expect(copyTextToClipboard("https://memesee.world/posts/42", {
      navigatorLike: {},
      documentLike,
    })).rejects.toThrow("Clipboard copy failed");

    expect(documentLike.body.appendChild).toHaveBeenCalledTimes(1);
    expect(documentLike.body.removeChild).toHaveBeenCalledTimes(1);
    expect(appended).toHaveLength(0);
  });

  it("removes the fallback textarea when legacy clipboard copy throws", async () => {
    const { appended, documentLike } = createClipboardDocumentMock({
      execCommand: vi.fn(() => {
        throw new Error("copy denied");
      }),
    });

    await expect(copyTextToClipboard("https://memesee.world/posts/42", {
      navigatorLike: {},
      documentLike,
    })).rejects.toThrow("copy denied");

    expect(documentLike.body.appendChild).toHaveBeenCalledTimes(1);
    expect(documentLike.body.removeChild).toHaveBeenCalledTimes(1);
    expect(appended).toHaveLength(0);
  });

  it("reports failure when neither share nor clipboard works", async () => {
    const result = await sharePostLink({
      post: { id: 42, title: "帖子标题" },
      url: "https://memesee.world/posts/42",
      navigatorLike: {},
      documentLike: null,
    });

    expect(result).toBe(POST_SHARE_RESULTS.failed);
  });

  it("does not share or copy invalid post links", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: { id: -1, title: "坏链接" },
      url: buildPostShareUrl({ post: { id: -1 }, origin: "https://memesee.world" }),
      navigatorLike: {
        share,
        clipboard: { writeText },
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.failed);
    expect(share).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("validates post IDs even when callers pass a non-empty URL", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await sharePostLink({
      post: { id: "abc", title: "坏链接" },
      url: "https://memesee.world/posts/abc",
      navigatorLike: {
        share,
        clipboard: { writeText },
      },
    });

    expect(result).toBe(POST_SHARE_RESULTS.failed);
    expect(share).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });
});
