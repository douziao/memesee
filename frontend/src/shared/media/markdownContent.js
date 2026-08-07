const PREVIEW_LENGTH = 120;

export function parseMediaReference(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^media:([a-z0-9][a-z0-9-]{0,80})(?:\?([^#\s]*))?$/i);
  if (!match) {
    return null;
  }
  const ref = match[1];
  const numericId = /^\d+$/.test(ref) ? Number(ref) : 0;
  if (numericId < 0) {
    return null;
  }
  const params = new URLSearchParams(match[2] || "");
  return {
    ref,
    assetId: Number.isInteger(numericId) ? numericId : 0,
    width: params.get("width") || params.get("w") || "",
    height: params.get("height") || params.get("h") || "",
  };
}

export function isMediaReference(value) {
  return Boolean(parseMediaReference(value));
}

export function extractMarkdownMediaAssetIds(content) {
  const ids = [];
  const seen = new Set();
  const markdownRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = markdownRegex.exec(String(content || ""))) !== null) {
    const mediaReference = parseMediaReference(match[1]);
    if (mediaReference?.assetId > 0 && !seen.has(mediaReference.assetId)) {
      seen.add(mediaReference.assetId);
      ids.push(mediaReference.assetId);
    }
  }
  return ids;
}

export function removeMarkdownImages(content) {
  return String(content || "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removeExternalMarkdownImages(content) {
  return String(content || "")
    .replace(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (imageMarkdown, imageUrl) => (
      isMediaReference(imageUrl) ? imageMarkdown : ""
    ))
    .replace(/<img[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseMarkdownImageAlt(rawAlt) {
  const raw = String(rawAlt || "");
  const separatorIndex = raw.lastIndexOf("|");
  if (separatorIndex < 0) {
    return { alt: raw, width: "", height: "" };
  }
  const alt = raw.slice(0, separatorIndex).trim();
  const size = raw.slice(separatorIndex + 1).trim();
  const sizeMatch = size.match(/^(?:(?:width=)?([0-9]{1,4}%?))(?:x([0-9]{1,4}%?))?$/i);
  if (!sizeMatch) {
    return { alt: raw, width: "", height: "" };
  }
  return { alt, width: sizeMatch[1] || "", height: sizeMatch[2] || "" };
}

export function normalizeMarkdownImageSize(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{1,4}$/.test(raw)) {
    const pixels = Math.max(1, Math.min(2000, Number(raw)));
    return `${pixels}px`;
  }
  if (/^\d{1,3}%$/.test(raw)) {
    const percent = Math.max(1, Math.min(100, Number(raw.slice(0, -1))));
    return `${percent}%`;
  }
  return "";
}

export function stripMarkdown(content) {
  return String(content || "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/!\[[^\]\n]*(?:][^\n]*)?/g, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


export function buildPreview(content) {
  if (!content) {
    return "";
  }
  const sampled = content.length > 800 ? content.slice(0, 800) : content;
  const plain = stripMarkdown(sampled);
  if (plain.length <= PREVIEW_LENGTH) {
    return plain;
  }
  return plain.slice(0, PREVIEW_LENGTH) + "...";
}
