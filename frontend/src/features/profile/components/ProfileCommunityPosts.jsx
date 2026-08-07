import UiIcon from "../../../shared/components/UiIcon";

export function buildProfilePostShareButtonState({ post, isSharingPost } = {}) {
  const sharing = Boolean(isSharingPost?.(post));
  return {
    sharing,
    label: sharing ? "分享中" : "分享",
    title: sharing ? "正在准备分享" : "分享这条主帖",
    ariaLabel: sharing ? "正在分享这条主帖" : "分享这条主帖",
  };
}

export default function ProfileCommunityPosts({
  activeProfileCommunity,
  backToProfileOverview,
  openPostDetail,
  sharePost,
  isSharingPost,
  formatTime,
}) {
  const posts = Array.isArray(activeProfileCommunity?.posts)
    ? activeProfileCommunity.posts
    : [];

  return (
    <>
      <div className="profile-community-header">
        <h3>{activeProfileCommunity.name}</h3>
        <span className="profile-stat-pill">共 {posts.length} 篇</span>
      </div>
      {posts.length === 0 && (
        <div className="paper-inline-status profile-empty-inline profile-community-empty">
          <span>这个社区下暂无发布，可能刚刚移动到了其他社区。</span>
          <button
            type="button"
            className="neo-btn small"
            onClick={() => backToProfileOverview?.()}
          >
            返回资料概览
          </button>
        </div>
      )}
      <div className="profile-post-list">
        {posts.map((post) => {
          const shareButtonState = buildProfilePostShareButtonState({ post, isSharingPost });

          function handleSharePost(event) {
            event.preventDefault();
            event.stopPropagation();
            sharePost?.(post);
          }

          return (
            <div key={post.id} className="profile-post-item">
              <button
                type="button"
                className="profile-post-main"
                onClick={() => openPostDetail(post)}
              >
                <strong>{post.title}</strong>
                <span>{formatTime(post.createdAt, post.createdAtText)}</span>
              </button>
              {sharePost && (
                <div className="profile-post-tools">
                  <button
                    type="button"
                    className="profile-post-share"
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
