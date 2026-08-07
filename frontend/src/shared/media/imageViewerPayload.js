import { normalizeAssetUrl } from "./mediaAssetHelpers";

export function normalizeImageViewerList(sourceImages, apiBase = "", { keepEmpty = false } = {}) {
  const normalizedImages = (Array.isArray(sourceImages) ? sourceImages : [])
    .map((item) => normalizeAssetUrl(item, apiBase));
  return keepEmpty
    ? normalizedImages
    : normalizedImages.filter(Boolean);
}

export function comparableImageKey(value, apiBase = "", origin = "") {
  const normalized = normalizeAssetUrl(value || "", apiBase);
  if (!normalized) {
    return "";
  }
  try {
    const baseOrigin = origin || "http://localhost";
    const parsed = new URL(normalized, baseOrigin);
    parsed.hash = "";
    parsed.searchParams.delete("v");
    const parsedOrigin = parsed.origin === baseOrigin ? "" : parsed.origin;
    const search = parsed.searchParams.toString();
    return `${parsedOrigin}${parsed.pathname}${search ? `?${search}` : ""}`;
  } catch {
    return normalized
      .replace(/#.*$/, "")
      .replace(/([?&])v=[^&]*&?/i, "$1")
      .replace(/[?&]$/, "");
  }
}

export function resolveImageViewerIndex(images, targetUrl, preferredIndex, options = {}) {
  const safeImages = Array.isArray(images) ? images : [];
  const indexCandidate = Number(preferredIndex);
  if (
    Number.isInteger(indexCandidate) &&
    indexCandidate >= 0 &&
    indexCandidate < safeImages.length
  ) {
    return indexCandidate;
  }
  const exactIndex = safeImages.indexOf(targetUrl);
  if (exactIndex >= 0) {
    return exactIndex;
  }
  const targetKey = comparableImageKey(targetUrl, options.apiBase, options.origin);
  const comparableIndex = safeImages.findIndex((image) =>
    comparableImageKey(image, options.apiBase, options.origin) === targetKey,
  );
  return comparableIndex >= 0 ? comparableIndex : 0;
}

export function normalizeImageViewerSources(imageSources, apiBase = "") {
  return Array.isArray(imageSources)
    ? imageSources.map((source) => ({
        ...source,
        src: normalizeAssetUrl(source?.src || source?.displayUrl || "", apiBase),
        displayUrl: normalizeAssetUrl(source?.displayUrl || source?.src || "", apiBase),
        originalUrl: normalizeAssetUrl(source?.originalUrl || "", apiBase),
      }))
    : [];
}

export function alignImageViewerSources(images, imageSources, options = {}) {
  if (!Array.isArray(imageSources) || imageSources.length === 0) {
    return [];
  }
  return (Array.isArray(images) ? images : []).map((image, imageIndex) => {
    const imageKey = comparableImageKey(image, options.apiBase, options.origin);
    return imageSources.find((source) =>
      [source?.src, source?.displayUrl, source?.originalUrl]
        .filter(Boolean)
        .some((sourceUrl) => comparableImageKey(sourceUrl, options.apiBase, options.origin) === imageKey),
    ) || imageSources[imageIndex] || {};
  });
}

export function dedupeImageViewerImages(images, options = {}) {
  const safeImages = Array.isArray(images) ? images : [];
  const targetKey = comparableImageKey(options.targetUrl, options.apiBase, options.origin);
  const preferredIndex = Number(options.preferredIndex);
  const normalizedPreferredIndex = Number.isInteger(preferredIndex) ? preferredIndex : -1;
  const byKey = new Map();

  safeImages.forEach((image, index) => {
    const key = comparableImageKey(image, options.apiBase, options.origin) || `fallback:${index}`;
    const previous = byKey.get(key);
    const isPreferredTarget =
      key === targetKey && (index === normalizedPreferredIndex || previous == null);
    if (!previous || isPreferredTarget) {
      byKey.set(key, {
        image,
        sourceIndex: index,
      });
    }
  });

  return Array.from(byKey.values());
}

function normalizeSourceIndex(value, fallbackIndex) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallbackIndex;
}

export function buildImageViewerPayloadFromEntries({
  entries = [],
  currentSourceIndex = 0,
  apiBase = "",
  origin = "",
} = {}) {
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .map((entry, entryIndex) => ({
      imageUrl: normalizeAssetUrl(entry?.imageUrl || "", apiBase),
      originalUrl: normalizeAssetUrl(entry?.originalUrl || "", apiBase),
      imageSource: entry?.imageSource || {},
      sourceIndex: normalizeSourceIndex(entry?.sourceIndex, entryIndex),
    }))
    .filter((entry) => entry.imageUrl);
  const rawImages = normalizedEntries.map((entry) => entry.imageUrl);
  const normalizedCurrentSourceIndex = normalizeSourceIndex(currentSourceIndex, 0);
  const currentRawIndex = normalizedEntries.findIndex((entry) =>
    entry.sourceIndex === normalizedCurrentSourceIndex,
  );
  const currentImageUrl = currentRawIndex >= 0 ? normalizedEntries[currentRawIndex].imageUrl : "";
  const imageEntries = dedupeImageViewerImages(rawImages, {
    targetUrl: currentImageUrl,
    preferredIndex: currentRawIndex,
    origin,
  });
  const images = imageEntries.map((entry) => entry.image);
  const imageSources = imageEntries.map((entry) =>
    normalizedEntries[entry.sourceIndex]?.imageSource || {},
  );
  const originalImages = imageEntries.map((entry) =>
    normalizedEntries[entry.sourceIndex]?.originalUrl || "",
  );
  const startIndex = currentRawIndex >= 0
    ? imageEntries.findIndex((entry) => entry.sourceIndex === currentRawIndex)
    : -1;

  return {
    images,
    imageSources,
    originalImages,
    startIndex,
    originalUrl: startIndex >= 0 ? originalImages[startIndex] || "" : "",
  };
}
