import { useEffect, useId, useMemo, useRef, useState } from "react";
import ResponsiveImage, {
  imageStateClassName,
} from "./ResponsiveImage";
import {
  buildRetryableImageSourceState,
  IMAGE_LOAD_FAILED_LABEL,
  IMAGE_RETRY_LABEL,
  IMAGE_UNAVAILABLE_LABEL,
} from "./imageRecovery";
import { resolveImageViewerIndex } from "./imageViewerPayload";

export function resolveMarkdownMediaViewerStartIndex({
  imageUrl,
  viewerImages = [],
  viewerStartIndex,
} = {}) {
  const safeViewerImages = Array.isArray(viewerImages) ? viewerImages : [];
  return resolveImageViewerIndex(safeViewerImages, imageUrl, viewerStartIndex);
}

export default function MarkdownMediaImage({
  imageUrl,
  imageSource,
  imageReady = true,
  statusLabel = "",
  parsedAlt,
  alt,
  hasCustomSize,
  hasCustomWidth,
  hasCustomHeight,
  frameStyle,
  imageStyle,
  openImageViewer,
  viewerImages = [],
  viewerOriginalImages = [],
  viewerImageSources = [],
  viewerStartIndex,
  loading = "lazy",
  fetchPriority,
  deferLoad = false,
  holdLoad = false,
  onLoadStateChange,
}) {
  const [failed, setFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const recoveryDescriptionId = `${useId()}-markdown-image-recovery`;
  const hasViewableImage = Boolean(imageReady && imageUrl);
  const [shouldRenderImage, setShouldRenderImage] = useState(hasViewableImage && !deferLoad && !holdLoad);
  const frameRef = useRef(null);
  const startIndex = hasViewableImage
    ? resolveMarkdownMediaViewerStartIndex({ imageUrl, viewerImages, viewerStartIndex })
    : 0;
  const imageViewerPayload = useMemo(
    () => ({
      startIndex,
      originalUrl: viewerOriginalImages[startIndex] || "",
      originalImages: viewerOriginalImages,
      imageSources: viewerImageSources,
    }),
    [startIndex, viewerImageSources, viewerOriginalImages],
  );

  useEffect(() => {
    if (!hasViewableImage) {
      setShouldRenderImage(false);
      onLoadStateChange?.({
        failed: false,
        loaded: false,
        unavailable: true,
        event: null,
      });
      return undefined;
    }
    if (holdLoad) {
      setShouldRenderImage(false);
      return undefined;
    }
    if (!deferLoad) {
      setShouldRenderImage(true);
      return undefined;
    }

    setShouldRenderImage(false);
    const frame = frameRef.current;
    if (!frame || typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setShouldRenderImage(true), 1200);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldRenderImage(true);
        observer.disconnect();
      }
    }, { rootMargin: "420px 0px", threshold: 0.01 });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [deferLoad, hasViewableImage, holdLoad, imageUrl]);

  const frameClassName = imageStateClassName(
    [
      "markdown-image-frame",
      hasCustomSize ? "is-custom-size" : "is-full-width",
      hasCustomWidth ? "has-custom-width" : "",
      hasCustomHeight ? "has-custom-height" : "",
      shouldRenderImage ? "" : "is-deferred",
      hasViewableImage ? "" : "is-status-placeholder",
    ].filter(Boolean).join(" "),
    "is-image-failed",
    failed,
  );
  const sourceWidth = Number(imageSource?.width || 0);
  const sourceHeight = Number(imageSource?.height || 0);
  const aspectRatio = sourceWidth > 0 && sourceHeight > 0
    ? sourceWidth + " / " + sourceHeight
    : "";
  const placeholderUrl = String(imageSource?.blurDataUrl || imageSource?.placeholderUrl || "");
  const deferredFrameStyle = !shouldRenderImage && aspectRatio
    ? { ...frameStyle, aspectRatio }
    : frameStyle;
  const deferredPlaceholderStyle = {
    ...(aspectRatio ? { aspectRatio } : { minHeight: "180px" }),
    ...(placeholderUrl ? { backgroundImage: "url(" + JSON.stringify(placeholderUrl) + ")" } : null),
  };
  const { retryImageUrl, retryImageSource } = buildRetryableImageSourceState({
    imageUrl,
    imageSource,
    retryToken,
  });

  function retryImageLoad(event) {
    event.stopPropagation();
    setFailed(false);
    setShouldRenderImage(true);
    setRetryToken((value) => value + 1);
  }

  return (
    <span ref={frameRef} className={frameClassName} style={deferredFrameStyle}>
      {shouldRenderImage ? (
        <ResponsiveImage
          key={`${imageUrl}:${retryToken}`}
          className="markdown-inline-image"
          src={retryImageUrl}
          source={retryImageSource}
          alt={parsedAlt.alt || alt || ""}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          style={imageStyle}
          onLoadStateChange={(nextState) => {
            setFailed(nextState.failed);
            onLoadStateChange?.(nextState);
          }}
          onClick={() => {
            if (typeof openImageViewer === "function" && !failed) {
              openImageViewer(imageUrl, viewerImages, imageViewerPayload);
            }
          }}
        />
      ) : hasViewableImage ? (
        <span
          className="markdown-image-deferred-placeholder"
          style={deferredPlaceholderStyle}
          aria-hidden="true"
        />
      ) : (
        <span className="markdown-image-status-placeholder" role="status">
          {statusLabel || IMAGE_UNAVAILABLE_LABEL}
        </span>
      )}
      {shouldRenderImage && failed && (
        <span className="markdown-image-fallback" role="alert" aria-live="assertive">
          <span id={recoveryDescriptionId} className="markdown-image-failure-label">{IMAGE_LOAD_FAILED_LABEL}</span>
          <button
            type="button"
            className="markdown-image-retry"
            onClick={retryImageLoad}
            aria-describedby={recoveryDescriptionId}
          >
            {IMAGE_RETRY_LABEL}
          </button>
        </span>
      )}
    </span>
  );
}
