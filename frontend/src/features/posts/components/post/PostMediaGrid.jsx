import { useState } from "react";
import ResponsiveImage from "../../../../shared/media/ResponsiveImage";
import { responsiveImageSourceUrl } from "../../../../shared/media/responsiveImages";

export function isPostMediaSourceReady(imageSource) {
  return String(imageSource?.processingStatus || "READY").toUpperCase() === "READY";
}

export function postMediaImageUrl(imageSource) {
  return isPostMediaSourceReady(imageSource)
    ? responsiveImageSourceUrl(imageSource)
    : "";
}

export function normalizePostMediaGridSourceItems(post) {
  const previewImageSources = Array.isArray(post?.previewImageSources)
    ? post.previewImageSources
    : [];
  const previewImages = Array.isArray(post?.previewImages) ? post.previewImages : [];
  const sourceItems = previewImageSources.length > 0
    ? previewImageSources
    : previewImages.map((src) => ({ src, displayUrl: src }));

  return sourceItems
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
      return !isPostMediaSourceReady(source);
    });
}

function PostMediaGridItem({ post, imageSource, imageIndex, priorityMode }) {
  const [failed, setFailed] = useState(false);
  const processingStatus = String(imageSource.processingStatus || "READY").toUpperCase();
  const processingLabel = processingStatus === "PROCESSING"
    ? "处理中"
    : (processingStatus === "FAILED" ? "处理失败" : "");
  const statusLabel = failed ? "加载失败" : processingLabel;
  const statusClass = failed ? "is-failed" : `is-${processingStatus.toLowerCase()}`;
  const imageUrl = postMediaImageUrl(imageSource);
  const normalizedPriorityMode = priorityMode === "high" || priorityMode === "eager"
    ? priorityMode
    : "";

  return (
    <div className={`post-media-item ${failed ? "is-image-failed" : ""} ${imageUrl ? "" : "is-status-placeholder"}`}>
      {imageUrl && (
        <ResponsiveImage
          src={imageUrl}
          source={imageSource}
          alt={`${post.title}-图${imageIndex + 1}`}
          className="post-media-image"
          loading={normalizedPriorityMode ? "eager" : "lazy"}
          fetchPriority={normalizedPriorityMode === "high" ? "high" : "low"}
          decoding="async"
          onLoadStateChange={({ failed: nextFailed }) => setFailed(nextFailed)}
        />
      )}
      {statusLabel && (
        <span className={`post-media-status ${statusClass}`}>
          {statusLabel}
        </span>
      )}
    </div>
  );
}

export default function PostMediaGrid({ post, prioritizeImages = false, imagePriority = "" }) {
  const sourceItems = normalizePostMediaGridSourceItems(post);

  if (sourceItems.length === 0) {
    return null;
  }

  const visibleImages = sourceItems.slice(0, 3);
  const countClass = `count-${Math.min(3, visibleImages.length)}`;

  return (
    <div className={`post-media-grid ${countClass}`}>
      {visibleImages.map((imageSource, imageIndex) => (
        <PostMediaGridItem
          key={`${post.id}-${imageIndex}`}
          post={post}
          imageSource={imageSource}
          imageIndex={imageIndex}
          priorityMode={imageIndex === 0 ? (imagePriority || (prioritizeImages ? "high" : "")) : ""}
        />
      ))}
    </div>
  );
}
