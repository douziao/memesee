export const IMAGE_LOAD_FAILED_LABEL = "图片加载失败";
export const IMAGE_RETRY_LABEL = "重新加载";
export const IMAGE_UNAVAILABLE_LABEL = "图片暂不可用";

export function buildImageRetryUrl(imageUrl, retryToken = 0) {
  const safeImageUrl = String(imageUrl || "");
  const safeRetryToken = Number(retryToken || 0);
  if (!safeImageUrl || !Number.isFinite(safeRetryToken) || safeRetryToken <= 0) {
    return safeImageUrl;
  }
  if (/^(data|blob):/i.test(safeImageUrl)) {
    return safeImageUrl;
  }

  const hashIndex = safeImageUrl.indexOf("#");
  const baseUrl = hashIndex >= 0 ? safeImageUrl.slice(0, hashIndex) : safeImageUrl;
  const hash = hashIndex >= 0 ? safeImageUrl.slice(hashIndex) : "";
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}__retry=${encodeURIComponent(String(Math.trunc(safeRetryToken)))}${hash}`;
}

export function buildRetryableImageSourceState({
  imageUrl = "",
  imageSource = {},
  retryToken = 0,
} = {}) {
  const retryImageUrl = buildImageRetryUrl(imageUrl, retryToken);
  const safeRetryToken = Number(retryToken || 0);
  const shouldBypassSrcSet = Number.isFinite(safeRetryToken) && safeRetryToken > 0;

  return {
    retryImageUrl,
    retryImageSource: shouldBypassSrcSet
      ? { ...imageSource, srcSet: "" }
      : imageSource,
  };
}

export function updateImageFlagMap(flagMap = {}, imageUrl = "", enabled = false) {
  const safeMap = flagMap || {};
  const safeImageUrl = String(imageUrl || "");
  const nextEnabled = Boolean(enabled);
  if (!safeImageUrl || Boolean(safeMap[safeImageUrl]) === nextEnabled) {
    return safeMap;
  }
  return {
    ...safeMap,
    [safeImageUrl]: nextEnabled,
  };
}

export function incrementImageRetryTokenMap(retryTokenMap = {}, imageUrl = "") {
  const safeMap = retryTokenMap || {};
  const safeImageUrl = String(imageUrl || "");
  if (!safeImageUrl) {
    return safeMap;
  }

  return {
    ...safeMap,
    [safeImageUrl]: Math.max(0, Math.trunc(Number(safeMap[safeImageUrl]) || 0)) + 1,
  };
}

export function buildImageFailureRecoveryState({
  imageUrl,
  imageFailed,
  hasAlternativeImages = false,
  failureLabel = IMAGE_LOAD_FAILED_LABEL,
  retryLabel = IMAGE_RETRY_LABEL,
} = {}) {
  if (!imageUrl || !imageFailed) {
    return {
      show: false,
      message: "",
      hint: "",
      retryLabel,
    };
  }
  return {
    show: true,
    message: failureLabel,
    hint: hasAlternativeImages
      ? "可以重新加载当前图片，或切换其它图片。"
      : "可以重新加载当前图片。",
    retryLabel,
  };
}
