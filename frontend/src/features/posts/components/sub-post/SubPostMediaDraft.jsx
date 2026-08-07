import UiIcon from "../../../../shared/components/UiIcon";
import ResponsiveImage from "../../../../shared/media/ResponsiveImage";
import { buildPostMediaImageSources } from "../../../../shared/media/mediaAssetHelpers";
import { responsiveImageSourceUrl } from "../../../../shared/media/responsiveImages";

export function isSubPostMediaSourceReady(mediaSource) {
  return String(mediaSource?.processingStatus || "READY").toUpperCase() === "READY";
}

export function subPostMediaImageUrl(mediaSource) {
  return isSubPostMediaSourceReady(mediaSource)
    ? responsiveImageSourceUrl(mediaSource)
    : "";
}

function hasRefreshableSubPostMediaAssets(mediaAssets) {
  return (Array.isArray(mediaAssets) ? mediaAssets : []).some((asset) => {
    const assetId = Number(asset?.id || 0);
    const processingStatus = String(asset?.processingStatus || "READY").toUpperCase();
    return assetId > 0 && (processingStatus === "PROCESSING" || processingStatus === "FAILED");
  });
}

export function normalizeSubPostMediaSources(subPost) {
  const explicitSources = Array.isArray(subPost?.mediaImageSources)
    ? subPost.mediaImageSources
    : [];
  const assetSources = explicitSources.length > 0
    ? explicitSources
    : buildPostMediaImageSources(subPost?.mediaAssets);
  const fallbackUrls = Array.isArray(subPost?.mediaUrls) ? subPost.mediaUrls : [];
  const rawSources = assetSources.length > 0
    ? assetSources
    : fallbackUrls.map((src) => ({ src, displayUrl: src, processingStatus: "READY" }));

  return rawSources
    .map((source) => {
      if (typeof source === "string") {
        const src = source.trim();
        return src ? { src, displayUrl: src, processingStatus: "READY" } : null;
      }
      return source && typeof source === "object" ? source : null;
    })
    .filter((source) => {
      if (!source) {
        return false;
      }
      if (responsiveImageSourceUrl(source)) {
        return true;
      }
      return !isSubPostMediaSourceReady(source);
    });
}

export default function SubPostMediaDraft({
  mediaAssets = [],
  uploading = false,
  uploadStatus = { type: "" },
  onMediaPicked,
  onRetryFailedUploads,
  onRefreshMediaAssets,
  removeMediaAt,
  disabled = false,
  uploadStatusId,
}) {
  const mediaSources = normalizeSubPostMediaSources({ mediaAssets });
  const canUpload = !disabled && !uploading && mediaAssets.length < 6;
  const statusType = String(uploadStatus?.type || "");
  const statusMessage = String(uploadStatus?.message || "");
  const canRetry = Boolean(uploadStatus?.canRetry) && !disabled && !uploading;
  const retryLabel = String(uploadStatus?.retryLabel || "重试失败图片");
  const hasRefreshableMedia = hasRefreshableSubPostMediaAssets(mediaAssets);
  const canRefresh = !disabled && !uploading && hasRefreshableMedia;

  return (
    <div className="sub-post-media-draft">
      {mediaSources.length > 0 && (
        <div className={`sub-post-media-grid sub-post-media-draft-grid count-${Math.min(3, mediaSources.length)}`}>
          {mediaSources.map((mediaSource, mediaIndex) => {
            const imageUrl = subPostMediaImageUrl(mediaSource);
            const processingStatus = String(mediaSource.processingStatus || "READY").toUpperCase();
            const statusLabel = processingStatus === "PROCESSING"
              ? "图片处理中"
              : (processingStatus === "FAILED" ? "处理失败" : "");
            return (
              <div
                key={`${Number(mediaAssets[mediaIndex]?.id || 0) || "draft"}-${mediaIndex}`}
                className={`sub-post-media-item ${imageUrl ? "" : "is-status-placeholder"}`}
              >
                {imageUrl ? (
                  <ResponsiveImage
                    src={imageUrl}
                    source={mediaSource}
                    alt={`待发布图片 ${mediaIndex + 1}`}
                    className="sub-post-media-image"
                    loading="lazy"
                    fetchPriority="low"
                    decoding="async"
                  />
                ) : (
                  <span className="sub-post-media-placeholder" role="status">
                    {statusLabel || "图片暂不可用"}
                  </span>
                )}
                {statusLabel && (
                  <span className={`sub-post-media-status is-${processingStatus.toLowerCase()}`}>
                    {statusLabel}
                  </span>
                )}
                <button
                  type="button"
                  className="sub-post-media-remove"
                  onClick={() => removeMediaAt?.(mediaIndex)}
                  disabled={disabled || uploading}
                  aria-label={`移除待发布图片 ${mediaIndex + 1}`}
                >
                  <UiIcon name="close" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="sub-post-media-draft-controls">
        <label className={`sub-post-media-upload ${canUpload ? "" : "disabled"}`}>
          <UiIcon name="grid" />
          <span>{uploading ? "上传中..." : mediaAssets.length >= 6 ? "已满" : "上传图片"}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onMediaPicked}
            disabled={!canUpload}
          />
        </label>
        {statusMessage && (
          <span
            id={uploadStatusId}
            className={`sub-post-media-upload-status ${statusType || "info"}`}
            role={statusType === "error" || statusType === "warning" ? "alert" : "status"}
            aria-live={statusType === "error" || statusType === "warning" ? "assertive" : "polite"}
          >
            {statusMessage}
          </span>
        )}
        {uploadStatus?.canRetry && (
          <button
            type="button"
            className="sub-post-media-upload-retry"
            onClick={onRetryFailedUploads}
            disabled={!canRetry}
          >
            {retryLabel}
          </button>
        )}
        {hasRefreshableMedia && (
          <button
            type="button"
            className="sub-post-media-refresh"
            onClick={onRefreshMediaAssets}
            disabled={!canRefresh}
          >
            刷新图片状态
          </button>
        )}
      </div>
    </div>
  );
}
