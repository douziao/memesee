import { useEffect, useId, useMemo, useRef, useState } from "react";
import UiIcon from "../../../../shared/components/UiIcon";
import ResponsiveImage, {
  canPrefetchImages,
} from "../../../../shared/media/ResponsiveImage";
import {
  buildImageFailureRecoveryState,
  buildRetryableImageSourceState,
  incrementImageRetryTokenMap,
  updateImageFlagMap,
} from "../../../../shared/media/imageRecovery";
import { buildImageViewerPayloadFromEntries } from "../../../../shared/media/imageViewerPayload";

function toPositiveNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function readSourceSize(source) {
  const width = toPositiveNumber(source?.width);
  const height = toPositiveNumber(source?.height);
  return width > 0 && height > 0 ? { width, height } : null;
}

function readProcessingStatus(source) {
  return String(source?.processingStatus || "READY").toUpperCase();
}

export function isRichGalleryImageReady(source) {
  return readProcessingStatus(source) === "READY";
}

function normalizeRichGalleryUrl(value) {
  return typeof value === "string" ? value.trim() : "";
}

function richGalleryImageUrl(source) {
  return isRichGalleryImageReady(source)
    ? normalizeRichGalleryUrl(source?.src) || normalizeRichGalleryUrl(source?.displayUrl)
    : "";
}

const MIN_GALLERY_HIT_SIDE = 96;

export function calculateRichGalleryRenderSize({
  naturalSize,
  frameSize,
  minHitSide = MIN_GALLERY_HIT_SIDE,
}) {
  if (!naturalSize || !frameSize || frameSize.width <= 0 || frameSize.height <= 0) {
    return null;
  }
  const naturalWidth = toPositiveNumber(naturalSize.width);
  const naturalHeight = toPositiveNumber(naturalSize.height);
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return null;
  }

  const scale = Math.min(
    frameSize.width / naturalWidth,
    frameSize.height / naturalHeight,
  );
  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }

  const imageWidth = Math.max(1, Math.floor(naturalWidth * scale));
  const imageHeight = Math.max(1, Math.floor(naturalHeight * scale));
  const minimumSide = Math.max(1, Number(minHitSide || 0));
  const width = Math.min(frameSize.width, Math.max(imageWidth, minimumSide));
  const height = Math.min(frameSize.height, Math.max(imageHeight, minimumSide));

  return {
    width,
    height,
    imageWidth,
    imageHeight,
    hasPaddedHitArea: width !== imageWidth || height !== imageHeight,
  };
}

export function buildRichGalleryViewerPayload({
  imageSources = [],
  richOriginalImages = [],
  currentIndex = 0,
}) {
  const entries = (Array.isArray(imageSources) ? imageSources : [])
    .map((source, sourceIndex) => {
      const safeSource = source || {};
      return {
        imageUrl: richGalleryImageUrl(safeSource),
        imageSource: safeSource,
        originalUrl: safeSource.originalUrl || richOriginalImages[sourceIndex] || "",
        sourceIndex,
      };
    });

  return buildImageViewerPayloadFromEntries({
    entries,
    currentSourceIndex: currentIndex,
  });
}

export function canOpenRichGalleryViewer({
  currentImage,
  imageFailed = false,
  viewerPayload,
}) {
  return Boolean(currentImage && !imageFailed && Number(viewerPayload?.startIndex) >= 0);
}

export function buildRichGalleryImageFailureState({
  currentImage,
  imageFailed = false,
  hasMultipleImages = false,
} = {}) {
  return buildImageFailureRecoveryState({
    imageUrl: currentImage,
    imageFailed,
    hasAlternativeImages: hasMultipleImages,
  });
}

