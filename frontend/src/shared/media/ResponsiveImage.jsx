import { useEffect, useRef, useState } from "react";
import { responsiveImageSourceUrl } from "./responsiveImages";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function normalizeImageUrl(value) {
  return String(value || "").trim();
}

function responsiveImagePlaceholderUrl(source, imageUrl) {
  const placeholderUrl = normalizeImageUrl(source?.blurDataUrl)
    || normalizeImageUrl(source?.placeholderUrl);
  return placeholderUrl && (
    placeholderUrl !== normalizeImageUrl(imageUrl) || normalizeImageUrl(source?.srcSet)
  )
    ? placeholderUrl
    : "";
}

export function imageStateClassName(baseClassName, failedClassName, failed) {
  return [baseClassName, failed ? failedClassName : ""]
    .filter(Boolean)
    .join(" ");
}

export function canPrefetchImages() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) {
    return true;
  }
  if (connection.saveData) {
    return false;
  }
  return !/(^|-)2g$/i.test(String(connection.effectiveType || ""));
}

export function responsiveImageLoadStateKey(nextState = {}) {
  if (nextState.unavailable) {
    return 4;
  }
  return +nextState.failed | +nextState.loaded << 1;
}

export default function ResponsiveImage({
  source = {},
  src,
  alt = "",
  className = "",
  wrapperClassName = "",
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  style,
  onLoad,
  onError,
  onLoadStateChange,
  placeholder = "blur",
  ...imageProps
}) {
  const safeSource = source && typeof source === "object" ? source : {};
  const imageUrl = src || responsiveImageSourceUrl(safeSource);
  const placeholderUrl = placeholder === "blur"
    ? responsiveImagePlaceholderUrl(safeSource, imageUrl)
    : "";
  const hasPlaceholder = Boolean(placeholderUrl);
  const placeholderStyle = hasPlaceholder
    ? { backgroundImage: `url(${JSON.stringify(placeholderUrl)})` }
    : undefined;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef(null);
  const loadStateKeyRef = useRef(-1);
  const onLoadStateChangeRef = useRef(onLoadStateChange);
  onLoadStateChangeRef.current = onLoadStateChange;

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    loadStateKeyRef.current = -1;

    if (!imageUrl) {
      notifyLoadState({ failed: false, loaded: false, unavailable: true }, null);
      return;
    }

    const image = imageRef.current;
    if (!image || !imageUrl || !image.complete) {
      notifyLoadState({ failed: false, loaded: false, unavailable: false }, null);
      return;
    }
    if (image.naturalWidth > 0) {
      notifyLoadState({ failed: false, loaded: true }, null);
      return;
    }
    notifyLoadState({ failed: true, loaded: false }, null);
  }, [imageUrl, safeSource.srcSet]);

  function notifyLoadState(nextState, event) {
    const nextLoadStateKey = responsiveImageLoadStateKey(nextState);
    const shouldNotify = loadStateKeyRef.current !== nextLoadStateKey;
    loadStateKeyRef.current = nextLoadStateKey;
    setFailed(nextState.failed);
    setLoaded(nextState.loaded);
    if (shouldNotify && typeof onLoadStateChangeRef.current === "function") {
      onLoadStateChangeRef.current({
        failed: false,
        loaded: false,
        unavailable: false,
        ...nextState,
        event,
      });
    }
  }

  function handleLoad(event) {
    notifyLoadState({ failed: false, loaded: true }, event);
    if (typeof onLoad === "function") {
      onLoad(event);
    }
  }

  function handleError(event) {
    notifyLoadState({ failed: true, loaded: false }, event);
    if (typeof onError === "function") {
      onError(event);
    }
  }

  const unavailable = !imageUrl;
  const imageState = unavailable ? "unavailable" : (failed ? "failed" : (loaded ? "loaded" : "loading"));

  return (
    <span
      className={classNames(
        "responsive-image-shell",
        hasPlaceholder ? "has-blur-placeholder" : "",
        loaded ? "is-loaded" : "",
        failed ? "is-failed" : "",
        unavailable ? "is-unavailable" : "",
        wrapperClassName,
      )}
      data-responsive-image-state={imageState}
    >
      {hasPlaceholder && (
        <span
          className="responsive-image-placeholder"
          style={placeholderStyle}
          aria-hidden="true"
        />
      )}
      {imageUrl && (
        <img
          {...imageProps}
          ref={imageRef}
          className={classNames("responsive-image-img", className)}
          src={imageUrl}
          srcSet={safeSource.srcSet || undefined}
          sizes={safeSource.sizes || undefined}
          width={safeSource.width || undefined}
          height={safeSource.height || undefined}
          alt={alt}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          style={style}
          data-image-state={imageState}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </span>
  );
}
