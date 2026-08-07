import {
  buildMediaAssetMap,
  normalizeAssetUrl,
  resolveMediaAssetImageUrl,
} from "./mediaAssetHelpers";
import {
  normalizeMarkdownImageSize,
  parseMarkdownImageAlt,
  parseMediaReference,
} from "./markdownContent";
import {
  buildResponsiveImageSource,
  DETAIL_IMAGE_SIZES,
  responsiveImageSourceUrl,
} from "./responsiveImages";

function normalizeAspectRatioValue(width, height) {
  const sourceWidth = Number.parseFloat(width || 0);
  const sourceHeight = Number.parseFloat(height || 0);
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)) {
    return "";
  }
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return "";
  }
  return `${sourceWidth} / ${sourceHeight}`;
}

export function buildMarkdownImageStyles({ width, height, imageSource }) {
  const aspectRatio = normalizeAspectRatioValue(
    width || imageSource?.width,
    height || imageSource?.height,
  );

  if (!width && !height && !aspectRatio) {
    return {
      frameStyle: undefined,
      imageStyle: undefined,
    };
  }

  const frameStyle = {
    ...(width ? { width, maxWidth: "100%" } : null),
    ...(aspectRatio ? { aspectRatio } : null),
  };
  const imageStyle = {
    ...(width ? { width: "100%", maxWidth: "100%" } : null),
    ...(height ? { height: "auto", maxHeight: height } : null),
  };

  return {
    frameStyle,
    imageStyle,
  };
}

export function buildMarkdownImageSource(asset) {
  return buildResponsiveImageSource(asset, {
    prefer: "detail",
    sizes: DETAIL_IMAGE_SIZES,
  });
}

export function isMarkdownImageSourceReady(imageSource) {
  return String(imageSource?.processingStatus || "READY").toUpperCase() === "READY";
}

export function markdownImageStatusLabel(imageSource) {
  const processingStatus = String(imageSource?.processingStatus || "READY").toUpperCase();
  if (processingStatus === "PROCESSING") {
    return "图片处理中";
  }
  if (processingStatus === "FAILED") {
    return "处理失败";
  }
  return "";
}

export function resolveMarkdownMediaAsset(mediaAssetMap, mediaReference) {
  if (!mediaReference) {
    return null;
  }
  return mediaAssetMap.get(mediaReference.ref) || mediaAssetMap.get(mediaReference.assetId) || null;
}

function buildMissingMarkdownImageData({ alt }) {
  const parsedAlt = parseMarkdownImageAlt(alt);
  return {
    imageUrl: "",
    imageSource: {
      processingStatus: "MISSING",
      width: 0,
      height: 0,
    },
    imageReady: false,
    statusLabel: "图片已不在当前草稿中",
    parsedAlt,
    alt,
    hasCustomSize: false,
    hasCustomWidth: false,
    hasCustomHeight: false,
    frameStyle: undefined,
    imageStyle: undefined,
  };
}

export function resolveMarkdownImageData({ src, alt, mediaAssetMap, apiBase = "" }) {
  const mediaReference = parseMediaReference(src || "");
  if (!mediaReference) {
    return null;
  }
  const asset = resolveMarkdownMediaAsset(mediaAssetMap, mediaReference);
  if (!asset) {
    return buildMissingMarkdownImageData({ alt });
  }
  const imageSource = buildMarkdownImageSource(asset);
  const imageReady = isMarkdownImageSourceReady(imageSource);
  const imageUrl = normalizeAssetUrl(
    imageReady ? responsiveImageSourceUrl(imageSource) || resolveMediaAssetImageUrl(asset) : "",
    apiBase,
  );
  if (!imageUrl && imageReady) {
    return null;
  }
  const parsedAlt = parseMarkdownImageAlt(alt);
  const width = normalizeMarkdownImageSize(mediaReference.width || parsedAlt.width);
  const height = normalizeMarkdownImageSize(mediaReference.height || parsedAlt.height);
  const { frameStyle, imageStyle } = buildMarkdownImageStyles({
    width,
    height,
    imageSource,
  });
  return {
    imageUrl,
    imageSource,
    imageReady,
    statusLabel: markdownImageStatusLabel(imageSource),
    parsedAlt,
    alt,
    hasCustomSize: Boolean(width || height),
    hasCustomWidth: Boolean(width),
    hasCustomHeight: Boolean(height),
    frameStyle,
    imageStyle,
  };
}

export function getMarkdownImageOccurrenceIndex({ content, src }) {
  const target = String(src || "").trim();
  if (!target) {
    return -1;
  }
  const markdownRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let index = 0;
  let match;
  while ((match = markdownRegex.exec(String(content || ""))) !== null) {
    if (String(match[1] || "").trim() === target) {
      return index;
    }
    index += 1;
  }
  return -1;
}

export function buildMarkdownImageGallery({ content, mediaAssetMap, apiBase = "" }) {
  const entries = [];
  const sourceOccurrences = new Map();
  const markdownRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let markdownIndex = 0;
  let match;
  while ((match = markdownRegex.exec(String(content || ""))) !== null) {
    const sourceSrc = String(match[1] || "").trim();
    const sourceOccurrenceIndex = sourceOccurrences.get(sourceSrc) || 0;
    sourceOccurrences.set(sourceSrc, sourceOccurrenceIndex + 1);
    const imageData = resolveMarkdownImageData({
      src: sourceSrc,
      alt: "",
      mediaAssetMap,
      apiBase,
    });
    if (!imageData?.imageUrl) {
      markdownIndex += 1;
      continue;
    }
    entries.push({
      imageUrl: imageData.imageUrl,
      originalUrl: normalizeAssetUrl(
        imageData.imageSource.originalUrl || imageData.imageSource.displayUrl || imageData.imageUrl,
        apiBase,
      ),
      imageSource: imageData.imageSource,
      sourceSrc,
      sourceOccurrenceIndex,
      markdownIndex,
    });
    markdownIndex += 1;
  }
  return entries;
}

export function findMarkdownImageGalleryStartIndex({
  gallery = [],
  src = "",
  imageUrl = "",
  sourceOccurrenceIndex = 0,
} = {}) {
  if (!Array.isArray(gallery) || gallery.length === 0) {
    return -1;
  }
  const normalizedSrc = String(src || "").trim();
  const normalizedImageUrl = String(imageUrl || "").trim();
  const rawOccurrence = Number(sourceOccurrenceIndex || 0);
  const occurrence = Number.isFinite(rawOccurrence)
    ? Math.max(0, Math.trunc(rawOccurrence))
    : 0;
  const exactIndex = gallery.findIndex((entry) =>
    String(entry?.sourceSrc || "").trim() === normalizedSrc &&
    Number(entry?.sourceOccurrenceIndex || 0) === occurrence &&
    String(entry?.imageUrl || "").trim() === normalizedImageUrl,
  );
  if (exactIndex >= 0) {
    return exactIndex;
  }
  return gallery.findIndex((entry) =>
    String(entry?.imageUrl || "").trim() === normalizedImageUrl,
  );
}

export function buildMarkdownMediaAssetMap(mediaAssets) {
  return buildMediaAssetMap(mediaAssets);
}
