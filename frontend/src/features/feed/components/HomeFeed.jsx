import PostList from "./PostList";

export default function HomeFeed({
  loadingPosts,
  filteredPosts,
  feedError,
  retryFeed,
  openPostDetail,
  prefetchMainPostDetail,
  formatTime,
  clampText,
  formatHeatScore,
  feedHasMore,
  loadingMorePosts,
  loadingMorePostsError,
  feedLoadMoreRef,
  retryLoadMorePosts,
}) {
  return (
    <section className="feed-grid">
      <PostList
        loadingPosts={loadingPosts}
        filteredPosts={filteredPosts}
        feedError={feedError}
        retryFeed={retryFeed}
        openPostDetail={openPostDetail}
        prefetchMainPostDetail={prefetchMainPostDetail}
        formatTime={formatTime}
        clampText={clampText}
        formatHeatScore={formatHeatScore}
        feedHasMore={feedHasMore}
        loadingMorePosts={loadingMorePosts}
        loadingMorePostsError={loadingMorePostsError}
        feedLoadMoreRef={feedLoadMoreRef}
        retryLoadMorePosts={retryLoadMorePosts}
      />
    </section>
  );
}
