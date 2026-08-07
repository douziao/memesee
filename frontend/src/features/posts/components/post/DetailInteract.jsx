import { useEffect, useMemo, useRef, useState } from "react";
import UiIcon from "../../../../shared/components/UiIcon";
import SubPostMediaDraft from "../sub-post/SubPostMediaDraft";
import { resolveMainPostId } from "../../state/mainPostIdentityHelpers";

const TOP_SUB_POST_MEDIA_UPLOAD_STATUS_ID = "top-sub-post-media-upload-status";

export function shouldShowGuestEngagementPrompt({ isLoggedIn, selectedPost }) {
  return !isLoggedIn && resolveMainPostId(selectedPost) > 0;
}

export function runPostMoreAction(action, closePostMore) {
  action?.();
  closePostMore?.("menu-action");
}

export function buildPostMoreMenuId(selectedPost) {
  const postId = resolveMainPostId(selectedPost);
  if (postId > 0) {
    return `detail-post-more-menu-${postId}`;
  }
  return "detail-post-more-menu-current";
}

export function buildPostMoreWrapClassName(postMoreOpen) {
  return [
    "detail-post-more-wrap",
    postMoreOpen ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function hasShareTargetSubPost(targetSubPostId) {
  return targetSubPostId > 0;
}

export function buildPostShareButtonState({
  selectedPost,
  isSharingPost,
  targetSubPostId,
} = {}) {
  const sharing = Boolean(isSharingPost?.(selectedPost));
  const sharingTargetSubPost = hasShareTargetSubPost(targetSubPostId);
  return {
    sharing,
    label: sharing ? "分享中" : (sharingTargetSubPost ? "分享定位" : "分享"),
    title: sharing
      ? (sharingTargetSubPost ? "正在准备定位分享" : "正在准备分享")
      : (sharingTargetSubPost ? "分享定位" : "分享"),
    ariaLabel: sharing
      ? (sharingTargetSubPost ? "正在分享定位" : "正在分享")
      : (sharingTargetSubPost ? "分享定位" : "分享"),
  };
}

export function buildPostShareButtonClassName({ targetSubPostId } = {}) {
  return `detail-interact-btn detail-interact-btn-large detail-interact-btn-share${hasShareTargetSubPost(targetSubPostId) ? " is-target-share" : ""}`;
}

export function buildPostShareMobileStatus({ sharing = false, targetSubPostId } = {}) {
  if (sharing) {
    return hasShareTargetSubPost(targetSubPostId) ? "准备定位分享" : "正在准备分享";
  }
  return hasShareTargetSubPost(targetSubPostId) ? "定位分享" : "";
}

export function shouldRestorePostMoreFocus(closeReason) {
  return closeReason === "keyboard" || closeReason === "menu-action";
}

export function shouldFocusPostMoreMenuOnOpen(event) {
  return !event?.detail;
}

export function getPostMoreMenuNavigationTarget({ key, currentIndex, itemCount }) {
  if (!Number.isInteger(currentIndex) || !Number.isInteger(itemCount) || itemCount <= 0) {
    return null;
  }

  if (key === "ArrowRight" || key === "ArrowDown") {
    return (currentIndex + 1) % itemCount;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return (currentIndex - 1 + itemCount) % itemCount;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return itemCount - 1;
  }
  return null;
}

export default function DetailInteract({
  selectedPost,
  metaProps,
  actionProps,
  composerProps,
}) {
  const {
    selectedLikeCount,
    selectedFavoriteCount,
    formatHeatScore,
    formatTime,
  } = metaProps;
  const {
    isLoggedIn,
    openMainPostSubPostComposer,
    togglePostLike,
    togglePostFavorite,
    handlePostReport,
    sharePost,
    isSharingPost,
    targetSubPostId,
    requireAuthNotice,
    openAuthModal,
  } = actionProps;
  const {
    showTopSubPostComposer,
    activeSubPostTarget,
    subPostInput,
    setSubPostInput,
    submittingSubPost,
    submitSubPost,
    subPostMediaAssets,
    uploadingSubPostMedia,
    subPostMediaUploadStatus,
    onSubPostMediaPicked,
    retryFailedSubPostMediaUploads,
    refreshSubPostMediaAssets,
    removeSubPostMediaAt,
    cancelTopSubPostComposer,
    subPostComposerRef,
    subPostTextareaRef,
  } = composerProps;

  const [postMoreOpen, setPostMoreOpen] = useState(false);
  const selectedPostId = resolveMainPostId(selectedPost);
  const postMoreRef = useRef(null);
  const postMoreButtonRef = useRef(null);
  const postMoreFirstActionRef = useRef(null);
  const postMoreReportActionRef = useRef(null);
  const focusPostMoreMenuOnOpenRef = useRef(false);
  const restorePostMoreFocusRef = useRef(false);

  useEffect(() => {
    focusPostMoreMenuOnOpenRef.current = false;
    restorePostMoreFocusRef.current = false;
    setPostMoreOpen(false);
  }, [selectedPostId]);

  useEffect(() => {
    if (postMoreOpen || !restorePostMoreFocusRef.current) {
      return undefined;
    }

    restorePostMoreFocusRef.current = false;
    const timerId = window.setTimeout(() => {
      postMoreButtonRef.current?.focus?.();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [postMoreOpen]);

  useEffect(() => {
    if (!postMoreOpen || !focusPostMoreMenuOnOpenRef.current) {
      return undefined;
    }

    focusPostMoreMenuOnOpenRef.current = false;
    const timerId = window.setTimeout(() => {
      postMoreFirstActionRef.current?.focus?.();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [postMoreOpen]);

  useEffect(() => {
    if (!postMoreOpen) {
      return undefined;
    }

    function handleClick(event) {
      if (!postMoreRef.current?.contains(event.target)) {
        closePostMore("outside");
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closePostMore("keyboard");
      }
    }

    const timerId = window.setTimeout(() => {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [postMoreOpen]);

  const showEditedHint = useMemo(() => {
    if (!selectedPost?.updatedAt) {
      return false;
    }
    const updatedTime = new Date(selectedPost.updatedAt).getTime();
    const createdTime = new Date(selectedPost.createdAt || 0).getTime();
    if (!Number.isFinite(updatedTime) || updatedTime <= 0) {
      return false;
    }
    return !Number.isFinite(createdTime) || Math.abs(updatedTime - createdTime) > 1000;
  }, [selectedPost?.createdAt, selectedPost?.updatedAt]);

  const collapseMetrics =
    postMoreOpen && selectedLikeCount > 0 && selectedFavoriteCount > 0;
  const showGuestPrompt = shouldShowGuestEngagementPrompt({ isLoggedIn, selectedPost });
  const postMoreMenuId = buildPostMoreMenuId(selectedPost);
  const postShareButtonState = buildPostShareButtonState({
    selectedPost,
    isSharingPost,
    targetSubPostId,
  });
  const postShareButtonClassName = buildPostShareButtonClassName({
    targetSubPostId,
  });
  const postShareMobileStatus = buildPostShareMobileStatus({
    sharing: postShareButtonState.sharing,
    targetSubPostId,
  });

  function openLoginForEngagement() {
    requireAuthNotice?.();
    openAuthModal?.("login");
  }

  function closePostMore(closeReason = "programmatic") {
    focusPostMoreMenuOnOpenRef.current = false;
    restorePostMoreFocusRef.current = shouldRestorePostMoreFocus(closeReason);
    setPostMoreOpen(false);
  }

  function openPostMore(event) {
    focusPostMoreMenuOnOpenRef.current = shouldFocusPostMoreMenuOnOpen(event);
    setPostMoreOpen(true);
  }

  function handlePostMoreMenuItemKeyDown(event, currentIndex) {
    const menuItems = [
      postMoreFirstActionRef.current,
      postMoreReportActionRef.current,
    ].filter(Boolean);
    const targetIndex = getPostMoreMenuNavigationTarget({
      key: event.key,
      currentIndex,
      itemCount: menuItems.length,
    });
    if (targetIndex == null) {
      return;
    }

    event.preventDefault();
    menuItems[targetIndex]?.focus?.();
  }

  return (
    <>
      <div className="detail-interact-wrap">
        <div className="detail-interact-topline">
          <div className="detail-interact-edited-slot">
            {showEditedHint && (
              <div className="detail-interact-edited">
                已编辑 {formatTime(selectedPost.updatedAt, selectedPost.updatedAtText)}
              </div>
            )}
          </div>
          <div className="detail-interact-meta detail-interact-meta-plain">
            <span className="detail-interact-meta-text">浏览 {selectedPost.viewCount || 0}</span>
            <span className="detail-interact-meta-text">
              热度 {formatHeatScore(selectedPost.hotScore)}
            </span>
          </div>
        </div>

        <div className={`detail-interact-mainline ${postMoreOpen ? "is-more-open" : ""}`}>
          <div className={`detail-interact-badge-stack ${collapseMetrics ? "is-condensed" : ""}`}>
            <div className="detail-interact-badge-row detail-interact-badge-row-split">
              {selectedLikeCount > 0 && (
                <span className="detail-interact-badge like" title={`点赞 ${selectedLikeCount}`}>
                  <span className="action-icon">
                    <UiIcon name="heart-filled" />
                  </span>
                  <span>{selectedLikeCount}</span>
                </span>
              )}
              {selectedFavoriteCount > 0 && (
                <span
                  className="detail-interact-badge favorite"
                  title={`收藏 ${selectedFavoriteCount}`}
                >
                  <span className="action-icon">
                    <UiIcon name="star-filled" />
                  </span>
                  <span>{selectedFavoriteCount}</span>
                </span>
              )}
            </div>

            {selectedLikeCount > 0 && selectedFavoriteCount > 0 && (
              <div className="detail-interact-badge-row detail-interact-badge-row-combined">
                <span
                  className="detail-interact-badge combined"
                  title={`点赞 ${selectedLikeCount}，收藏 ${selectedFavoriteCount}`}
                >
                  <span className="action-icon">
                    <UiIcon name="heart-filled" />
                  </span>
                  <span>{selectedLikeCount}</span>
                  <span className="detail-interact-badge-divider" aria-hidden="true" />
                  <span className="action-icon">
                    <UiIcon name="star-filled" />
                  </span>
                  <span>{selectedFavoriteCount}</span>
                </span>
              </div>
            )}
          </div>

          {postShareMobileStatus && (
            <div className="detail-share-mobile-status" role="status" aria-live="polite">
              <span>{postShareMobileStatus}</span>
            </div>
          )}

          <div className="detail-interact-bar detail-interact-bar-post" ref={postMoreRef}>
            <button
              type="button"
              className={`detail-interact-btn detail-interact-btn-large ${
                selectedPost.likedByMe ? "active" : ""
              } detail-interact-btn-like`}
              onClick={() => togglePostLike(selectedPostId, Boolean(selectedPost.likedByMe))}
              title={!isLoggedIn ? "请先登录后再点赞" : "点赞"}
              aria-label={selectedPost.likedByMe ? "取消点赞" : "点赞"}
            >
              <span className="action-icon">
                <UiIcon name={selectedPost.likedByMe ? "heart-filled" : "heart"} />
              </span>
              <span className="action-label">点赞</span>
            </button>

            <button
              type="button"
              className={postShareButtonClassName}
              onClick={() => sharePost?.(selectedPost)}
              disabled={postShareButtonState.sharing}
              title={postShareButtonState.title}
              aria-label={postShareButtonState.ariaLabel}
              aria-busy={postShareButtonState.sharing ? "true" : undefined}
            >
              <span className="action-icon">
                <UiIcon name="share" />
              </span>
              <span className="action-label">{postShareButtonState.label}</span>
            </button>

            <div className={buildPostMoreWrapClassName(postMoreOpen)}>
              {postMoreOpen ? (
                <div
                  id={postMoreMenuId}
                  className="detail-post-more-menu"
                  role="menu"
                  aria-label="主帖更多操作"
                >
                  <button
                    ref={postMoreFirstActionRef}
                    type="button"
                    className={`detail-interact-btn detail-interact-btn-large detail-post-more-action ${
                      selectedPost.favoritedByMe ? "active" : ""
                    } detail-interact-btn-favorite`}
                    role="menuitem"
                    onKeyDown={(event) => handlePostMoreMenuItemKeyDown(event, 0)}
                    onClick={() => runPostMoreAction(
                      () => togglePostFavorite(
                        selectedPostId,
                        Boolean(selectedPost.favoritedByMe),
                      ),
                      closePostMore,
                    )}
                    title={!isLoggedIn ? "请先登录后再收藏" : "收藏"}
                    aria-label={selectedPost.favoritedByMe ? "取消收藏" : "收藏"}
                  >
                    <span className="action-icon">
                      <UiIcon
                        name={selectedPost.favoritedByMe ? "star-filled" : "star"}
                      />
                    </span>
                    <span className="action-label">收藏</span>
                  </button>
                  <button
                    ref={postMoreReportActionRef}
                    type="button"
                    className="detail-interact-btn detail-interact-btn-large detail-post-more-action detail-interact-btn-report"
                    role="menuitem"
                    onKeyDown={(event) => handlePostMoreMenuItemKeyDown(event, 1)}
                    onClick={() => runPostMoreAction(handlePostReport, closePostMore)}
                    title="举报"
                    aria-label="举报"
                  >
                    <span className="action-icon">
                      <UiIcon name="flag" />
                    </span>
                    <span className="action-label">举报</span>
                  </button>
                </div>
              ) : (
                <button
                  ref={postMoreButtonRef}
                  type="button"
                  className="detail-interact-btn detail-interact-btn-large detail-interact-btn-more"
                  onClick={openPostMore}
                  title={!isLoggedIn ? "请先登录后再查看更多操作" : "更多"}
                  aria-controls={postMoreMenuId}
                  aria-expanded={postMoreOpen}
                  aria-haspopup="menu"
                  aria-label="更多"
                >
                  <span className="action-icon">
                    <UiIcon name="more" />
                  </span>
                  <span className="action-label">更多</span>
                </button>
              )}
            </div>

            <button
              type="button"
              className="detail-interact-btn detail-interact-btn-large detail-interact-btn-sub-post"
              onClick={openMainPostSubPostComposer}
              title={!isLoggedIn ? "请先登录后再发布子帖" : "发布子帖"}
              aria-label="子帖"
            >
              <span className="action-icon">
                <UiIcon name="sub-post" />
              </span>
              <span className="action-label">子帖</span>
            </button>
          </div>
        </div>

        {showGuestPrompt && (
          <div className="detail-guest-engagement" role="note">
            <div className="detail-guest-engagement-copy">
              登录后可以点赞、收藏和发布子帖，继续参与这条讨论。
            </div>
            <button
              type="button"
              className="detail-guest-engagement-login"
              onClick={openLoginForEngagement}
            >
              登录参与
            </button>
          </div>
        )}
      </div>

      {!activeSubPostTarget && showTopSubPostComposer && (
        <form
          ref={subPostComposerRef}
          className="sub-post-form sub-post-pop-form"
          onSubmit={submitSubPost}
        >
          <textarea
            ref={subPostTextareaRef}
            placeholder={isLoggedIn ? "写下你的子帖..." : "请先登录后再发布子帖"}
            value={subPostInput}
            onChange={(event) => setSubPostInput(event.target.value)}
            maxLength={1000}
            rows={4}
            disabled={!isLoggedIn || submittingSubPost}
          />
          <SubPostMediaDraft
            mediaAssets={subPostMediaAssets}
            uploading={uploadingSubPostMedia}
            uploadStatus={subPostMediaUploadStatus}
            uploadStatusId={TOP_SUB_POST_MEDIA_UPLOAD_STATUS_ID}
            onMediaPicked={onSubPostMediaPicked}
            onRetryFailedUploads={retryFailedSubPostMediaUploads}
            onRefreshMediaAssets={refreshSubPostMediaAssets}
            removeMediaAt={removeSubPostMediaAt}
            disabled={!isLoggedIn || submittingSubPost}
          />
          <div className="post-sub-post-form-foot">
            <span className="sub-post-count">{subPostInput.trim().length}/1000</span>
            <div className="inline-sub-post-actions-right">
              <button
                type="button"
                className="neo-btn small"
                onClick={cancelTopSubPostComposer}
                disabled={submittingSubPost}
              >
                取消
              </button>
              <button
                type="submit"
                className="neo-btn small secondary"
                disabled={!isLoggedIn || submittingSubPost || uploadingSubPostMedia}
                aria-describedby={uploadingSubPostMedia ? TOP_SUB_POST_MEDIA_UPLOAD_STATUS_ID : undefined}
              >
                {submittingSubPost ? "提交中..." : (uploadingSubPostMedia ? "上传中..." : "发布子帖")}
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}
