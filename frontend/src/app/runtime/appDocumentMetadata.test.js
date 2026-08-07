import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDocumentMetadata } from "./appDocumentMetadata";
import { buildPostSummaryText } from "../../shared/platform/postSummaryText";

function readStaticIndexHtml() {
  return readFileSync(resolve(process.cwd(), "index.html"), "utf8");
}

function readHtmlTitle(html) {
  return html.match(/<title>([^<]*)<\/title>/)?.[1] || "";
}

function readMetaContent(html, selectorName, selectorValue) {
  const selector = `${selectorName}="${selectorValue}"`;
  const pattern = new RegExp(`<meta\\s+[^>]*${selector}[^>]*content="([^"]*)"[^>]*>`, "i");
  return html.match(pattern)?.[1] || "";
}

function readLinkHref(html, rel) {
  const pattern = new RegExp(`<link\\s+[^>]*rel="${rel}"[^>]*href="([^"]*)"[^>]*>`, "i");
  return html.match(pattern)?.[1] || "";
}

describe("buildDocumentMetadata", () => {
  it("builds share metadata for a loaded post", () => {
    const selectedPost = {
      id: 42,
      contentLoaded: true,
      title: "一次认真打磨产品的记录",
      author: "nya",
      content: "这里是正文内容，用来生成分享摘要。",
      previewImages: ["/media/post/display.webp"],
    };
    const metadata = buildDocumentMetadata({
      route: { type: "post", mainPostId: 42 },
      selectedPost,
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("一次认真打磨产品的记录 | MemeSee");
    expect(metadata.description).toContain("这里是正文内容");
    expect(metadata.description).toBe(buildPostSummaryText({
      post: selectedPost,
    }));
    expect(metadata.description).not.toContain("来自 MemeSee");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/posts/42");
    expect(metadata.imageUrl).toBe("https://memesee.world/media/post/display.webp");
    expect(metadata.imageAlt).toBe("一次认真打磨产品的记录 分享图");
    expect(metadata.imageWidth).toBeUndefined();
    expect(metadata.imageHeight).toBeUndefined();
    expect(metadata.type).toBe("article");
  });

  it("keeps public sub-post deep links in post canonical metadata", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
        manageSource: "profile-published",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "带子帖定位的主帖",
        content: "正文",
      },
      origin: "https://memesee.world",
    });

    expect(metadata.canonicalUrl).toBe("https://memesee.world/posts/42?subPost=7");
  });

  it("uses loaded target sub-post content for sub-post share metadata", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "主帖标题",
        content: "主帖正文不应该覆盖目标子帖摘要。",
        previewImages: ["/media/post.webp"],
      },
      subPosts: [
        {
          subPostId: "7",
          authorUsername: "alice",
          content: "这条子帖本身才是分享链接想让访客先看到的内容。",
        },
      ],
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("主帖标题 · @alice 的子帖 | MemeSee");
    expect(metadata.description).toBe("这条子帖本身才是分享链接想让访客先看到的内容。");
    expect(metadata.description).not.toContain("主帖正文");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/posts/42?subPost=7");
    expect(metadata.imageUrl).toBe("https://memesee.world/media/post.webp");
    expect(metadata.imageAlt).toBe("主帖标题 · @alice 的子帖 分享图");
    expect(metadata.type).toBe("article");
  });

  it("uses target sub-post media summaries and images for media-only deep links", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "主帖标题",
        content: "主帖正文不应该覆盖目标子帖摘要。",
        mediaImageSources: [
          { processingStatus: "READY", displayUrl: "/media/main.webp" },
        ],
      },
      subPosts: [
        {
          subPostId: "7",
          authorUsername: "alice",
          content: "",
          mediaImageSources: [
            { processingStatus: "PROCESSING", displayUrl: "/media/sub-processing.webp" },
            { processingStatus: "READY", displayUrl: "/media/sub-ready.webp" },
          ],
        },
      ],
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("主帖标题 · @alice 的子帖 | MemeSee");
    expect(metadata.description).toBe("1张图");
    expect(metadata.imageUrl).toBe("https://memesee.world/media/sub-ready.webp");
    expect(metadata.imageAlt).toBe("主帖标题 · @alice 的子帖 分享图");
    expect(metadata.imageWidth).toBeUndefined();
    expect(metadata.imageHeight).toBeUndefined();
  });

  it("uses ready media assets as post share images when normalized image sources are absent", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "post", mainPostId: 42 },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "媒体资源主帖",
        content: "正文",
        mediaAssets: [
          { processingStatus: "PROCESSING", displayUrl: "/media/asset-processing.webp" },
          { processingStatus: "READY", displayUrl: "/media/asset-ready.webp" },
        ],
      },
      origin: "https://memesee.world",
    });

    expect(metadata.imageUrl).toBe("https://memesee.world/media/asset-ready.webp");
  });

  it("uses target sub-post preview image sources for deep-link share images", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "主帖标题",
        content: "主帖正文",
        mediaAssets: [
          { processingStatus: "READY", displayUrl: "/media/main-ready.webp" },
        ],
      },
      subPosts: [
        {
          id: 7,
          authorUsername: "alice",
          content: "带图子帖",
          previewImageSources: [
            { processingStatus: "READY", src: "/media/sub-preview.webp" },
          ],
        },
      ],
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("主帖标题 · @alice 的子帖 | MemeSee");
    expect(metadata.imageUrl).toBe("https://memesee.world/media/sub-preview.webp");
    expect(metadata.imageAlt).toBe("主帖标题 · @alice 的子帖 分享图");
  });

  it("uses nested branch reply content for sub-post share metadata", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "8",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "主帖标题",
        content: "主帖正文不应该覆盖分支回复摘要。",
      },
      subPosts: [
        {
          id: 7,
          authorUsername: "parent",
          content: "父级子帖内容",
          branchSubPosts: [
            {
              subPostId: "8",
              authorUsername: "@branch-user",
              content: "分支回复本身才是分享卡片应该呈现的内容。",
            },
          ],
        },
      ],
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("主帖标题 · @branch-user 的子帖 | MemeSee");
    expect(metadata.description).toBe("分支回复本身才是分享卡片应该呈现的内容。");
    expect(metadata.description).not.toContain("主帖正文");
    expect(metadata.description).not.toContain("父级子帖内容");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/posts/42?subPost=8");
  });

  it("keeps sub-post metadata author handles readable when payloads include @", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "主帖标题",
        content: "主帖正文",
      },
      subPosts: [
        {
          id: 7,
          author: "@alice",
        },
      ],
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("主帖标题 · @alice 的子帖 | MemeSee");
    expect(metadata.description).toBe("@alice 在这条 MemeSee 讨论下发布的子帖。");
  });

  it("falls back to main-post metadata until the target sub-post is loaded", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "主帖标题",
        content: "主帖正文摘要",
      },
      subPosts: [
        {
          id: 8,
          content: "另一条子帖",
        },
      ],
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("主帖标题 | MemeSee");
    expect(metadata.description).toBe("主帖正文摘要");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/posts/42?subPost=7");
  });

  it("drops confirmed missing target sub-posts from canonical metadata", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "主帖标题",
        content: "主帖正文摘要",
      },
      subPosts: [
        {
          id: 8,
          content: "另一条子帖",
        },
      ],
      targetSubPostStatus: {
        kind: "missing",
        message: "未找到这条子帖，可能已被删除或暂不可见。",
      },
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("主帖标题 | MemeSee");
    expect(metadata.description).toBe("主帖正文摘要");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/posts/42");
  });

  it("drops malformed sub-post targets from canonical metadata", () => {
    const metadata = buildDocumentMetadata({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "bad-id",
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "普通主帖",
        content: "正文",
      },
      origin: "https://memesee.world",
    });

    expect(metadata.canonicalUrl).toBe("https://memesee.world/posts/42");
  });

  it("uses community context for home metadata", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "home" },
      selectedCommunity: { slug: "tech", name: "科技" },
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("科技 | MemeSee");
    expect(metadata.description).toContain("科技");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/");
    expect(metadata.type).toBe("website");
  });

  it("uses route-specific metadata for the composer", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "compose" },
      selectedCommunity: { slug: "lobby", name: "大厅" },
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("发布主帖 | MemeSee");
    expect(metadata.description).toContain("选择社区");
    expect(metadata.description).toContain("上传图片");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/compose");
    expect(metadata.type).toBe("website");
  });

  it("falls back to the home canonical URL for invalid post routes", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "post", mainPostId: "abc" },
      origin: "https://memesee.world",
    });

    expect(metadata.canonicalUrl).toBe("https://memesee.world/");
    expect(metadata.type).toBe("website");
  });

  it("does not build article metadata for invalid post routes with stale loaded posts", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "post", mainPostId: "abc" },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "不应该出现在分享卡片里的旧帖子",
        content: "旧正文",
      },
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("MemeSee 社区论坛");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/");
    expect(metadata.type).toBe("website");
  });

  it("does not reuse stale post metadata while another post route is loading", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "post", mainPostId: 43 },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "上一条主帖",
        content: "上一条正文",
        previewImages: ["/media/stale.webp"],
      },
      origin: "https://memesee.world",
    });

    expect(metadata.title).toBe("MemeSee 社区论坛");
    expect(metadata.canonicalUrl).toBe("https://memesee.world/posts/43");
    expect(metadata.imageUrl).toBe("https://memesee.world/og-image.png");
    expect(metadata.type).toBe("website");
  });

  it("uses the first ready media source for post share images", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "post", mainPostId: 42 },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "媒体预览",
        content: "正文",
        mediaImageSources: [
          { processingStatus: "PROCESSING", displayUrl: "/media/processing.webp" },
          { processingStatus: "FAILED", displayUrl: "/media/failed.webp" },
          { processingStatus: "READY", displayUrl: "/media/ready-display.webp" },
        ],
        previewImages: ["/media/fallback-preview.webp"],
      },
      origin: "https://memesee.world",
    });

    expect(metadata.imageUrl).toBe("https://memesee.world/media/ready-display.webp");
  });

  it("falls back to the default share image when post media is not ready", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "post", mainPostId: 42 },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "媒体预览",
        content: "正文",
        mediaImageSources: [
          { processingStatus: "PROCESSING", displayUrl: "/media/processing.webp" },
          { processingStatus: "FAILED", displayUrl: "/media/failed.webp" },
        ],
      },
      origin: "https://memesee.world",
    });

    expect(metadata.imageUrl).toBe("https://memesee.world/og-image.png");
    expect(metadata.imageAlt).toBe("媒体预览 分享图");
    expect(metadata.imageWidth).toBe("1200");
    expect(metadata.imageHeight).toBe("630");
  });

  it("keeps the static index head aligned with runtime home metadata defaults", () => {
    const html = readStaticIndexHtml();
    const metadata = buildDocumentMetadata({
      route: { type: "home" },
      origin: "https://memesee.world",
    });

    expect(readHtmlTitle(html)).toBe(metadata.title);
    expect(readMetaContent(html, "name", "description")).toBe(metadata.description);
    expect(readLinkHref(html, "canonical")).toBe(metadata.canonicalUrl);
    expect(readMetaContent(html, "property", "og:site_name")).toBe("MemeSee");
    expect(readMetaContent(html, "property", "og:title")).toBe(metadata.title);
    expect(readMetaContent(html, "property", "og:description")).toBe(metadata.description);
    expect(readMetaContent(html, "property", "og:type")).toBe(metadata.type);
    expect(readMetaContent(html, "property", "og:url")).toBe(metadata.canonicalUrl);
    expect(readMetaContent(html, "property", "og:image"))
      .toBe("https://memesee.world/og-image.png");
    expect(readMetaContent(html, "property", "og:image:alt"))
      .toBe("MemeSee 社区论坛分享卡片");
    expect(readMetaContent(html, "property", "og:image:width")).toBe("1200");
    expect(readMetaContent(html, "property", "og:image:height")).toBe("630");
    expect(readMetaContent(html, "name", "twitter:card")).toBe("summary_large_image");
    expect(readMetaContent(html, "name", "twitter:title")).toBe(metadata.title);
    expect(readMetaContent(html, "name", "twitter:description")).toBe(metadata.description);
    expect(readMetaContent(html, "name", "twitter:image"))
      .toBe("https://memesee.world/og-image.png");
    expect(readMetaContent(html, "name", "twitter:image:alt"))
      .toBe("MemeSee 社区论坛分享卡片");
  });

  it("includes default share image descriptors for home metadata", () => {
    const metadata = buildDocumentMetadata({
      route: { type: "home" },
      origin: "https://memesee.world",
    });

    expect(metadata.imageUrl).toBe("https://memesee.world/og-image.png");
    expect(metadata.imageAlt).toBe("MemeSee 社区论坛分享卡片");
    expect(metadata.imageWidth).toBe("1200");
    expect(metadata.imageHeight).toBe("630");
  });
});
