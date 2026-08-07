import { useEffect, useLayoutEffect } from "react";

const DEFAULT_TITLE = "MemeSee 社区论坛";
const SITE_NAME = "MemeSee";
const useMetadataEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function findHeadElements(documentLike, selector) {
  if (typeof documentLike.head.querySelectorAll === "function") {
    return Array.from(documentLike.head.querySelectorAll(selector));
  }
  const element = documentLike.head.querySelector(selector);
  return element ? [element] : [];
}

function removeDuplicateHeadElements(documentLike, selector, keepElement) {
  findHeadElements(documentLike, selector).forEach((element) => {
    if (element !== keepElement) {
      element.remove();
    }
  });
}

function setMetaTag(documentLike, selector, attributes) {
  let element = findHeadElements(documentLike, selector)[0] || null;
  if (!element) {
    element = documentLike.createElement("meta");
    documentLike.head.appendChild(element);
  }
  removeDuplicateHeadElements(documentLike, selector, element);
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

function setLinkTag(documentLike, selector, attributes) {
  let element = findHeadElements(documentLike, selector)[0] || null;
  if (!element) {
    element = documentLike.createElement("link");
    documentLike.head.appendChild(element);
  }
  removeDuplicateHeadElements(documentLike, selector, element);
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

function removeHeadTag(documentLike, selector) {
  findHeadElements(documentLike, selector).forEach((element) => element.remove());
}

export function applyDocumentMetadata(metadata, { documentLike, locationHref = "" } = {}) {
  const targetDocument = documentLike || (typeof document === "undefined" ? null : document);
  if (!metadata || !targetDocument?.head) {
    return;
  }

  const title = metadata.title || DEFAULT_TITLE;
  const description = metadata.description || "";
  const canonicalUrl = metadata.canonicalUrl || locationHref;
  const imageUrl = metadata.imageUrl || "";
  const imageAlt = metadata.imageAlt || title;
  const imageWidth = metadata.imageWidth || "";
  const imageHeight = metadata.imageHeight || "";
  const type = metadata.type || "website";

  targetDocument.title = title;
  setMetaTag(targetDocument, 'meta[name="description"]', { name: "description", content: description });
  setLinkTag(targetDocument, 'link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });
  setMetaTag(targetDocument, 'meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
  setMetaTag(targetDocument, 'meta[property="og:title"]', { property: "og:title", content: title });
  setMetaTag(targetDocument, 'meta[property="og:description"]', { property: "og:description", content: description });
  setMetaTag(targetDocument, 'meta[property="og:type"]', { property: "og:type", content: type });
  setMetaTag(targetDocument, 'meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  if (imageUrl) {
    setMetaTag(targetDocument, 'meta[property="og:image"]', { property: "og:image", content: imageUrl });
    setMetaTag(targetDocument, 'meta[property="og:image:alt"]', { property: "og:image:alt", content: imageAlt });
    if (imageWidth) {
      setMetaTag(targetDocument, 'meta[property="og:image:width"]', {
        property: "og:image:width",
        content: imageWidth,
      });
    } else {
      removeHeadTag(targetDocument, 'meta[property="og:image:width"]');
    }
    if (imageHeight) {
      setMetaTag(targetDocument, 'meta[property="og:image:height"]', {
        property: "og:image:height",
        content: imageHeight,
      });
    } else {
      removeHeadTag(targetDocument, 'meta[property="og:image:height"]');
    }
  } else {
    removeHeadTag(targetDocument, 'meta[property="og:image"]');
    removeHeadTag(targetDocument, 'meta[property="og:image:alt"]');
    removeHeadTag(targetDocument, 'meta[property="og:image:width"]');
    removeHeadTag(targetDocument, 'meta[property="og:image:height"]');
  }
  setMetaTag(targetDocument, 'meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  setMetaTag(targetDocument, 'meta[name="twitter:title"]', { name: "twitter:title", content: title });
  setMetaTag(targetDocument, 'meta[name="twitter:description"]', { name: "twitter:description", content: description });
  if (imageUrl) {
    setMetaTag(targetDocument, 'meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    setMetaTag(targetDocument, 'meta[name="twitter:image:alt"]', { name: "twitter:image:alt", content: imageAlt });
  } else {
    removeHeadTag(targetDocument, 'meta[name="twitter:image"]');
    removeHeadTag(targetDocument, 'meta[name="twitter:image:alt"]');
  }
}

export function useDocumentMetadata(metadata) {
  const documentLike = typeof document === "undefined" ? null : document;

  useMetadataEffect(() => {
    if (!metadata || !documentLike) {
      return;
    }

    applyDocumentMetadata(metadata, { documentLike });
  }, [documentLike, metadata]);
}
