import PostMediaGrid from "./PostMediaGrid";
import UiIcon from "../../../../shared/components/UiIcon";

export function buildPostCardShareButtonState({ post, isSharingPost } = {}) {
  const sharing = Boolean(isSharingPost?.(post));
  return {
    sharing,
    label: sharing ? "分享中" : "分享",
    title: sharing ? "正在准备分享" : "分享这条主帖",
    ariaLabel: sharing ? "正在分享这条主帖" : "分享这条主帖",
  };
}

export default function PostCard({
  post,
  openPostDetail,
  prefetchMainPostDetail,
  sharePost,
  isSharingPost,
  formatTime,
  clampText,
  formatHeatScore,
  prioritizePreviewImages = false,
  previewImagePriority = "",
  children,
}) {
  const activityTimeValue = post.latestActivityAt || post.createdAt;
  const activityTimeText = post.latestActivityAt
    ? post.latestActivityAtText
    : post.createdAtText;
  const shareButtonState = buildPostCardShareButtonState({ post, isSharingPost });

  function handleSharePost(event) {
    event.preventDefault();
    event.stopPropagation();
    sharePost?.(post);
  }

  return (
    <article className="post-card">
      <button
        type="button"
        className="post-open-cover"
        onClick={() => openPostDetail(post)}
        onPointerEnter={() => prefetchMainPostDetail?.(post)}
        onPointerDown={() => prefetchMainPostDetail?.(post)}
        onFocus={() => prefetchMainPostDetail?.(post)}
      >
        <span className="sr-only">打开帖子</span>
      </button>
      <div className="post-header-wrap">
        <div className="post-meta-top">
          <div className="author-info compact">
            <div className="post-card-avatar">
              {post.author.slice(0, 1).toUpperCase()}
            </div>
            <span className="author-name">{post.author}</span>
          </div>
          <span className="post-time">
            {formatTime(activityTimeValue, activityTimeText)}
          </span>
        </div>
        <h3 className="post-title" title={post.title}>
          {clampText(post.title || "", 30)}
        </h3>
      </div>
      <p className="post-content-preview">
        {clampText(post.preview || "", 60)}
      </p>
      <PostMediaGrid
        post={post}
        prioritizeImages={prioritizePreviewImages}
        imagePriority={previewImagePriority}
      />
      {children}
      <div className="post-foot">
        <div className="post-foot-left">
          <span className="post-community-name">
            {post.communityName || post.communitySlug}
          </span>
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="post-tag-inline-list">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={`${post.id}-${tag}`}
                  className="post-tag-chip-inline"
                  title={tag}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="post-foot-right">
          <div className="post-stats">
            <span className="post-stat-item">浏览 {post.viewCount || 0}</span>
            <span className="post-stat-item">热度 {formatHeatScore(post.hotScore)}</span>
          </div>
          {sharePost && (
            <button
              type="button"
              className="post-card-share-btn"
              onClick={handleSharePost}
              disabled={shareButtonState.sharing}
              title={shareButtonState.title}
              aria-label={shareButtonState.ariaLabel}
              aria-busy={shareButtonState.sharing ? "true" : undefined}
            >
              <span className="action-icon" aria-hidden="true">
                <UiIcon name="share" />
              </span>
              <span>{shareButtonState.label}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
