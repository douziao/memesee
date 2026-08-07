import {
  buildResponsiveImageSources,
  DETAIL_IMAGE_SIZES,
  FEED_IMAGE_SIZES,
} from "./responsiveImages";

export function normalizeAssetUrl(pathOrUrl, apiBase = "") {
  if (!pathOrUrl) {
    return "";
  }
  const normalizedRaw = pathOrUrl.trim();
  if (/^https?:\/\//i.test(normalizedRaw)) {
    try {
      const parsed = new URL(normalizedRaw);
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1"
      ) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // keep original value on parse failure
    }
    return normalizedRaw;
  }
  const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const path = normalizedRaw.startsWith("/") ? normalizedRaw : `/${normalizedRaw}`;
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}

export function buildMediaAssetMap(mediaAssets) {
  const map = new Map();
  for (const asset of Array.isArray(mediaAssets) ? mediaAssets : []) {
    const assetId = Number(asset?.id || 0);
    const publicId = String(asset?.publicId || "").trim();
    if (assetId > 0) {
      map.set(String(assetId), asset);
      map.set(assetId, asset);
    }
    if (publicId) {
      map.set(publicId, asset);
    }
  }
  return map;
}

export function resolveMediaAssetImageUrl(asset) {
  if (!asset) {
    return "";
  }
  return asset.displayUrl || asset.mediumUrl || asset.smallUrl || asset.url || asset.originalUrl || "";
}

export function normalizePostMediaAssets(mediaAssets, apiBase = "") {
  return Array.isArray(mediaAssets)
    ? mediaAssets.map((asset) => {
        const safeAsset = asset && typeof asset === "object" ? asset : {};
        const variants = Array.isArray(safeAsset.variants) ? safeAsset.variants : [];
        const originalVariant = variants.find((variant) =>
          String(variant?.kind || "").toLowerCase() === "original",
        );
        const rawUrl = safeAsset.url || safeAsset.displayUrl || "";
        const displayUrl = normalizeAssetUrl(safeAsset.displayUrl || rawUrl, apiBase);
        const mediumUrl = normalizeAssetUrl(safeAsset.mediumUrl || displayUrl || rawUrl, apiBase);
        const smallUrl = normalizeAssetUrl(safeAsset.smallUrl || mediumUrl || displayUrl || rawUrl, apiBase);
        const thumbUrl = normalizeAssetUrl(safeAsset.thumbUrl || smallUrl || displayUrl || rawUrl, apiBase);
        const originalUrl = normalizeAssetUrl(safeAsset.originalUrl || originalVariant?.url || "", apiBase);
        return {
          ...safeAsset,
          url: displayUrl || normalizeAssetUrl(rawUrl, apiBase),
          thumbUrl,
          smallUrl,
          mediumUrl,
          displayUrl,
          originalUrl,
          blurDataUrl: String(safeAsset.blurDataUrl || ""),
          placeholderUrl: String(safeAsset.placeholderUrl || safeAsset.blurDataUrl || ""),
          processingStatus: String(safeAsset.processingStatus || "READY"),
        };
      })
    : [];
}

export function buildPostMediaImageSources(mediaAssets) {
  return buildResponsiveImageSources(mediaAssets, {
    keepNonReadySources: true,
    prefer: "detail",
    sizes: DETAIL_IMAGE_SIZES,
  });
}

export function buildPostPreviewImageSources(mediaAssets) {
  const previewAssets = Array.isArray(mediaAssets) ? mediaAssets.slice(0, 3) : [];
  return buildResponsiveImageSources(previewAssets, {
    prefer: "feed",
    sizes: FEED_IMAGE_SIZES,
  });
}
