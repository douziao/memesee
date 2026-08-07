import { describe, expect, it } from "vitest";
import {
  mapMainPost,
  mapMyPostInteraction,
  mapMySubPostInteraction,
  mapNotification,
  mapSubPost,
} from "./contentApiMappers";

describe("content API mappers", () => {
  it("builds cleaned feed previews from markdown content", () => {
    const post = mapMainPost("", {
      id: 42,
      title: "Preview post",
      content: "正文包含 **Markdown** 和 ![图片](media:1)。",
    });

    expect(post.preview).toBe("正文包含 Markdown。");
  });

  it("cleans profile main-post interaction previews", () => {
    const interaction = mapMyPostInteraction({
      postId: 42,
      postTitle: "收藏的主帖",
      contentPreview: "正文包含 **Markdown** 和 ![图片](media:1)。",
      action: "favorite",
    });

    expect(interaction.preview).toBe("正文包含 Markdown。");
  });

  it("accepts mainPostId and mainPostTitle aliases in profile main-post interactions", () => {
    expect(mapMyPostInteraction({
      mainPostId: 42,
      mainPostTitle: "别名主帖",
      action: "favorite",
    })).toMatchObject({
      id: 42,
      postId: 42,
      title: "别名主帖",
      favoritedByMe: true,
    });
  });

  it("cleans profile sub-post interaction previews and main-post context", () => {
    const interaction = mapMySubPostInteraction({
      subPostId: 7,
      mainPostId: 42,
      postTitle: "主帖",
      mainPostContentPreview: "主帖包含 **Markdown** 和 ![图片](media:1)。",
      subPostPreview: "子帖包含 **Markdown** and ![image](media:2).",
      action: "like",
    });

    expect(interaction.mainPost.preview).toBe("主帖包含 Markdown。");
    expect(interaction.subPostPreview).toBe("子帖包含 Markdown.");
  });

  it("accepts postId and mainPostTitle aliases in profile sub-post interactions", () => {
    expect(mapMySubPostInteraction({
      subPostId: 7,
      postId: 42,
      mainPostTitle: "别名主帖",
      action: "like",
    })).toMatchObject({
      subPostId: 7,
      postId: 42,
      mainPostId: 42,
      postTitle: "别名主帖",
      mainPostTitle: "别名主帖",
      mainPost: {
        id: 42,
        postId: 42,
        title: "别名主帖",
      },
      action: "like",
    });
  });

  it("maps detail media placeholders without leaking them into feed previews", () => {
    const post = mapMainPost("/api", {
      id: 42,
      title: "Media post",
      content: "hello",
      mediaAssets: [
        {
          id: 1,
          width: 1200,
          height: 800,
          processingStatus: "PROCESSING",
        },
        {
          id: 2,
          displayUrl: "/media/ready-display.webp",
          thumbUrl: "/media/ready-thumb.webp",
          width: 1200,
          height: 800,
          processingStatus: "READY",
        },
      ],
    }, { detailed: true });

    expect(post.postMode).toBe("rich");
    expect(post.mediaImageSources).toHaveLength(2);
    expect(post.mediaImageSources[0]).toMatchObject({
      src: "",
      displayUrl: "",
      processingStatus: "PROCESSING",
      aspectRatio: 1.5,
    });
    expect(post.previewImageSources).toHaveLength(1);
    expect(post.previewImageSources[0]).toMatchObject({
      src: "/api/media/ready-thumb.webp",
      displayUrl: "/api/media/ready-display.webp",
      processingStatus: "READY",
    });
  });

  it("builds media-only feed previews from ready main-post media assets", () => {
    const post = mapMainPost("/api", {
      id: 42,
      title: "Media-only post",
      content: "",
      mediaAssets: [
        {
          id: 1,
          width: 1200,
          height: 800,
          processingStatus: "PROCESSING",
        },
        {
          id: 2,
          displayUrl: "/media/ready-display.webp",
          thumbUrl: "/media/ready-thumb.webp",
          width: 1200,
          height: 800,
          processingStatus: "READY",
        },
      ],
    });

    expect(post.preview).toBe("1张图");
  });

  it("does not build media-only feed previews from processing main-post media", () => {
    const post = mapMainPost("/api", {
      id: 42,
      title: "Processing media post",
      content: "",
      mediaAssets: [
        {
          id: 1,
          width: 1200,
          height: 800,
          processingStatus: "PROCESSING",
        },
      ],
    });

    expect(post.preview).toBe("");
  });

  it("accepts postId aliases in sub-post payloads", () => {
    expect(mapSubPost("", {
      id: 7,
      postId: 42,
      content: "子帖",
    })).toMatchObject({
      id: 7,
      postId: 42,
      mainPostId: 42,
    });
  });

  it("maps sub-post media assets into responsive image sources", () => {
    const subPost = mapSubPost("/api", {
      id: 7,
      postId: 42,
      content: "带图子帖",
      mediaAssets: [
        {
          id: 11,
          width: 1200,
          height: 800,
          processingStatus: "PROCESSING",
        },
        {
          id: 12,
          displayUrl: "/media/12/display.webp",
          thumbUrl: "/media/12/thumb.webp",
          width: 1200,
          height: 800,
          processingStatus: "READY",
        },
      ],
    });

    expect(subPost.mediaImageSources).toHaveLength(2);
    expect(subPost.mediaImageSources[0]).toMatchObject({
      src: "",
      processingStatus: "PROCESSING",
      aspectRatio: 1.5,
    });
    expect(subPost.mediaImageSources[1]).toMatchObject({
      src: "/api/media/12/display.webp",
      displayUrl: "/api/media/12/display.webp",
      processingStatus: "READY",
    });
  });

  it("builds media-only sub-post previews from mapped media assets", () => {
    const subPost = mapSubPost("/api", {
      id: 7,
      postId: 42,
      content: "",
      mediaAssets: [
        {
          id: 12,
          displayUrl: "/media/12/display.webp",
          width: 1200,
          height: 800,
          processingStatus: "READY",
        },
      ],
    });

    expect(subPost.subPostPreview).toBe("1张图");
    expect(subPost.preview).toBe("1张图");
  });

  it("accepts subPostId and targetSubPostId aliases in sub-post payloads", () => {
    expect(mapSubPost("", {
      id: "draft",
      subPostId: "pending",
      targetSubPostId: 7,
      postId: 42,
      parentId: 3,
      content: "子帖",
    })).toMatchObject({
      id: 7,
      subPostId: 7,
      targetSubPostId: 7,
      postId: 42,
      mainPostId: 42,
      parentId: 3,
      parentSubPostId: 3,
    });
  });

  it("accepts targetSubPostId aliases in notification payloads", () => {
    expect(mapNotification({
      id: 1,
      mainPostId: 42,
      targetSubPostId: 7,
    })).toMatchObject({
      id: 1,
      postId: 42,
      subPostId: 7,
    });
  });

  it("accepts postId aliases in notification payloads", () => {
    expect(mapNotification({
      id: 1,
      postId: 42,
      postTitle: "通知主帖",
    })).toMatchObject({
      id: 1,
      postId: 42,
      postTitle: "通知主帖",
    });
  });

  it("preserves unavailable notification reasons for deleted target fallbacks", () => {
    expect(mapNotification({
      id: 1,
      mainPostId: 42,
      targetSubPostId: 7,
      unavailableReason: "sub-post-deleted",
    })).toMatchObject({
      id: 1,
      postId: 42,
      subPostId: 7,
      unavailableReason: "sub-post-deleted",
    });
  });

  it("upgrades legacy media-only sub-post notification bodies at the API boundary", () => {
    expect(mapNotification({
      id: 1,
      type: "SUB_POST_CREATED",
      mainPostId: 42,
      body: "alice 在《主帖》下发布：无内容",
    }).body).toBe("alice 在《主帖》下发布：图片子帖");

    expect(mapNotification({
      id: 2,
      type: "SUB_POST_LIKED",
      mainPostId: 42,
      body: "无内容",
    }).body).toBe("图片子帖");
  });

  it("falls back to usable ids in profile sub-post interactions", () => {
    expect(mapMySubPostInteraction({
      subPostId: 7,
      mainPostId: "draft",
      postId: 42,
      mainPostTitle: "主帖",
      action: "favorite",
    })).toMatchObject({
      subPostId: 7,
      postId: 42,
      mainPostId: 42,
      mainPost: {
        id: 42,
        postId: 42,
      },
      action: "favorite",
    });
  });

  it("falls back to targetSubPostId in profile sub-post interactions", () => {
    expect(mapMySubPostInteraction({
      id: "draft",
      subPostId: "pending",
      targetSubPostId: 7,
      postId: 42,
      mainPostTitle: "主帖",
      action: "like",
    })).toMatchObject({
      id: 7,
      subPostId: 7,
      targetSubPostId: 7,
      postId: 42,
      mainPostId: 42,
      mainPost: {
        id: 42,
        postId: 42,
      },
      action: "like",
    });
  });

  it("uses profile sub-post media counts as previews when text is empty", () => {
    expect(mapMySubPostInteraction({
      subPostId: 7,
      postId: 42,
      mainPostTitle: "主帖",
      subPostPreview: "",
      subPostMediaAssetCount: 2,
      action: "favorite",
    })).toMatchObject({
      subPostPreview: "2张图",
    });
  });

  it("does not upgrade legacy profile sub-post previews when ready media count is zero", () => {
    expect(mapMySubPostInteraction({
      subPostId: 7,
      postId: 42,
      mainPostTitle: "主帖",
      subPostPreview: "无内容",
      subPostMediaAssetCount: 0,
      action: "favorite",
    })).toMatchObject({
      subPostPreview: "无内容",
    });
  });
});
