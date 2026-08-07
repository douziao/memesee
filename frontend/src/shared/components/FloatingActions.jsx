import UiIcon from "./UiIcon";

export default function FloatingActions({
  variant,
  show,
  loadingPosts,
  refreshFeed,
  backToTop,
}) {
  if (!show) {
    return null;
  }

  const refreshLabel = variant === "post" ? "刷新内容" : "刷新";
  const refreshAriaLabel = variant === "post" ? "刷新内容" : "刷新帖子";
  async function handleRefreshClick(event) {
    event.stopPropagation();
    backToTop?.();
    await refreshFeed?.();
    window.requestAnimationFrame(() => {
      backToTop?.();
    });
  }

  return (
    <div className="floating-actions">
      <button
        type="button"
        className="floating-action-btn refresh"
        onClick={handleRefreshClick}
        disabled={loadingPosts}
        aria-label={refreshAriaLabel}
        title={loadingPosts ? "刷新中..." : refreshLabel}
      >
        <UiIcon name="refresh" />
      </button>
      <button
        type="button"
        className="floating-action-btn arrow"
        onClick={backToTop}
        aria-label="回到最上面"
      >
        <UiIcon name="arrow-up" />
      </button>
    </div>
  );
}