export function clampRichGalleryIndex(index, imageCount) {
  const count = Number(imageCount || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  const rawIndex = Number(index || 0);
  const safeIndex = Number.isFinite(rawIndex) ? Math.trunc(rawIndex) : 0;
  return Math.min(Math.max(safeIndex, 0), count - 1);
}

export function buildRichGalleryAdjacentPrefetchCandidates({
  displayImages = [],
  currentIndex = 0,
  currentImage = "",
  loadedImageMap = {},
  failedImageMap = {},
} = {}) {
  if (!Array.isArray(displayImages) || displayImages.length === 0) {
    return [];
  }

  const safeIndex = clampRichGalleryIndex(currentIndex, displayImages.length);
  const normalizedCurrentImage = String(currentImage || "").trim();
  const candidates = [
    displayImages[safeIndex - 1],
    displayImages[safeIndex + 1],
  ];
  const seen = new Set();

  return candidates
    .map((imageUrl) => String(imageUrl || "").trim())
    .filter((imageUrl) => {
      if (!imageUrl || imageUrl === normalizedCurrentImage || seen.has(imageUrl)) {
        return false;
      }
      seen.add(imageUrl);
      return !loadedImageMap?.[imageUrl] && !failedImageMap?.[imageUrl];
    });
}

function normalizeRichGallerySource(source, sourceIndex, richOriginalImages = []) {
  if (typeof source === "string") {
    const src = normalizeRichGalleryUrl(source);
    if (!src) {
      return null;
    }
    const originalUrl = normalizeRichGalleryUrl(richOriginalImages[sourceIndex]) || src;
    return {
      src,
      displayUrl: src,
      originalUrl,
    };
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const normalizedSource = { ...source };
  const src = normalizeRichGalleryUrl(source.src);
  const displayUrl = normalizeRichGalleryUrl(source.displayUrl);
  const originalUrl = normalizeRichGalleryUrl(source.originalUrl)
    || normalizeRichGalleryUrl(richOriginalImages[sourceIndex]);
  const processingStatus = readProcessingStatus(source);
  const isPlaceholderSource = processingStatus !== "READY";

  if (!src && !displayUrl && !isPlaceholderSource) {
    return null;
  }

  if (src) {
    normalizedSource.src = src;
  } else {
    delete normalizedSource.src;
  }
  if (displayUrl) {
    normalizedSource.displayUrl = displayUrl;
  } else {
    delete normalizedSource.displayUrl;
  }
  if (originalUrl) {
    normalizedSource.originalUrl = originalUrl;
  } else {
    delete normalizedSource.originalUrl;
  }

  return normalizedSource;
}

export function buildRichGalleryImageSources({
  richDetailImages = [],
  richOriginalImages = [],
  richImageSources = [],
} = {}) {
  const rawSources = Array.isArray(richImageSources) && richImageSources.length > 0
    ? richImageSources
    : (Array.isArray(richDetailImages) ? richDetailImages : []);

  return rawSources
    .map((source, sourceIndex) =>
      normalizeRichGallerySource(source, sourceIndex, richOriginalImages),
    )
    .filter(Boolean)
    .map((source, imageIndex) => ({
      ...source,
      loadingPriority: imageIndex === 0 ? "eager" : "lazy",
      fetchPriority: imageIndex === 0 ? "high" : "low",
    }));
}

export default function RichGallery({
  richDetailImages = [],
  richOriginalImages = [],
  richImageSources = [],
  detailMediaIndex,
  setDetailMediaIndex,
  openImageViewer,
}) {
  const imageSources = useMemo(() => buildRichGalleryImageSources({
    richDetailImages,
    richOriginalImages,
    richImageSources,
  }), [richDetailImages, richImageSources, richOriginalImages]);
  const displayImages = useMemo(
    () => imageSources
      .map((source) => richGalleryImageUrl(source))
      .map((imageUrl) => imageUrl || ""),
    [imageSources],
  );
  const hasMultipleImages = imageSources.length > 1;
  const currentMediaIndex = clampRichGalleryIndex(detailMediaIndex, imageSources.length);
  const currentImageSource = imageSources[currentMediaIndex] || {};
  const currentLoading = currentImageSource.loadingPriority || (currentMediaIndex === 0 ? "eager" : "lazy");
  const currentFetchPriority = currentImageSource.fetchPriority || (currentMediaIndex === 0 ? "high" : "low");
  const currentImage = richGalleryImageUrl(currentImageSource) || displayImages[currentMediaIndex];
  const currentProcessingStatus = readProcessingStatus(currentImageSource);
  const viewerPayload = useMemo(() => buildRichGalleryViewerPayload({
    imageSources,
    richOriginalImages,
    currentIndex: currentMediaIndex,
  }), [currentMediaIndex, imageSources, richOriginalImages]);
  const currentOriginalImage = currentImageSource.originalUrl
    || richOriginalImages[currentMediaIndex]
    || viewerPayload.originalUrl
    || "";
  const frameRef = useRef(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [naturalSizeMap, setNaturalSizeMap] = useState({});
  const [failedImageMap, setFailedImageMap] = useState({});
  const [loadedImageMap, setLoadedImageMap] = useState({});
  const [retryTokenMap, setRetryTokenMap] = useState({});
  const recoveryDescriptionId = `${useId()}-rich-gallery-image-recovery`;
  const imageFailed = Boolean(currentImage && failedImageMap[currentImage]);
  const currentRetryToken = currentImage ? retryTokenMap[currentImage] || 0 : 0;
  const {
    retryImageUrl: currentRetryImage,
    retryImageSource: currentRetryImageSource,
  } = buildRetryableImageSourceState({
    imageUrl: currentImage,
    imageSource: currentImageSource,
    retryToken: currentRetryToken,
  });
  const imageFailureState = buildRichGalleryImageFailureState({
    currentImage,
    imageFailed,
    hasMultipleImages,
  });
  const canOpenCurrentImage = canOpenRichGalleryViewer({
    currentImage,
    imageFailed,
    viewerPayload,
  });
  const currentImageButtonLabel = canOpenCurrentImage
    ? `View image ${currentMediaIndex + 1}`
    : `Image ${currentMediaIndex + 1} is not available for preview`;
  const currentStatusLabel = currentProcessingStatus === "PROCESSING"
    ? "图片处理中"
    : (currentProcessingStatus === "FAILED" ? "处理失败" : "");
  const currentPlaceholderLabel = currentStatusLabel || "图片暂不可用";
  const currentStatusClass = currentProcessingStatus.toLowerCase();

  function updateMediaIndex(nextIndex) {
    if (typeof setDetailMediaIndex === "function") {
      setDetailMediaIndex(clampRichGalleryIndex(nextIndex, imageSources.length));
    }
  }

  useEffect(() => {
    if (detailMediaIndex !== currentMediaIndex) {
      updateMediaIndex(currentMediaIndex);
    }
  }, [currentMediaIndex, detailMediaIndex]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    const updateFrameSize = () => {
      const rect = frame.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.floor(rect.width));
      const nextHeight = Math.max(0, Math.floor(rect.height));
      setFrameSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      );
    };
    updateFrameSize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateFrameSize);
      observer.observe(frame);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", updateFrameSize);
    return () => window.removeEventListener("resize", updateFrameSize);
  }, []);

  useEffect(() => {
    if (!currentImage || !loadedImageMap[currentImage] || !canPrefetchImages()) {
      return undefined;
    }
    const candidates = buildRichGalleryAdjacentPrefetchCandidates({
      displayImages,
      currentIndex: currentMediaIndex,
      currentImage,
      loadedImageMap,
      failedImageMap,
    });
    if (candidates.length === 0) {
      return undefined;
    }
    const prefetchAdjacentImages = () => {
      candidates.forEach((imageUrl) => {
        const image = new Image();
        image.decoding = "async";
        if ("fetchPriority" in image) {
          image.fetchPriority = "low";
        }
        image.src = imageUrl;
      });
    };
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetchAdjacentImages, { timeout: 1200 });
      return () => window.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(prefetchAdjacentImages, 900);
    return () => window.clearTimeout(timer);
  }, [currentImage, currentMediaIndex, displayImages, failedImageMap, loadedImageMap]);

  const metadataSize = readSourceSize(currentImageSource) || { width: 16, height: 9 };
  const naturalSize = currentImage ? naturalSizeMap[currentImage] || metadataSize : null;
  const renderSize = useMemo(() => calculateRichGalleryRenderSize({
    naturalSize,
    frameSize,
  }), [frameSize, naturalSize]);
  const placeholderSize = !currentImage ? calculateRichGalleryRenderSize({
    naturalSize: metadataSize,
    frameSize,
  }) : null;
  const effectiveRenderSize = renderSize || placeholderSize;

  function setCurrentImageFailed(failed) {
    if (!currentImage) {
      return;
    }
    setFailedImageMap((prev) => updateImageFlagMap(prev, currentImage, failed));
  }

  function onImageLoad(event) {
    setCurrentImageFailed(false);
    setLoadedImageMap((prev) => updateImageFlagMap(prev, currentImage, true));
    const image = event.currentTarget;
    if (!currentImage || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return;
    }
    setNaturalSizeMap((prev) => {
      const existing = prev[currentImage];
      if (
        existing &&
        existing.width === image.naturalWidth &&
        existing.height === image.naturalHeight
      ) {
        return prev;
      }
      return {
        ...prev,
        [currentImage]: {
          width: image.naturalWidth,
          height: image.naturalHeight,
        },
      };
    });
  }

  function retryCurrentImage(event) {
    event.stopPropagation();
    if (!currentImage) {
      return;
    }
    setCurrentImageFailed(false);
    setRetryTokenMap((prev) => incrementImageRetryTokenMap(prev, currentImage));
  }

  return (
    <div className="post-rich-gallery">
      <div className="post-rich-gallery-stage">
        <div
          ref={frameRef}
          className="post-rich-gallery-frame"
        >
          <button
            type="button"
            className={[
              "post-rich-gallery-image-shell",
              effectiveRenderSize ? "" : "is-sizing",
              effectiveRenderSize?.hasPaddedHitArea ? "has-padded-hit-area" : "",
              currentImage ? "" : "is-status-placeholder",
              imageFailed ? "is-image-failed" : "",
              canOpenCurrentImage ? "" : "is-not-viewable",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              effectiveRenderSize
                ? {
                    width: String(effectiveRenderSize.width) + "px",
                    height: String(effectiveRenderSize.height) + "px",
                  }
                : undefined
            }
            onClick={() => {
              if (effectiveRenderSize && canOpenCurrentImage) {
                openImageViewer(currentImage, viewerPayload.images, {
                  startIndex: Math.max(0, viewerPayload.startIndex),
                  originalUrl: currentOriginalImage,
                  originalImages: viewerPayload.originalImages,
                  imageSources: viewerPayload.imageSources,
                });
              }
            }}
            disabled={!canOpenCurrentImage}
            aria-label={currentImageButtonLabel}
          >
            {currentImage ? (
              <ResponsiveImage
                key={`${currentImage}:${currentRetryToken}`}
                className="post-rich-gallery-image"
                src={currentRetryImage}
                source={currentRetryImageSource}
                alt={`Rich media ${currentMediaIndex + 1}`}
                loading={currentLoading}
                decoding="async"
                fetchPriority={currentFetchPriority}
                onLoad={onImageLoad}
                onLoadStateChange={({ failed: nextFailed, loaded: nextLoaded }) => {
                  setFailedImageMap((prev) => updateImageFlagMap(prev, currentImage, nextFailed));
                  if (nextLoaded) {
                    setLoadedImageMap((prev) => updateImageFlagMap(prev, currentImage, true));
                  }
                }}
              />
            ) : (
              <span className="post-rich-gallery-image-placeholder" role="status">
                {currentPlaceholderLabel}
              </span>
            )}
          </button>
          {imageFailureState.show && (
            <span className="post-rich-gallery-image-fallback" role="alert" aria-live="assertive">
              <span id={recoveryDescriptionId} className="post-rich-gallery-image-failure-label">
                {imageFailureState.message}
              </span>
              <span className="post-rich-gallery-image-failure-hint">
                {imageFailureState.hint}
              </span>
              <button
                type="button"
                className="post-rich-gallery-image-retry"
                onClick={retryCurrentImage}
                aria-describedby={recoveryDescriptionId}
              >
                {imageFailureState.retryLabel}
              </button>
            </span>
          )}
          {currentStatusLabel && (
            <span className={`post-rich-gallery-status is-${currentStatusClass}`}>
              {currentStatusLabel}
            </span>
          )}
        </div>

        {hasMultipleImages && (
          <div className="post-rich-gallery-controls" aria-label="Switch image">
            <button
              type="button"
              className="post-rich-gallery-nav"
              onClick={() => updateMediaIndex(currentMediaIndex - 1)}
              disabled={currentMediaIndex <= 0}
              aria-label="Previous image"
            >
              <UiIcon name="chevron-left" />
            </button>

            <div className="post-rich-gallery-index">
              <span className="post-rich-gallery-count" aria-live="polite">
                {currentMediaIndex + 1} / {displayImages.length}
              </span>
              <input
                type="range"
                className="post-rich-gallery-range"
                min="0"
                max={displayImages.length - 1}
                value={currentMediaIndex}
                onChange={(event) => updateMediaIndex(Number(event.target.value))}
                aria-label="切换图片"
              />
            </div>

            <button
              type="button"
              className="post-rich-gallery-nav"
              onClick={() =>
                updateMediaIndex(currentMediaIndex + 1)
              }
              disabled={currentMediaIndex >= displayImages.length - 1}
              aria-label="Next image"
            >
              <UiIcon name="chevron-right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
