import {
  apiBase as runtimeApiBase,
  feedBatchSize,
  feedSortModes,
  notificationPageSize,
  profilePostPageSize,
  publishCommunityOrder,
  lobbyCommunity,
} from "../appRuntimeConfig";
import {
  buildDetailQueryRuntime,
  buildFeedQueryRuntime,
} from "../query/appDataQueryRuntimeHelpers";
import { buildPostLifecycleEventHandlers } from "../state/postLifecycleEvents";
import { syncLoadedMainPostIntoFeed } from "../../../features/posts/state/mainPostQuerySyncHelpers";
import { syncLoadedMainPostIntoFeedQueryRuntime } from "../../../features/posts/state/mainPostQueryRuntimeHelpers";
import { useCommunitiesCatalog } from "../../../features/communities/hooks/useCommunitiesCatalog";
import { useFeedView } from "../../../features/feed/hooks/useFeedView";
import { useNotifications } from "../../../features/notifications/hooks/useNotifications";
import { useMainPostMediaRefresh } from "../../../features/posts/hooks/useMainPostMediaRefresh";
import { usePostDetailView } from "../../../features/posts/hooks/usePostDetailView";
import { useSubPostMediaRefresh } from "../../../features/posts/hooks/useSubPostMediaRefresh";
import { useProfileView } from "../../../features/profile/hooks/useProfileView";

export function useAppDataRuntime({
  client,
  apiBase = runtimeApiBase,
  view,
  topSortRef,
  appChrome,
  authSession,
  setMessage,
}) {
  const feedView = useFeedView({
    client,
    token: authSession.token,
    apiBase,
    routeType: appChrome.route.type,
    view,
    topSortRef,
    setMessage,
    feedBatchSize,
    feedSortModes,
  });
  const feedQueryRuntime = buildFeedQueryRuntime(feedView);

  const communitiesCatalog = useCommunitiesCatalog({
    client,
    publishCommunityOrder,
    lobbyCommunity,
    feedQueryRuntime,
    setMessage,
  });

  const profileViewState = useProfileView({
    view,
    isLoggedIn: authSession.isLoggedIn,
    token: authSession.token,
    orderedCommunities: communitiesCatalog.orderedCommunities,
    levelProgress: authSession.levelProgress,
    userLevel: authSession.userLevel,
    client,
    apiBase,
    setMessage,
    syncUserProgressFromPayload: authSession.syncUserProgressFromPayload,
    profilePostPageSize,
  });

  const notificationsState = useNotifications({
    client,
    token: authSession.token,
    isLoggedIn: authSession.isLoggedIn,
    currentUser: authSession.currentUser,
    setMessage,
    pageSize: notificationPageSize,
  });

  const postLifecycleEvents = buildPostLifecycleEventHandlers({
    profileViewState,
    notificationsState,
  });

  const postDetailBase = usePostDetailView({
    route: appChrome.route,
    token: authSession.token,
    client,
    apiBase,
    setMessage,
    onPostDetailLoaded: (loadedPost) => {
      syncLoadedMainPostIntoFeedQueryRuntime({
        feedQueryRuntime,
        loadedPost,
        syncLoadedMainPostIntoFeed,
      });
      postLifecycleEvents.handleMainPostSnapshotSynced(loadedPost);
    },
  });
  useMainPostMediaRefresh({
    client,
    apiBase,
    posts: feedView.posts,
    selectedPost: postDetailBase.selectedPost,
    setPosts: feedView.setPosts,
    setPostDetail: postDetailBase.setPostDetail,
    updatePostDetailCache: postDetailBase.updatePostDetailCache,
  });
  useSubPostMediaRefresh({
    client,
    apiBase,
    subPosts: postDetailBase.subPosts,
    setSubPosts: postDetailBase.setSubPosts,
  });
  const detailQueryRuntime = buildDetailQueryRuntime(postDetailBase);
  const queryRuntimes = {
    feedQueryRuntime,
    detailQueryRuntime,
  };

  return {
    feedView,
    queryRuntimes,
    communitiesCatalogState: {
      ...communitiesCatalog,
    },
    profileViewState,
    notificationsState,
    postDetailView: {
      ...postDetailBase,
      detailMarkdownInput: {
        apiBase,
        selectedPost: postDetailBase.selectedPost,
      },
    },
  };
}
