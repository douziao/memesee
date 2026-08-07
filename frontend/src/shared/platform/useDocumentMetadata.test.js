import { describe, expect, it } from "vitest";
import { applyDocumentMetadata } from "./useDocumentMetadata";

function selectorMatcher(selector) {
  const match = selector.match(/^(\w+)\[(\w+)="([^"]+)"\]$/);
  if (!match) {
    return () => false;
  }
  const [, tagName, attributeName, attributeValue] = match;
  return (element) =>
    element.tagName === tagName &&
    element.attributes[attributeName] === attributeValue;
}

function createFakeDocument() {
  const elements = [];
  const documentLike = {
    title: "",
    head: {
      querySelector(selector) {
        return elements.find(selectorMatcher(selector)) || null;
      },
      querySelectorAll(selector) {
        return elements.filter(selectorMatcher(selector));
      },
      appendChild(element) {
        elements.push(element);
      },
    },
    createElement(tagName) {
      return {
        tagName,
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        remove() {
          const index = elements.indexOf(this);
          if (index >= 0) {
            elements.splice(index, 1);
          }
        },
      };
    },
  };

  return documentLike;
}

function readAttribute(documentLike, selector, attributeName) {
  return documentLike.head.querySelector(selector)?.attributes[attributeName];
}

function countElements(documentLike, selector) {
  return documentLike.head.querySelectorAll(selector).length;
}

