import PostCard from "../../posts/components/post/PostCard";
import { StatusCard } from "../../../shared/components/PageShell";
import { canPrefetchImages } from "../../../shared/media/ResponsiveImage";

export function feedPreviewImagePriority(postIndex, { canEagerLoad = true } = {}) {
  if (postIndex === 0) {
    return "high";
  }
  if (postIndex === 1 && canEagerLoad) {
    return "eager";
  }
  return "";
}

export function buildFeedStatusState({ loadingPosts, hasPosts, feedError }) {
  if (loadingPosts && !hasPosts) {
    return {
      type: "loading",
      kicker: "主帖信息流",
      title: "主帖马上出现",
      description: "正在取回最新内容，很快就好。",
    };
  }
  if (!loadingPosts && !hasPosts && feedError) {
    return {
      type: "error",
      title: "主帖加载失败",
      description: feedError,
      actionLabel: "重试加载",
    };
  }
  if (!loadingPosts && !hasPosts) {
    return {
      type: "empty",
      title: "没有匹配的主帖",
      description: "这片区域暂时很安静。可以换个关键词、切回大厅，或发布一条新主帖。",
    };
  }
  return { type: "" };
}

export function buildFeedLoadMoreState({
  loadingMorePosts,
  loadingMorePostsError,
  feedHasMore,
}) {
  if (loadingMorePosts) {
    return { type: "loading", label: "正在加载更多内容..." };
  }
  if (loadingMorePostsError) {
    return {
      type: "error",
      label: loadingMorePostsError,
      actionLabel: "重试加载更多",
    };
  }
  if (feedHasMore) {
    return { type: "more", label: "继续下滑查看更多" };
  }
  return { type: "done", label: "已经到底了" };
}

export default function PostList({
  loadingPosts,
  filteredPosts,
  feedError = "",
  retryFeed,
  openPostDetail,
  prefetchMainPostDetail,
  formatTime,
  clampText,
  formatHeatScore,
  feedHasMore,
  loadingMorePosts,
  loadingMorePostsError = "",
  feedLoadMoreRef,
  retryLoadMorePosts,
}) {
  const hasPosts = Array.isArray(filteredPosts) && filteredPosts.length > 0;
  const canEagerLoadPreviewImages = canPrefetchImages();
  const statusState = buildFeedStatusState({ loadingPosts, hasPosts, feedError });
  const loadMoreState = buildFeedLoadMoreState({
    loadingMorePosts,
    loadingMorePostsError,
    feedHasMore,
  });

  return (
    <div className={`post-list-flow ${loadingPosts && hasPosts ? "is-refreshing" : ""}`}>
      {statusState.type === "loading" && (
        <StatusCard
          kicker={statusState.kicker}
          title={statusState.title}
          description={statusState.description}
          tone="loading"
          role="status"
          ariaLive="polite"
        >
          <span className="feed-status-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </StatusCard>
      )}
      {statusState.type === "error" && (
        <StatusCard
          title={statusState.title}
          description={statusState.description}
          role="alert"
          ariaLive="assertive"
        >
          <button
            type="button"
            className="neo-btn small"
            onClick={() => retryFeed?.()}
          >
            {statusState.actionLabel}
          </button>
        </StatusCard>
      )}
      {statusState.type === "empty" && (
        <StatusCard
          title={statusState.title}
          description={statusState.description}
          tone="empty"
        />
      )}
      {hasPosts &&
        filteredPosts.map((post, postIndex) => (
          <PostCard
            key={post.id}
            post={post}
            previewImagePriority={feedPreviewImagePriority(postIndex, {
              canEagerLoad: canEagerLoadPreviewImages,
            })}
            openPostDetail={openPostDetail}
            prefetchMainPostDetail={prefetchMainPostDetail}
            formatTime={formatTime}
            clampText={clampText}
            formatHeatScore={formatHeatScore}
          />
        ))}
      {!loadingPosts && hasPosts && (
        <div
          ref={feedLoadMoreRef}
          className={`feed-load-more ${loadMoreState.type === "error" ? "is-error" : ""}`}
        >
          <span>{loadMoreState.label}</span>
          {loadMoreState.type === "error" && (
            <button
              type="button"
              className="neo-btn small"
              onClick={() => retryLoadMorePosts?.()}
            >
              {loadMoreState.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
