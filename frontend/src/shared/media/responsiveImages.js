const VARIANT_WIDTHS = {
  thumb: 480,
  small: 720,
  medium: 1080,
  display: 1600,
};

export const FEED_IMAGE_SIZES = "(max-width: 720px) calc((100vw - 56px) / 3), 240px";
export const DETAIL_IMAGE_SIZES = "(max-width: 760px) calc(100vw - 32px), min(72vw, 1040px)";
export const LIGHTBOX_IMAGE_SIZES = "100vw";

function normalizeUrl(value) {
  return String(value || "").trim();
}

function variantFieldName(kind) {
  return `${kind}Url`;
}

function findVariant(asset, kind) {
  const variants = Array.isArray(asset?.variants) ? asset.variants : [];
  return variants.find((variant) => String(variant?.kind || "").toLowerCase() === kind) || null;
}

function variantUrl(asset, kind) {
  const directUrl = normalizeUrl(asset?.[variantFieldName(kind)]);
  if (directUrl) {
    return directUrl;
  }
  return normalizeUrl(findVariant(asset, kind)?.url);
}

function assetDimension(asset, key) {
  const value = Number(asset?.[key] || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function variantWidth(asset, kind) {
  const explicitWidth = Number(asset?.[kind + "Width"] || 0);
  if (Number.isFinite(explicitWidth) && explicitWidth > 0) {
    return explicitWidth;
  }
  const width = Number(findVariant(asset, kind)?.width || 0);
  return Number.isFinite(width) && width > 0 ? width : VARIANT_WIDTHS[kind];
}

function variantHeight(asset, kind) {
  const directHeight = Number(asset?.[kind + "Height"] || 0);
  if (Number.isFinite(directHeight) && directHeight > 0) {
    return directHeight;
  }
  const explicitHeight = Number(findVariant(asset, kind)?.height || 0);
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
    return explicitHeight;
  }
  const originalWidth = assetDimension(asset, "width");
  const originalHeight = assetDimension(asset, "height");
  const width = variantWidth(asset, kind);
  if (originalWidth > 0 && originalHeight > 0 && width > 0) {
    return Math.max(1, Math.round((width * originalHeight) / originalWidth));
  }
  return 0;
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate?.url || seen.has(candidate.url)) {
      return false;
    }
    seen.add(candidate.url);
    return true;
  });
}

export function buildResponsiveImageSource(asset, options = {}) {
  if (typeof asset === "string") {
    const src = normalizeUrl(asset);
    return {
      src,
      srcSet: "",
      sizes: options.sizes || "",
      originalUrl: src,
      displayUrl: src,
      width: 0,
      height: 0,
      aspectRatio: 0,
      blurDataUrl: "",
      placeholderUrl: "",
      processingStatus: "READY",
    };
  }

  const safeAsset = asset && typeof asset === "object" ? asset : {};
  const candidateKinds = Array.isArray(options.variantKinds)
    ? options.variantKinds
    : (options.prefer === "feed" ? ["thumb", "small"] : ["thumb", "small", "medium", "display"]);
  const candidates = uniqueCandidates(candidateKinds
    .map((kind) => ({
      kind,
      url: variantUrl(safeAsset, kind),
      width: variantWidth(safeAsset, kind),
      height: variantHeight(safeAsset, kind),
    }))
    .filter((candidate) => candidate.url));

  const displayUrl = variantUrl(safeAsset, "display")
    || variantUrl(safeAsset, "medium")
    || variantUrl(safeAsset, "small")
    || variantUrl(safeAsset, "thumb")
    || normalizeUrl(safeAsset.url);
  const preferredSrc = options.prefer === "feed"
    ? variantUrl(safeAsset, "thumb") || variantUrl(safeAsset, "small") || displayUrl
    : variantUrl(safeAsset, "medium") || displayUrl;
  const src = normalizeUrl(options.src || preferredSrc || displayUrl);
  const sortedCandidates = candidates.sort((a, b) => a.width - b.width);
  const srcSet = sortedCandidates
    .map((candidate) => candidate.url + " " + candidate.width + "w")
    .join(", ");
  const srcCandidate = sortedCandidates.find((candidate) => candidate.url === src)
    || sortedCandidates.find((candidate) => candidate.url === displayUrl)
    || sortedCandidates[sortedCandidates.length - 1]
    || null;
  const width = srcCandidate?.width || assetDimension(safeAsset, "width");
  const height = srcCandidate?.height || assetDimension(safeAsset, "height");
  const aspectRatio = width > 0 && height > 0 ? width / height : 0;

  return {
    src,
    srcSet,
    sizes: options.sizes || "",
    originalUrl: normalizeUrl(safeAsset.originalUrl) || variantUrl(safeAsset, "original"),
    displayUrl,
    width,
    height,
    aspectRatio,
    thumbUrl: variantUrl(safeAsset, "thumb"),
    smallUrl: variantUrl(safeAsset, "small"),
    mediumUrl: variantUrl(safeAsset, "medium"),
    blurDataUrl: normalizeUrl(safeAsset.blurDataUrl),
    placeholderUrl: normalizeUrl(safeAsset.placeholderUrl || safeAsset.blurDataUrl),
    processingStatus: String(safeAsset.processingStatus || "READY"),
  };
}

export function responsiveImageSourceUrl(source) {
  return source?.src || source?.displayUrl || "";
}

function shouldKeepResponsiveImageSource(source, options = {}) {
  if (source?.src || source?.displayUrl) {
    return true;
  }
  if (!options.keepNonReadySources) {
    return false;
  }
  return String(source?.processingStatus || "READY").toUpperCase() !== "READY";
}

export function buildResponsiveImageSources(assets, options = {}) {
  return (Array.isArray(assets) ? assets : [])
    .map((asset) => buildResponsiveImageSource(asset, options))
    .filter((source) => shouldKeepResponsiveImageSource(source, options));
}
