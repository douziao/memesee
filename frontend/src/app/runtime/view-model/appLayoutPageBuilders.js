import { buildComposerPageProps } from "./appLayoutComposerBuilders";
import { buildPostDetailProps } from "./appLayoutDetailBuilders";
import { buildProfileCenterProps } from "./appLayoutProfileBuilders";

export function buildFeedProps(dependencies) {
  const { shell, feed, refs, actions, helpers } = dependencies;

  return {
    route: shell.route,
    view: shell.view,
    homeFeedProps: {
      loadingPosts: feed.loadingPosts,
      filteredPosts: feed.filteredPosts,
      feedHasMore: feed.feedHasMore,
      feedError: feed.feedError,
      loadingMorePosts: feed.loadingMorePosts,
      loadingMorePostsError: feed.loadingMorePostsError,
      feedLoadMoreRef: refs.feedLoadMoreRef,
      retryFeed: feed.refreshCurrentFeed,
      retryLoadMorePosts: feed.appendCurrentFeed,
      openPostDetail: actions.openPostDetail,
      prefetchMainPostDetail: actions.prefetchMainPostDetail,
      formatTime: helpers.formatTime,
      clampText: helpers.clampText,
      formatHeatScore: helpers.formatHeatScore,
    },
    profileCenterProps: buildProfileCenterProps(dependencies),
    postDetailProps: buildPostDetailProps(dependencies),
    composerPageProps: buildComposerPageProps(dependencies),
  };
}
