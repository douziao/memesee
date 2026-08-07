import { normalizeAssetUrl } from "../../shared/media/mediaAssetHelpers";
import {
  alignImageViewerSources,
  comparableImageKey,
  dedupeImageViewerImages,
  normalizeImageViewerList,
  normalizeImageViewerSources,
  resolveImageViewerIndex,
} from "../../shared/media/imageViewerPayload";

export {
  alignImageViewerSources,
  comparableImageKey,
  dedupeImageViewerImages,
  normalizeImageViewerList,
  normalizeImageViewerSources,
  resolveImageViewerIndex,
};

export function buildImageViewerState({
  url,
  sourceImages = [],
  options = {},
  apiBase = "",
  origin = "",
}) {
  const normalized = normalizeAssetUrl(url || "", apiBase);
  if (!normalized) {
    return null;
  }
  const imageSources = normalizeImageViewerSources(options.imageSources, apiBase);
  const gallery = normalizeImageViewerList(sourceImages, apiBase);
  const sourceGallery = imageSources
    .map((source) => source.src || source.displayUrl)
    .filter(Boolean);
  const comparisonOptions = { apiBase, origin };
  const rawImages = gallery.length > 0 ? gallery : (sourceGallery.length > 0 ? sourceGallery : [normalized]);
  const rawIndex = resolveImageViewerIndex(rawImages, normalized, options.startIndex, comparisonOptions);
  const imageEntries = dedupeImageViewerImages(rawImages, {
    ...comparisonOptions,
    targetUrl: normalized,
    preferredIndex: rawIndex,
  });
  const images = imageEntries.map((entry) => entry.image);
  const index = resolveImageViewerIndex(images, normalized, options.startIndex, comparisonOptions);
  const alignedImageSources = alignImageViewerSources(images, imageSources, comparisonOptions);
  const normalizedOriginalImages = normalizeImageViewerList(options.originalImages, apiBase, { keepEmpty: true });
  const normalizedOriginalUrl = normalizeAssetUrl(options.originalUrl || "", apiBase);
  const sourceOriginalImages = alignedImageSources.map((source) => source.originalUrl || "");
  const originalImages = imageEntries.map((entry, imageIndex) => (
    normalizedOriginalImages[entry.sourceIndex]
    || sourceOriginalImages[imageIndex]
    || (imageIndex === index && normalizedOriginalUrl ? normalizedOriginalUrl : "")
    || ""
  ));
  return { images, index, originalImages, imageSources: alignedImageSources };
}
