import { normalizeAssetUrl } from "./mediaAssetHelpers";

function collectTextFromNode(node) {
  if (Array.isArray(node)) {
    return node.map((child) => collectTextFromNode(child)).join("");
  }
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (typeof node === "object" && "props" in node) {
    return collectTextFromNode(node.props?.children);
  }
  return "";
}

export function keepMarkdownUrl(value) {
  const raw = String(value || "");
  if (raw.trim().startsWith("media:")) {
    return raw;
  }
  return normalizeMarkdownLinkHref(raw);
}

export function normalizeMarkdownLinkHref(href, apiBase = "") {
  const raw = String(href || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return normalizeAssetUrl(raw, apiBase);
  }
  if (/^(mailto|tel):/i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("#") || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) {
    return raw;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return "";
  }
  return `/${raw.replace(/^\/+/, "")}`;
}

export function extractMarkdownCodeText(children) {
  return collectTextFromNode(children);
}