function appendHeadElement(documentLike, tagName, attributes) {
  const element = documentLike.createElement(tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
  documentLike.head.appendChild(element);
  return element;
}

describe("applyDocumentMetadata", () => {
  it("writes canonical, open graph and twitter metadata into the document head", () => {
    const documentLike = createFakeDocument();

    applyDocumentMetadata(
      {
        title: "媒体帖子 | MemeSee",
        description: "一条适合分享的帖子摘要。",
        canonicalUrl: "https://memesee.world/posts/42",
        imageUrl: "https://memesee.world/media/ready.webp",
        imageAlt: "媒体帖子分享图",
        imageWidth: "1200",
        imageHeight: "630",
        type: "article",
      },
      { documentLike },
    );

    expect(documentLike.title).toBe("媒体帖子 | MemeSee");
    expect(readAttribute(documentLike, 'meta[name="description"]', "content")).toBe("一条适合分享的帖子摘要。");
    expect(readAttribute(documentLike, 'link[rel="canonical"]', "href")).toBe("https://memesee.world/posts/42");
    expect(readAttribute(documentLike, 'meta[property="og:type"]', "content")).toBe("article");
    expect(readAttribute(documentLike, 'meta[property="og:url"]', "content")).toBe("https://memesee.world/posts/42");
    expect(readAttribute(documentLike, 'meta[property="og:image"]', "content")).toBe(
      "https://memesee.world/media/ready.webp",
    );
    expect(readAttribute(documentLike, 'meta[property="og:image:alt"]', "content")).toBe("媒体帖子分享图");
    expect(readAttribute(documentLike, 'meta[property="og:image:width"]', "content")).toBe("1200");
    expect(readAttribute(documentLike, 'meta[property="og:image:height"]', "content")).toBe("630");
    expect(readAttribute(documentLike, 'meta[name="twitter:image"]', "content")).toBe(
      "https://memesee.world/media/ready.webp",
    );
    expect(readAttribute(documentLike, 'meta[name="twitter:image:alt"]', "content")).toBe("媒体帖子分享图");
  });

  it("removes stale share image tags and image descriptors when the next metadata payload has no image", () => {
    const documentLike = createFakeDocument();

    applyDocumentMetadata(
      {
        title: "旧帖子 | MemeSee",
        description: "旧摘要",
        canonicalUrl: "https://memesee.world/posts/42",
        imageUrl: "https://memesee.world/media/old.webp",
        imageAlt: "旧帖子分享图",
        imageWidth: "1200",
        imageHeight: "630",
      },
      { documentLike },
    );
    applyDocumentMetadata(
      {
        title: "首页 | MemeSee",
        description: "首页摘要",
        canonicalUrl: "https://memesee.world/",
      },
      { documentLike },
    );

    expect(documentLike.head.querySelector('meta[property="og:image"]')).toBeNull();
    expect(documentLike.head.querySelector('meta[property="og:image:alt"]')).toBeNull();
    expect(documentLike.head.querySelector('meta[property="og:image:width"]')).toBeNull();
    expect(documentLike.head.querySelector('meta[property="og:image:height"]')).toBeNull();
    expect(documentLike.head.querySelector('meta[name="twitter:image"]')).toBeNull();
    expect(documentLike.head.querySelector('meta[name="twitter:image:alt"]')).toBeNull();
    expect(readAttribute(documentLike, 'meta[property="og:url"]', "content")).toBe("https://memesee.world/");
  });

  it("does not keep stale image dimensions when the next image has unknown dimensions", () => {
    const documentLike = createFakeDocument();

    applyDocumentMetadata(
      {
        title: "默认图 | MemeSee",
        description: "默认图摘要",
        canonicalUrl: "https://memesee.world/",
        imageUrl: "https://memesee.world/og-image.png",
        imageAlt: "默认图",
        imageWidth: "1200",
        imageHeight: "630",
      },
      { documentLike },
    );
    applyDocumentMetadata(
      {
        title: "媒体图 | MemeSee",
        description: "媒体图摘要",
        canonicalUrl: "https://memesee.world/posts/42",
        imageUrl: "https://memesee.world/media/42.webp",
        imageAlt: "媒体图",
      },
      { documentLike },
    );

    expect(readAttribute(documentLike, 'meta[property="og:image"]', "content")).toBe(
      "https://memesee.world/media/42.webp",
    );
    expect(readAttribute(documentLike, 'meta[property="og:image:alt"]', "content")).toBe("媒体图");
    expect(documentLike.head.querySelector('meta[property="og:image:width"]')).toBeNull();
    expect(documentLike.head.querySelector('meta[property="og:image:height"]')).toBeNull();
  });

  it("uses the current location as canonical fallback", () => {
    const documentLike = createFakeDocument();

    applyDocumentMetadata({ title: "MemeSee 社区论坛" }, {
      documentLike,
      locationHref: "https://memesee.world/posts/99",
    });

    expect(readAttribute(documentLike, 'link[rel="canonical"]', "href")).toBe("https://memesee.world/posts/99");
    expect(readAttribute(documentLike, 'meta[property="og:url"]', "content")).toBe(
      "https://memesee.world/posts/99",
    );
  });

  it("updates existing metadata tags without duplicating them across route changes", () => {
    const documentLike = createFakeDocument();

    applyDocumentMetadata(
      {
        title: "帖子 42 | MemeSee",
        description: "帖子摘要",
        canonicalUrl: "https://memesee.world/posts/42",
        imageUrl: "https://memesee.world/media/42.webp",
        type: "article",
      },
      { documentLike },
    );
    applyDocumentMetadata(
      {
        title: "MemeSee 社区论坛",
        description: "首页摘要",
        canonicalUrl: "https://memesee.world/",
        imageUrl: "https://memesee.world/og-image.png",
        type: "website",
      },
      { documentLike },
    );

    expect(readAttribute(documentLike, 'link[rel="canonical"]', "href")).toBe("https://memesee.world/");
    expect(readAttribute(documentLike, 'meta[property="og:title"]', "content")).toBe("MemeSee 社区论坛");
    expect(readAttribute(documentLike, 'meta[property="og:type"]', "content")).toBe("website");
    expect(readAttribute(documentLike, 'meta[property="og:image"]', "content")).toBe(
      "https://memesee.world/og-image.png",
    );
    expect(countElements(documentLike, 'link[rel="canonical"]')).toBe(1);
    expect(countElements(documentLike, 'meta[property="og:title"]')).toBe(1);
    expect(countElements(documentLike, 'meta[property="og:image"]')).toBe(1);
    expect(countElements(documentLike, 'meta[name="twitter:image"]')).toBe(1);
  });

  it("prunes duplicate metadata tags before writing the latest values", () => {
    const documentLike = createFakeDocument();
    appendHeadElement(documentLike, "link", { rel: "canonical", href: "https://memesee.world/old-a" });
    appendHeadElement(documentLike, "link", { rel: "canonical", href: "https://memesee.world/old-b" });
    appendHeadElement(documentLike, "meta", { property: "og:image", content: "https://memesee.world/old-a.webp" });
    appendHeadElement(documentLike, "meta", { property: "og:image", content: "https://memesee.world/old-b.webp" });

    applyDocumentMetadata(
      {
        title: "帖子 42 | MemeSee",
        description: "帖子摘要",
        canonicalUrl: "https://memesee.world/posts/42",
        imageUrl: "https://memesee.world/media/42.webp",
        type: "article",
      },
      { documentLike },
    );

    expect(countElements(documentLike, 'link[rel="canonical"]')).toBe(1);
    expect(countElements(documentLike, 'meta[property="og:image"]')).toBe(1);
    expect(readAttribute(documentLike, 'link[rel="canonical"]', "href")).toBe("https://memesee.world/posts/42");
    expect(readAttribute(documentLike, 'meta[property="og:image"]', "content")).toBe(
      "https://memesee.world/media/42.webp",
    );
  });

  it("does nothing when no document is available", () => {
    expect(() => applyDocumentMetadata({ title: "MemeSee 社区论坛" })).not.toThrow();
  });
});
