import PostDetailArticle from "./PostDetailArticle";
import PostDetailLayout from "./PostDetailLayout";
import {
  PostDetailLoadingState,
  PostDetailRetryState,
} from "./PostDetailStates";
import "./PostDetail.css";

export default function PostDetailView({
  statusProps,
  headerProps,
  galleryProps,
  contentProps,
  interactionProps,
  subPostPanelProps,
}) {
  const {
    loadingPostDetail,
    refreshingCurrentPostThread,
    postDetailErrorType,
    selectedPost,
    refreshCurrentPostThread,
    backToLatest,
  } = statusProps;
  const hasLoadedSelectedPost = Boolean(selectedPost?.contentLoaded);
  const showInitialLoading = loadingPostDetail && !hasLoadedSelectedPost;
  const showRetryState = !loadingPostDetail && !hasLoadedSelectedPost;
  const showSelectedPost = selectedPost && hasLoadedSelectedPost;

  return (
    <PostDetailLayout>
      {showInitialLoading && <PostDetailLoadingState />}
      {showRetryState && (
        <PostDetailRetryState
          postDetailErrorType={postDetailErrorType}
          refreshingCurrentPostThread={refreshingCurrentPostThread}
          refreshCurrentPostThread={refreshCurrentPostThread}
          backToLatest={backToLatest}
        />
      )}
      {showSelectedPost && (
        <PostDetailArticle
          loadingPostDetail={loadingPostDetail}
          selectedPost={selectedPost}
          headerProps={headerProps}
          galleryProps={galleryProps}
          contentProps={contentProps}
          interactionProps={interactionProps}
          subPostPanelProps={subPostPanelProps}
        />
      )}
    </PostDetailLayout>
  );
}
