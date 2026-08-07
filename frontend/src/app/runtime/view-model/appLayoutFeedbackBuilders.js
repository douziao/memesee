export function buildHomeFloatingProps({ shell, feed }) {
  return {
    variant: "home",
    show: shell.route.type === "home" && shell.view !== "mine" && feed.showBackTop,
    loadingPosts: feed.loadingPosts || feed.refreshingHomeFeed,
    refreshFeed: feed.refreshCurrentFeed || feed.refreshFeed,
    backToTop: feed.backToTop,
  };
}

export function buildPostFloatingProps({ shell, feed, detail }) {
  return {
    variant: "post",
    show: shell.route.type === "post" && feed.showBackTop,
    loadingPosts:
      detail.loadingPostDetail ||
      detail.loadingSubPosts ||
      detail.refreshingCurrentPostThread,
    refreshFeed: detail.reloadCurrentPostThread || detail.refreshCurrentPostThread,
    backToTop: feed.backToTop,
  };
}

export function buildToastProps({ shell }) {
  return {
    message: shell.message,
    onClose: shell.clearMessage,
  };
}
