import { useEffect, useId, useMemo, useRef, useState } from "react";
import UiIcon from "../UiIcon";
import {
  buildImageFailureRecoveryState,
  buildImageRetryUrl,
  incrementImageRetryTokenMap,
  updateImageFlagMap,
} from "../../media/imageRecovery";
import "./ImageLightbox.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

function clampNumber(value, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
}

export function clampLightboxIndex(index, imageCount) {
  const count = Number(imageCount || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  const number = Number(index || 0);
  const safeIndex = Number.isFinite(number) ? Math.trunc(number) : 0;
  return clampNumber(safeIndex, 0, count - 1);
}

export function resolveLightboxNavigation(currentIndex, imageCount, delta) {
  const current = clampLightboxIndex(currentIndex, imageCount);
  const next = clampLightboxIndex(current + Number(delta || 0), imageCount);
  return {
    index: next,
    changed: next !== current,
  };
}

export function callLightboxClose(onClose) {
  if (typeof onClose === "function") {
    onClose();
    return true;
  }
  return false;
}

export function resolveLightboxKeyAction(key) {
  switch (key) {
    case "Escape":
      return "close";
    case "ArrowLeft":
      return "previous";
    case "ArrowRight":
      return "next";
    case "+":
    case "=":
      return "zoom-in";
    case "-":
    case "_":
      return "zoom-out";
    case "0":
      return "reset";
    default:
      return "";
  }
}

export function buildLightboxImageFailureState({
  currentUrl,
  imageFailed,
  canPrev,
  canNext,
} = {}) {
  const recoveryState = buildImageFailureRecoveryState({
    imageUrl: currentUrl,
    imageFailed,
    hasAlternativeImages: Boolean(canPrev || canNext),
  });
  if (!recoveryState.show) {
    return {
      show: false,
      message: "",
      hint: "",
    };
  }
  return recoveryState;
}

export function buildLightboxOriginalState({
  displayUrl,
  originalCandidateUrl,
  useOriginal = false,
}) {
  const safeDisplayUrl = String(displayUrl || "");
  const safeOriginalCandidateUrl = String(originalCandidateUrl || "");
  const hasOriginalCandidate = Boolean(safeOriginalCandidateUrl);
  const hasDistinctOriginalUrl = Boolean(
    safeOriginalCandidateUrl && safeOriginalCandidateUrl !== safeDisplayUrl,
  );
  const isUsingOriginal = Boolean(useOriginal && hasDistinctOriginalUrl);
  const originalUrl = safeOriginalCandidateUrl || safeDisplayUrl;
  const toggleLabel = hasDistinctOriginalUrl
    ? (isUsingOriginal ? "使用展示图" : "查看原图")
    : (hasOriginalCandidate ? "当前已是原图" : "原图不可用");

  return {
    currentUrl: isUsingOriginal ? originalUrl : safeDisplayUrl,
    originalUrl,
    hasOriginalCandidate,
    hasDistinctOriginalUrl,
    isUsingOriginal,
    canUseOriginal: hasDistinctOriginalUrl,
    toggleLabel,
    buttonText: isUsingOriginal ? "展示图" : "原图",
  };
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export default function ImageLightbox({
  images,
  originalImages = [],
  imageSources = [],
  startIndex,
  onClose,
}) {
  const overlayRef = useRef(null);
  const stageRef = useRef(null);
  const mediaRef = useRef(null);
  const closeButtonRef = useRef(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moved: false,
  });
  const swipeRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });
  const pinchRef = useRef({
    active: false,
    startDistance: 0,
    startZoom: 1,
  });

  const safeImages = useMemo(
    () => (Array.isArray(images) ? images.map((image) => String(image || "")).filter(Boolean) : []),
    [images],
  );
  const [index, setIndex] = useState(() => clampLightboxIndex(startIndex, safeImages.length));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const [failedImageMap, setFailedImageMap] = useState({});
  const [retryTokenMap, setRetryTokenMap] = useState({});
  const recoveryDescriptionBaseId = useId();
  const recoveryLabelId = `${recoveryDescriptionBaseId}-image-lightbox-recovery-label`;
  const recoveryHintId = `${recoveryDescriptionBaseId}-image-lightbox-recovery-hint`;
  const recoveryDescriptionIds = `${recoveryLabelId} ${recoveryHintId}`;
  const canPrev = index > 0;
  const canNext = index < safeImages.length - 1;
  const safeOriginalImages = useMemo(
    () => (Array.isArray(originalImages) ? originalImages.map((image) => String(image || "")) : []),
    [originalImages],
  );
  const displayUrl = safeImages[index] || "";
  const currentImageSource = Array.isArray(imageSources) ? imageSources[index] || {} : {};
  const originalCandidateUrl = currentImageSource.originalUrl || safeOriginalImages[index] || "";
  const originalState = buildLightboxOriginalState({
    displayUrl,
    originalCandidateUrl,
    useOriginal,
  });
  const currentUrl = originalState.currentUrl;
  const imageFailed = Boolean(currentUrl && failedImageMap[currentUrl]);
  const currentRetryToken = currentUrl ? retryTokenMap[currentUrl] || 0 : 0;
  const currentRetryUrl = buildImageRetryUrl(currentUrl, currentRetryToken);
  const imageFailureState = buildLightboxImageFailureState({
    currentUrl,
    imageFailed,
    canPrev,
    canNext,
  });
  const currentFetchPriority = index === 0 && !originalState.isUsingOriginal ? "high" : "low";
  const currentLoading = index === 0 && !originalState.isUsingOriginal ? "eager" : "lazy";
  const onCloseRef = useRef(onClose);
  const zoomInRef = useRef(() => {});
  const zoomOutRef = useRef(() => {});

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  function closeViewer() {
    callLightboxClose(onCloseRef.current);
  }

  function resetView() {
    pointersRef.current.clear();
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    dragRef.current.moved = false;
    swipeRef.current.active = false;
    swipeRef.current.pointerId = null;
    pinchRef.current.active = false;
    pinchRef.current.startDistance = 0;
    pinchRef.current.startZoom = MIN_ZOOM;
    zoomRef.current = MIN_ZOOM;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
  }

  useEffect(() => {
    if (safeImages.length === 0) {
      closeViewer();
      return;
    }
    setIndex(clampLightboxIndex(startIndex, safeImages.length));
    setUseOriginal(false);
    resetView();
  }, [safeImages, startIndex]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement;
    const focusTarget = closeButtonRef.current || overlayRef.current;
    try {
      focusTarget?.focus?.({ preventScroll: true });
    } catch {
      focusTarget?.focus?.();
    }
    return () => {
      if (
        previouslyFocusedElement &&
        previouslyFocusedElement !== document.body &&
        document.contains(previouslyFocusedElement) &&
        typeof previouslyFocusedElement.focus === "function"
      ) {
        try {
          previouslyFocusedElement.focus({ preventScroll: true });
        } catch {
          previouslyFocusedElement.focus();
        }
      }
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      const keyAction = resolveLightboxKeyAction(event.key);
      if (!keyAction) {
        return;
      }
      event.preventDefault();
      if (keyAction === "close") {
        closeViewer();
      } else if (keyAction === "previous") {
        showImageByDelta(-1);
      } else if (keyAction === "next") {
        showImageByDelta(1);
      } else if (keyAction === "zoom-in") {
        zoomInRef.current?.();
      } else if (keyAction === "zoom-out") {
        zoomOutRef.current?.();
      } else if (keyAction === "reset") {
        resetView();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, safeImages.length]);

  function getBaseImageSize(stageRect) {
    if (!stageRect) {
      return null;
    }
    const image = mediaRef.current;
    const stageWidth = stageRect.width;
    const stageHeight = stageRect.height;
    const naturalWidth = image?.naturalWidth || 0;
    const naturalHeight = image?.naturalHeight || 0;
    if (naturalWidth <= 0 || naturalHeight <= 0) {
      return { width: stageWidth, height: stageHeight };
    }
    const fitScale = Math.min(stageWidth / naturalWidth, stageHeight / naturalHeight);
    return {
      width: naturalWidth * fitScale,
      height: naturalHeight * fitScale,
    };
  }

  function clampOffset(rawOffset, targetZoom) {
    const stageRect = stageRef.current?.getBoundingClientRect();
    const baseSize = getBaseImageSize(stageRect);
    if (!stageRect || !baseSize) {
      return rawOffset;
    }
    const stageWidth = stageRect.width;
    const stageHeight = stageRect.height;
    const displayedWidth = baseSize.width * targetZoom;
    const displayedHeight = baseSize.height * targetZoom;
    const minVisible = 56;
    const maxX =
      displayedWidth <= stageWidth
        ? (stageWidth - displayedWidth) / 2
        : (stageWidth + displayedWidth) / 2 - minVisible;
    const maxY =
      displayedHeight <= stageHeight
        ? (stageHeight - displayedHeight) / 2
        : (stageHeight + displayedHeight) / 2 - minVisible;
    return {
      x: clampNumber(rawOffset.x, -maxX, maxX),
      y: clampNumber(rawOffset.y, -maxY, maxY),
    };
  }

  function isInsideCurrentImage(clientX, clientY) {
    const rect = mediaRef.current?.getBoundingClientRect();
    if (!rect) {
      return false;
    }
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function setZoomAtClient(targetZoom, clientX, clientY) {
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) {
      return;
    }
    const previousZoom = zoomRef.current;
    const previousOffset = offsetRef.current;
    const clampedZoom = clampNumber(targetZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(clampedZoom - previousZoom) < 0.0001) {
      return;
    }
    if (clampedZoom <= MIN_ZOOM + 0.001) {
      zoomRef.current = MIN_ZOOM;
      offsetRef.current = { x: 0, y: 0 };
      setZoom(MIN_ZOOM);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const focusX = clientX - (stageRect.left + stageRect.width / 2);
    const focusY = clientY - (stageRect.top + stageRect.height / 2);
    const ratio = clampedZoom / previousZoom;
    const rawOffset = {
      x: focusX - (focusX - previousOffset.x) * ratio,
      y: focusY - (focusY - previousOffset.y) * ratio,
    };
    const nextOffset = clampOffset(rawOffset, clampedZoom);
    zoomRef.current = clampedZoom;
    offsetRef.current = nextOffset;
    setZoom(clampedZoom);
    setOffset(nextOffset);
  }

  function showImageByDelta(delta) {
    const navigation = resolveLightboxNavigation(index, safeImages.length, delta);
    if (!navigation.changed) {
      return;
    }
    setIndex(navigation.index);
    setUseOriginal(false);
    resetView();
  }

  function markCurrentImageFailed(failed) {
    if (!currentUrl) {
      return;
    }
    setFailedImageMap((prev) => updateImageFlagMap(prev, currentUrl, failed));
  }

  function retryCurrentImage(event) {
    event.stopPropagation();
    if (!currentUrl) {
      return;
    }
    setFailedImageMap((prev) => updateImageFlagMap(prev, currentUrl, false));
    setRetryTokenMap((prev) => incrementImageRetryTokenMap(prev, currentUrl));
    resetView();
  }

  function showPrev() {
    showImageByDelta(-1);
  }

  function showNext() {
    showImageByDelta(1);
  }

  function zoomIn() {
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) {
      return;
    }
    setZoomAtClient(
      zoomRef.current * 1.2,
      stageRect.left + stageRect.width / 2,
      stageRect.top + stageRect.height / 2,
    );
  }

  function zoomOut() {
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) {
      return;
    }
    setZoomAtClient(
      zoomRef.current / 1.2,
      stageRect.left + stageRect.width / 2,
      stageRect.top + stageRect.height / 2,
    );
  }
  zoomInRef.current = zoomIn;
  zoomOutRef.current = zoomOut;

  function onWheelZoom(event) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.00055);
    setZoomAtClient(zoomRef.current * factor, event.clientX, event.clientY);
  }

  function onPointerDown(event) {
    if (event.button != null && event.button !== 0) {
      return;
    }
    stageRef.current?.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = Array.from(pointersRef.current.values());
    if (pointers.length >= 2) {
      pinchRef.current.active = true;
      pinchRef.current.startDistance = Math.max(1, distanceBetween(pointers[0], pointers[1]));
      pinchRef.current.startZoom = zoomRef.current;
      dragRef.current.active = false;
      dragRef.current.pointerId = null;
      swipeRef.current.active = false;
      swipeRef.current.pointerId = null;
      setDragging(false);
      event.preventDefault();
      return;
    }

    if (!isInsideCurrentImage(event.clientX, event.clientY)) {
      return;
    }
    if (event.pointerType === "touch" && zoomRef.current <= MIN_ZOOM + 0.05) {
      swipeRef.current.pointerId = event.pointerId;
      swipeRef.current.startX = event.clientX;
      swipeRef.current.startY = event.clientY;
      swipeRef.current.lastX = event.clientX;
      swipeRef.current.lastY = event.clientY;
      swipeRef.current.active = true;
      event.preventDefault();
      return;
    }
    dragRef.current.pointerId = event.pointerId;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
    dragRef.current.baseX = offsetRef.current.x;
    dragRef.current.baseY = offsetRef.current.y;
    dragRef.current.moved = false;
    dragRef.current.active = true;
    setDragging(true);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = Array.from(pointersRef.current.values());

    if (pinchRef.current.active && pointers.length >= 2) {
      const nextDistance = Math.max(1, distanceBetween(pointers[0], pointers[1]));
      const center = midpoint(pointers[0], pointers[1]);
      const targetZoom =
        pinchRef.current.startZoom * (nextDistance / Math.max(1, pinchRef.current.startDistance));
      setZoomAtClient(targetZoom, center.x, center.y);
      event.preventDefault();
      return;
    }

    if (swipeRef.current.active && swipeRef.current.pointerId === event.pointerId) {
      swipeRef.current.lastX = event.clientX;
      swipeRef.current.lastY = event.clientY;
      event.preventDefault();
      return;
    }

    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    const rawOffset = {
      x: dragRef.current.baseX + dx,
      y: dragRef.current.baseY + dy,
    };
    const nextOffset = clampOffset(rawOffset, zoomRef.current);
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.delete(event.pointerId);
    }
    try {
      stageRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore pointer-capture mismatch on some mobile browsers.
    }

    if (dragRef.current.pointerId === event.pointerId) {
      dragRef.current.active = false;
      dragRef.current.pointerId = null;
      setDragging(false);
    }

    if (swipeRef.current.pointerId === event.pointerId) {
      const dx = swipeRef.current.lastX - swipeRef.current.startX;
      const dy = swipeRef.current.lastY - swipeRef.current.startY;
      const swipeThreshold = Math.max(48, Math.min(92, window.innerWidth * 0.16));
      if (
        swipeRef.current.active &&
        Math.abs(dx) >= swipeThreshold &&
        Math.abs(dx) > Math.abs(dy) * 1.25
      ) {
        if (dx < 0) {
          showNext();
        } else {
          showPrev();
        }
      }
      swipeRef.current.active = false;
      swipeRef.current.pointerId = null;
    }

    if (pointersRef.current.size < 2) {
      pinchRef.current.active = false;
      pinchRef.current.startDistance = 0;
      pinchRef.current.startZoom = zoomRef.current;
    }
  }

  function onStageClick(event) {
    event.stopPropagation();
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    if (!isInsideCurrentImage(event.clientX, event.clientY)) {
      closeViewer();
    }
  }

  function onStageDoubleClick(event) {
    event.stopPropagation();
    if (!isInsideCurrentImage(event.clientX, event.clientY)) {
      return;
    }
    if (zoomRef.current > MIN_ZOOM + 0.05) {
      resetView();
      return;
    }
    setZoomAtClient(2, event.clientX, event.clientY);
  }

  return (
    <div
      ref={overlayRef}
      className="image-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      tabIndex={-1}
      onClick={closeViewer}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="image-lightbox-close"
        onClick={(event) => {
          event.stopPropagation();
          closeViewer();
        }}
        aria-label="关闭图片预览"
      >
        <UiIcon name="close" />
      </button>

      <div className="image-lightbox-counter" aria-live="polite">
        {index + 1} / {safeImages.length}
      </div>

      {canPrev && (
        <button
          type="button"
          className="image-lightbox-nav prev"
          onClick={(event) => {
            event.stopPropagation();
            showPrev();
          }}
          aria-label="上一张图片"
        >
          <UiIcon name="chevron-left" />
        </button>
      )}

      {canNext && (
        <button
          type="button"
          className="image-lightbox-nav next"
          onClick={(event) => {
            event.stopPropagation();
            showNext();
          }}
          aria-label="下一张图片"
        >
          <UiIcon name="chevron-right" />
        </button>
      )}

      <div
        ref={stageRef}
        className={`image-lightbox-stage ${dragging ? "is-dragging" : ""}`}
        onClick={onStageClick}
        onDoubleClick={onStageDoubleClick}
        onWheel={onWheelZoom}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {currentUrl && (
          <img
            key={`${currentUrl}:${currentRetryToken}`}
            ref={mediaRef}
            src={currentRetryUrl}
            srcSet={
              !originalState.isUsingOriginal && currentRetryToken <= 0
                ? currentImageSource.srcSet || undefined
                : undefined
            }
            sizes={
              !originalState.isUsingOriginal && currentRetryToken <= 0
                ? currentImageSource.sizes || "100vw"
                : undefined
            }
            alt="Preview image"
            className="image-lightbox-media"
            draggable={false}
            decoding="async"
            loading={currentLoading}
            fetchPriority={currentFetchPriority}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
            }}
            onLoad={() => markCurrentImageFailed(false)}
            onError={() => markCurrentImageFailed(true)}
          />
        )}
        {imageFailureState.show && (
          <div
            className="image-lightbox-failure"
            role="alert"
            aria-live="assertive"
            onClick={(event) => event.stopPropagation()}
          >
            <strong id={recoveryLabelId}>{imageFailureState.message}</strong>
            <em id={recoveryHintId}>{imageFailureState.hint}</em>
            <button
              type="button"
              className="image-lightbox-retry"
              onClick={retryCurrentImage}
              aria-describedby={recoveryDescriptionIds}
            >
              {imageFailureState.retryLabel}
            </button>
          </div>
        )}
      </div>

      <div
        className="image-lightbox-toolbar"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button type="button" className="image-lightbox-tool" onClick={zoomOut} aria-label="缩小图片">
          -
        </button>
        <button type="button" className="image-lightbox-tool reset" onClick={resetView} aria-label="重置缩放">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="image-lightbox-tool" onClick={zoomIn} aria-label="放大图片">
          +
        </button>
        <button
          type="button"
          className={`image-lightbox-tool original ${originalState.isUsingOriginal ? "active" : ""}`}
          onClick={() => {
            if (!originalState.canUseOriginal) {
              return;
            }
            setUseOriginal((value) => !value);
            resetView();
          }}
          disabled={!originalState.canUseOriginal}
          aria-label={originalState.toggleLabel}
          title={originalState.toggleLabel}
        >
          {originalState.buttonText}
        </button>
      </div>
    </div>
  );
}
