import UiIcon from "../../../../shared/components/UiIcon";
import { buildRecoveryControlState } from "../../../../shared/state/recoveryControl";
import { buildSubPostSummaryText } from "../../../../shared/platform/postSummaryText";
import ResponsiveImage from "../../../../shared/media/ResponsiveImage";
import SubPostMediaDraft, {
  isSubPostMediaSourceReady,
  normalizeSubPostMediaSources,
  subPostMediaImageUrl,
} from "./SubPostMediaDraft";
import {
  normalizeMainPostId,
  resolveMainPostId,
} from "../../state/mainPostIdentityHelpers";
import "./SubPostPanel.css";

const INLINE_SUB_POST_MEDIA_UPLOAD_STATUS_ID = "inline-sub-post-media-upload-status";

export function buildSubPostEmptyState({ isLoggedIn, selectedPost }) {
  const canTargetPost = resolveMainPostId(selectedPost) > 0;
  if (!canTargetPost) {
    return {
      message: "还没有子帖。",
      showLoginAction: false,
      actionLabel: "",
    };
  }
  if (isLoggedIn) {
    return {
      message: "还没有子帖，来抢首帖吧。",
      showLoginAction: false,
      actionLabel: "",
    };
  }
  return {
    message: "还没有子帖。登录后可以抢首帖，参与这条讨论。",
    showLoginAction: true,
    actionLabel: "登录参与",
  };
}

export function buildGuestDiscussionPromptState({
  isLoggedIn,
  selectedPost,
  subPostCount,
} = {}) {
  const canTargetPost = resolveMainPostId(selectedPost) > 0;
  const hasDiscussion = Number(subPostCount || 0) > 0;
  if (isLoggedIn || !canTargetPost || !hasDiscussion) {
    return {
      show: false,
      message: "",
      actionLabel: "",
    };
  }
  return {
    show: true,
    message: "想加入这串讨论？登录后可以回复任意子帖。",
    actionLabel: "登录参与",
  };
}

function resolveSubPostPanelItemId(subPost) {
  return normalizeMainPostId(subPost?.id) || normalizeMainPostId(subPost?.subPostId);
}

export function buildSubPostsFailureState(errorText) {
  const normalized = String(errorText || "").trim();
  return {
    message: normalized || "子帖加载失败，请稍后重试。",
    actionLabel: "重试读取子帖",
  };
}

export function buildSubPostsLoadMoreFailureState(errorText) {
  const normalized = String(errorText || "").trim();
  return {
    message: normalized || "更多子帖加载失败，请稍后重试。",
    actionLabel: "重试加载更多",
  };
}

export function shouldShowSubPostsFailureState({
  subPostsError,
  loadingSubPosts,
  targetSubPostStatus,
} = {}) {
  if (!String(subPostsError || "").trim() || loadingSubPosts) {
    return false;
  }
  return targetSubPostStatus?.kind !== "error";
}

export function shouldShowSubPostsLoadMoreFailureState({
  loadingMoreSubPostsError,
  loadingMoreSubPosts,
} = {}) {
  return Boolean(String(loadingMoreSubPostsError || "").trim()) && !loadingMoreSubPosts;
}

export function shouldShowSubPostEmptyState({
  loadingSubPosts,
  showSubPostsError,
  targetSubPostStatus,
  subPostCount,
} = {}) {
  if (loadingSubPosts || showSubPostsError || targetSubPostStatus?.message) {
    return false;
  }
  return Number(subPostCount || 0) <= 0;
}

export function buildSubPostsRetryControlState({ loadingSubPosts, actionLabel } = {}) {
  return buildRecoveryControlState({
    isBusy: loadingSubPosts,
    idleLabel: actionLabel || "重试读取子帖",
  });
}

export function buildTargetSubPostRetryControlState({
  targetSubPostStatus,
  loadingSubPosts,
  loadingMoreSubPosts,
} = {}) {
  if (!targetSubPostStatus?.actionLabel) {
    return {
      disabled: false,
      label: "",
    };
  }
  const retryAction = targetSubPostStatus.retryAction || "loadMore";
  const isRetrying = retryAction === "scrollToTarget" || retryAction === "clearTarget"
    ? false
    : (retryAction === "reload"
        ? Boolean(loadingSubPosts)
        : Boolean(loadingMoreSubPosts));
  return buildRecoveryControlState({
    isBusy: isRetrying,
    idleLabel: targetSubPostStatus.actionLabel,
  });
}

export function buildSubPostMoreMenuId(menuKey) {
  const safeKey = String(menuKey || "current").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `sub-post-more-menu-${safeKey || "current"}`;
}

function normalizeSubPostKeyPart(value, fallback = "current") {
  const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
  return normalized || fallback;
}

export function buildSubPostMoreMenuKey({ parentSubPostId, subPostId } = {}) {
  const safeSubPostId = normalizeSubPostKeyPart(subPostId);
  if (parentSubPostId) {
    return `sub-${normalizeSubPostKeyPart(parentSubPostId)}-${safeSubPostId}`;
  }
  return `main-${safeSubPostId}`;
}

export function buildSubPostComposerInstanceId({ parentSubPostId, subPostId } = {}) {
  const safeSubPostId = normalizeSubPostKeyPart(subPostId);
  if (parentSubPostId) {
    return `branch-${normalizeSubPostKeyPart(parentSubPostId)}-${safeSubPostId}`;
  }
  return `floor-${safeSubPostId}`;
}

export function buildSubPostFloorDomId(subPostId) {
  return `sub-post-floor-${normalizeSubPostKeyPart(subPostId)}`;
}

export function resolveSubPostAuthorIdentity(subPost) {
  return String(subPost?.author || subPost?.authorUsername || "").trim();
}

export function resolveSubPostDisplayAuthor(subPost) {
  return resolveSubPostAuthorIdentity(subPost) || "未知用户";
}

export function resolveSubPostReferenceAuthor(subPost) {
  return String(
    subPost?.targetSubPostAuthor
      || subPost?.targetSubPostAuthorUsername
      || subPost?.parentSubPostAuthor
      || subPost?.parentSubPostAuthorUsername
      || "",
  ).trim();
}

export function buildSubPostReferenceViewModel(subPost, quotePreview) {
  const author = resolveSubPostReferenceAuthor(subPost);
  const isDeleted = Boolean(subPost?.targetSubPostDeleted);
  if (!author && !isDeleted) {
    return {
      shouldShow: false,
      author: "",
      preview: "",
    };
  }
  const preview = quotePreview?.(subPost?.targetSubPostPreview) || "";
  return {
    shouldShow: true,
    author,
    preview,
  };
}

export function canCurrentUserDeleteSubPost(subPost, currentUser) {
  const author = resolveSubPostAuthorIdentity(subPost);
  const user = String(currentUser || "").trim();
  return Boolean(author && user && author === user);
}

function buildClassName(...parts) {
  return parts.filter(Boolean).join(" ");
}

export {
  isSubPostMediaSourceReady,
  normalizeSubPostMediaSources,
  subPostMediaImageUrl,
};

export function buildSubPostFloorViewState({
  subPostId,
  targetSubPostStatus,
  baseClassName = "sub-post-root-thread",
} = {}) {
  const normalizedSubPostId = normalizeMainPostId(subPostId);
  const normalizedTargetSubPostId = normalizeMainPostId(
    targetSubPostStatus?.targetSubPostId,
  );
  const isTargetLocation = Boolean(
    targetSubPostStatus?.kind === "located"
      && normalizedSubPostId
      && normalizedSubPostId === normalizedTargetSubPostId,
  );
  return {
    className: buildClassName(
      baseClassName,
      isTargetLocation ? "is-target-location" : "",
    ),
    ariaCurrent: isTargetLocation ? "location" : undefined,
  };
}

export function buildSubPostTextViewModel(subPost) {
  const content = String(subPost?.content || "").trim();
  if (content) {
    return {
      shouldShow: true,
      text: content,
      className: "sub-post-text",
    };
  }
  const mediaSummary = buildSubPostSummaryText({ subPost });
  return mediaSummary
    ? {
      shouldShow: true,
      text: mediaSummary,
      className: "sub-post-text sub-post-text-media-only",
    }
    : {
      shouldShow: false,
      text: "",
      className: "sub-post-text",
    };
}

export function resolveSubPostFloorTargetStatus({
  targetSubPostStatus,
  targetSubPostId,
} = {}) {
  if (targetSubPostStatus) {
    return targetSubPostStatus;
  }
  const normalizedTargetSubPostId = normalizeMainPostId(targetSubPostId);
  if (!normalizedTargetSubPostId) {
    return null;
  }
  return {
    kind: "located",
    targetSubPostId: normalizedTargetSubPostId,
  };
}

export function buildSubPostMoreMenuActionItems({
  subPost,
  canDelete,
  actionButtonClassName = "sub-post-action-btn",
} = {}) {
  const favoritedByMe = Boolean(subPost?.favoritedByMe);
  const items = [
    {
      key: "favorite",
      className: buildClassName(
        actionButtonClassName,
        "more-expand",
        "favorite",
        favoritedByMe ? "is-active" : "",
      ),
      title: favoritedByMe ? "取消收藏" : "收藏",
      ariaLabel: favoritedByMe ? "取消收藏" : "收藏",
      icon: favoritedByMe ? "star-filled" : "star",
    },
    {
      key: "share",
      className: buildClassName(actionButtonClassName, "more-expand", "share"),
      title: "分享这条子帖",
      ariaLabel: "分享这条子帖",
      icon: "share",
    },
    {
      key: "report",
      className: buildClassName(actionButtonClassName, "more-expand", "report"),
      title: "举报",
      ariaLabel: "举报",
      icon: "flag",
    },
  ];

  if (canDelete) {
    items.push({
      key: "delete",
      className: buildClassName(actionButtonClassName, "more-expand", "danger"),
      title: "删除子帖",
      ariaLabel: "删除子帖",
      icon: "close",
    });
  }

  return items;
}

export function runSubPostMoreMenuAction(action, closeMenu, menuKey) {
  action?.();
  closeMenu?.(menuKey);
}

export function getSubPostMoreMenuNavigationTarget({ key, currentIndex, itemCount }) {
  if (
    !Number.isInteger(currentIndex)
    || !Number.isInteger(itemCount)
    || itemCount <= 0
    || currentIndex < 0
    || currentIndex >= itemCount
  ) {
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

export default function SubPostPanel({
  listProps,
  managementProps,
  composerProps,
  interactionProps,
  helperProps,
}) {
  const {
    loadingSubPosts,
    subPostsError,
    loadingMoreSubPosts,
    loadingMoreSubPostsError,
    subPostsHasMore,
    loadMoreSubPosts,
    reloadCurrentSubPosts,
    selectedPost,
    subPosts,
    orderedSubPostFloors,
    subPostNodeMap,
    targetSubPostStatus,
    targetSubPostId,
  } = listProps;
  const {
    allowPostManagement,
    currentUser: managementCurrentUser,
    openEditComposer,
    deletePost,
  } = managementProps;
  const {
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
    isLoggedIn,
    startNestedSubPostComposer,
    cancelNestedSubPostComposer,
    requireAuthNotice,
    openAuthModal,
  } = composerProps;
  const {
    collapsedSubPostBranches,
    subPostMoreMenuId,
    toggleSubPostBranches,
    jumpToSubPostFloor,
    clearTargetSubPostLocation,
    toggleSubPostMoreMenu,
    handleSubPostFavoriteFromMenu,
    handleSubPostShareFromMenu,
    copyTargetSubPostLink,
    handleSubPostReport,
    toggleSubPostLike,
    deleteSubPost,
    currentUser,
  } = interactionProps;
  const { authorInitial, formatTime, subPostQuotePreview } = helperProps;
  const canManageMainPost = Boolean(
    allowPostManagement &&
    selectedPost &&
    managementCurrentUser &&
    selectedPost.author === managementCurrentUser,
  );
  const emptyState = buildSubPostEmptyState({ isLoggedIn, selectedPost });
  const guestDiscussionPrompt = buildGuestDiscussionPromptState({
    isLoggedIn,
    selectedPost,
    subPostCount: subPosts.length,
  });
  const failureState = buildSubPostsFailureState(subPostsError);
  const loadMoreFailureState = buildSubPostsLoadMoreFailureState(loadingMoreSubPostsError);
  const showLoadMoreError = shouldShowSubPostsLoadMoreFailureState({
    loadingMoreSubPostsError,
    loadingMoreSubPosts,
  });
  const showTargetSubPostStatus = Boolean(targetSubPostStatus?.message);
  const showSubPostsError = shouldShowSubPostsFailureState({
    subPostsError,
    loadingSubPosts,
    targetSubPostStatus,
  });
  const showSubPostEmptyState = shouldShowSubPostEmptyState({
    loadingSubPosts,
    showSubPostsError,
    targetSubPostStatus,
    subPostCount: subPosts.length,
  });
  const subPostsRetryControl = buildSubPostsRetryControlState({
    loadingSubPosts,
    actionLabel: failureState.actionLabel,
  });
  const targetSubPostRetryControl = buildTargetSubPostRetryControlState({
    targetSubPostStatus,
    loadingSubPosts,
    loadingMoreSubPosts,
  });

  function openLoginFromEmptyState() {
    requireAuthNotice?.();
    openAuthModal?.("login");
  }

  function openLoginFromDiscussionPrompt() {
    requireAuthNotice?.();
    openAuthModal?.("login");
  }

  function retrySubPosts() {
    reloadCurrentSubPosts?.();
  }

  function retryLoadMoreSubPosts() {
    loadMoreSubPosts?.();
  }

  function retryTargetSubPostLocation() {
    if (targetSubPostStatus?.retryAction === "scrollToTarget") {
      jumpToSubPostFloor?.(targetSubPostStatus.targetSubPostId);
      return;
    }
    if (targetSubPostStatus?.retryAction === "clearTarget") {
      clearTargetSubPostLocation?.();
      return;
    }
    if (targetSubPostStatus?.retryAction === "reload") {
      reloadCurrentSubPosts?.();
      return;
    }
    loadMoreSubPosts?.();
  }

  function handleSubPostMoreMenuKeyDown(event) {
    const menu = event.currentTarget;
    const menuItems = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    const currentIndex = menuItems.indexOf(event.target);
    const targetIndex = getSubPostMoreMenuNavigationTarget({
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

  function runSubPostMoreAction(actionKey, subPost, menuKey) {
    const subPostId = resolveSubPostPanelItemId(subPost);
    if (actionKey === "favorite") {
      runSubPostMoreMenuAction(
        () => handleSubPostFavoriteFromMenu(subPostId, Boolean(subPost.favoritedByMe)),
        toggleSubPostMoreMenu,
        menuKey,
      );
      return;
    }
    if (actionKey === "share") {
      runSubPostMoreMenuAction(
        () => handleSubPostShareFromMenu?.(subPostId),
        toggleSubPostMoreMenu,
        menuKey,
      );
      return;
    }
    if (actionKey === "report") {
      runSubPostMoreMenuAction(
        handleSubPostReport,
        toggleSubPostMoreMenu,
        menuKey,
      );
      return;
    }
    if (actionKey === "delete") {
      runSubPostMoreMenuAction(
        () => deleteSubPost(subPost),
        toggleSubPostMoreMenu,
        menuKey,
      );
    }
  }

  function renderSubPostMoreControl({
    subPost,
    menuKey,
    menuId,
    actionButtonClassName,
    canDelete,
  }) {
    if (subPostMoreMenuId !== menuKey) {
      return (
        <button
          type="button"
          className={`${actionButtonClassName} more-btn`}
          onClick={() => toggleSubPostMoreMenu(menuKey)}
          title="更多"
          aria-controls={menuId}
          aria-expanded={false}
          aria-haspopup="menu"
          aria-label="更多"
        >
          <span className="action-icon">
            <UiIcon name="more" />
          </span>
        </button>
      );
    }

    return (
      <div
        id={menuId}
        className="sub-post-more-menu"
        role="menu"
        aria-label="子帖更多操作"
        onKeyDown={handleSubPostMoreMenuKeyDown}
      >
        {buildSubPostMoreMenuActionItems({
          subPost,
          canDelete,
          actionButtonClassName,
        }).map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.className}
            role="menuitem"
            onClick={() => runSubPostMoreAction(item.key, subPost, menuKey)}
            title={item.title}
            aria-label={item.ariaLabel}
          >
            <span className="action-icon">
              <UiIcon name={item.icon} />
            </span>
          </button>
        ))}
      </div>
    );
  }

  function renderMetricBadges({ likeCount, favoriteCount }) {
    const safeLikeCount = Number(likeCount || 0);
    const safeFavoriteCount = Number(favoriteCount || 0);
    if (safeLikeCount <= 0 && safeFavoriteCount <= 0) {
      return null;
    }
    return (
      <div className="sub-post-left-metrics">
        {safeLikeCount > 0 && (
          <span className="sub-post-left-badge like" title={`点赞 ${safeLikeCount}`}>
            <span className="action-icon">
              <UiIcon name="heart-filled" />
            </span>
            <span className="action-count">{safeLikeCount}</span>
          </span>
        )}
        {safeFavoriteCount > 0 && (
          <span className="sub-post-left-badge favorite" title={`收藏 ${safeFavoriteCount}`}>
            <span className="action-icon">
              <UiIcon name="star-filled" />
            </span>
            <span className="action-count">{safeFavoriteCount}</span>
          </span>
        )}
      </div>
    );
  }

  function renderSubPostMedia(subPost, labelPrefix) {
    const mediaSources = normalizeSubPostMediaSources(subPost).slice(0, 6);
    if (mediaSources.length === 0) {
      return null;
    }
    const countClass = `count-${Math.min(3, mediaSources.length)}`;
    return (
      <div className={`sub-post-media-grid ${countClass}`}>
        {mediaSources.map((mediaSource, mediaIndex) => {
          const imageUrl = subPostMediaImageUrl(mediaSource);
          const processingStatus = String(mediaSource.processingStatus || "READY").toUpperCase();
          const statusLabel = processingStatus === "PROCESSING"
            ? "图片处理中"
            : (processingStatus === "FAILED" ? "处理失败" : "");
          const statusClass = `is-${processingStatus.toLowerCase()}`;
          return (
            <div
              key={`${resolveSubPostPanelItemId(subPost) || subPost?.id || "sub-post"}-${mediaIndex}`}
              className={`sub-post-media-item ${imageUrl ? "" : "is-status-placeholder"}`}
            >
              {imageUrl ? (
                <ResponsiveImage
                  src={imageUrl}
                  source={mediaSource}
                  alt={`${labelPrefix}图片 ${mediaIndex + 1}`}
                  className="sub-post-media-image"
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                />
              ) : (
                <span className="sub-post-media-placeholder" role="status">
                  {statusLabel || "图片暂不可用"}
                </span>
              )}
              {statusLabel && (
                <span className={`sub-post-media-status ${statusClass}`}>
                  {statusLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderInlineSubPostForm(targetId, composerInstanceId) {
    if (
      activeSubPostTarget?.id !== targetId
      || activeSubPostTarget?.composerInstanceId !== composerInstanceId
    ) {
      return null;
    }
    return (
      <form className="inline-sub-post-form" onSubmit={submitSubPost}>
        <textarea
          autoFocus
          placeholder="写下你的子帖..."
          value={subPostInput}
          onChange={(event) => setSubPostInput(event.target.value)}
          maxLength={1000}
          rows={3}
          disabled={!isLoggedIn || submittingSubPost}
        />
        <SubPostMediaDraft
          mediaAssets={subPostMediaAssets}
          uploading={uploadingSubPostMedia}
          uploadStatus={subPostMediaUploadStatus}
          uploadStatusId={INLINE_SUB_POST_MEDIA_UPLOAD_STATUS_ID}
          onMediaPicked={onSubPostMediaPicked}
          onRetryFailedUploads={retryFailedSubPostMediaUploads}
          onRefreshMediaAssets={refreshSubPostMediaAssets}
          removeMediaAt={removeSubPostMediaAt}
          disabled={!isLoggedIn || submittingSubPost}
        />
        <div className="inline-sub-post-actions">
          <span className="sub-post-count">{subPostInput.trim().length}/1000</span>
          <div className="btn-group">
            <button
              type="button"
              className="neo-btn small"
              onClick={cancelNestedSubPostComposer}
            >
              取消
            </button>
            <button
              type="submit"
              className="neo-btn small secondary"
              disabled={!isLoggedIn || submittingSubPost || uploadingSubPostMedia}
              title={submittingSubPost ? "提交中..." : (uploadingSubPostMedia ? "上传中..." : "发布子帖")}
              aria-describedby={uploadingSubPostMedia ? INLINE_SUB_POST_MEDIA_UPLOAD_STATUS_ID : undefined}
            >
              {submittingSubPost ? "提交中..." : (uploadingSubPostMedia ? "上传中..." : "发布子帖")}
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderSubPostFloor(subPost) {
    const subPostId = resolveSubPostPanelItemId(subPost) || subPost.id;
    const subPostAuthor = resolveSubPostDisplayAuthor(subPost);
    const subPostReference = buildSubPostReferenceViewModel(
      subPost,
      subPostQuotePreview,
    );
    const subPostText = buildSubPostTextViewModel(subPost);
    const subPostNode = subPostNodeMap.get(subPostId) || subPostNodeMap.get(subPost.id);
    const branchSubPosts = Array.isArray(subPostNode?.branchSubPosts)
      ? subPostNode.branchSubPosts
      : [];
    const hasBranches = branchSubPosts.length > 0;
    const isCollapsed = Boolean(collapsedSubPostBranches[subPostId]);
    const metricBadges = renderMetricBadges({
      likeCount: subPost.likeCount,
      favoriteCount: subPost.favoriteCount,
    });
    const mainMoreMenuKey = buildSubPostMoreMenuKey({ subPostId });
    const mainMoreMenuId = buildSubPostMoreMenuId(mainMoreMenuKey);
    const floorComposerInstanceId = buildSubPostComposerInstanceId({
      subPostId,
    });
    const canDeleteSubPost = canCurrentUserDeleteSubPost(subPost, currentUser);
    const floorViewState = buildSubPostFloorViewState({
      subPostId,
      targetSubPostStatus: resolveSubPostFloorTargetStatus({
        targetSubPostStatus,
        targetSubPostId,
      }),
    });
    const isTargetFloor = floorViewState.ariaCurrent === "location";

    return (
      <div
        id={buildSubPostFloorDomId(subPostId)}
        key={subPostId}
        className={floorViewState.className}
        aria-current={floorViewState.ariaCurrent}
      >
        <article
          className={`sub-post-item main-sub-post ${hasBranches ? "has-branches" : ""}`}
        >
          <div className="sub-post-head-row">
            <div className="sub-post-user">
              <div className="sub-post-avatar">{authorInitial(subPostAuthor)}</div>
              <div className="sub-post-user-meta">
                <strong className="sub-post-author-name">{subPostAuthor}</strong>
              </div>
              {isTargetFloor && (
                <span className="sub-post-target-floor-badge">定位</span>
              )}
            </div>
            <span className="sub-post-time-floor">
              {formatTime(subPost.createdAt, subPost.createdAtText)}
            </span>
          </div>

          {subPostReference.shouldShow && (
            <div className="sub-post-reference">
              <p>
                {subPostReference.author && (
                  <strong className="sub-post-reference-author">
                    @{subPostReference.author}
                  </strong>
                )}
                <span className="sub-post-reference-text">
                  {subPostReference.preview}
                </span>
              </p>
            </div>
          )}

          {subPostText.shouldShow && (
            <p className={subPostText.className}>{subPostText.text}</p>
          )}
          {renderSubPostMedia(subPost, `${subPostAuthor} 的子帖`)}

          <div className="sub-post-actions sub-post-actions-bottom">
            <div className="sub-post-actions-left">
              {hasBranches ? (
                <button
                  type="button"
                  className="sub-post-action-btn expand-btn"
                  onClick={() => toggleSubPostBranches(subPostId)}
                  title={isCollapsed ? "展开子帖" : "收起子帖"}
                >
                  <span className="action-icon">
                    <UiIcon name={isCollapsed ? "chevron-down" : "chevron-up"} />
                  </span>
                  <span className="action-count">{branchSubPosts.length}</span>
                </button>
              ) : null}

              {metricBadges ? (
                <div
                  className={`sub-post-left-metrics-wrap ${hasBranches ? "with-anchor" : ""}`}
                >
                  {metricBadges}
                </div>
              ) : !hasBranches ? (
                <span className="sub-post-left-empty" aria-hidden="true" />
              ) : null}
            </div>

            <div className="sub-post-actions-right">
              <button
                type="button"
                className={`sub-post-action-btn ${subPost.likedByMe ? "is-active" : ""}`}
                onClick={() =>
                  toggleSubPostLike(subPostId, Boolean(subPost.likedByMe), subPostAuthor)
                }
                title={subPost.likedByMe ? "取消点赞" : "点赞"}
              >
                <span className="action-icon">
                  <UiIcon name={subPost.likedByMe ? "heart-filled" : "heart"} />
                </span>
              </button>

              <div className="sub-post-more-wrap">
                {renderSubPostMoreControl({
                  subPost,
                  menuKey: mainMoreMenuKey,
                  menuId: mainMoreMenuId,
                  actionButtonClassName: "sub-post-action-btn",
                  canDelete: canDeleteSubPost,
                })}
              </div>

              <button
                type="button"
                className="sub-post-action-btn sub-post-launch-btn"
                onClick={() => startNestedSubPostComposer(subPost, floorComposerInstanceId)}
                title={!isLoggedIn ? "请先登录后再发布子帖" : "发布子帖"}
              >
                <span className="action-icon">
                  <UiIcon name="sub-post" />
                </span>
              </button>
            </div>
          </div>

          {renderInlineSubPostForm(subPostId, floorComposerInstanceId)}
        </article>

        {hasBranches && !isCollapsed && (
          <div className="sub-post-sub-list-wrap">
            <div className="sub-post-sub-list">
              {branchSubPosts.map((branchSubPost) => {
                const branchSubPostId =
                  resolveSubPostPanelItemId(branchSubPost) || branchSubPost.id;
                const branchSubPostAuthor = resolveSubPostDisplayAuthor(branchSubPost);
                const branchMetricBadges = renderMetricBadges({
                  likeCount: branchSubPost.likeCount,
                  favoriteCount: branchSubPost.favoriteCount,
                });
                const subMoreMenuKey = buildSubPostMoreMenuKey({
                  parentSubPostId: subPostId,
                  subPostId: branchSubPostId,
                });
                const subMoreMenuId = buildSubPostMoreMenuId(subMoreMenuKey);
                const branchComposerInstanceId = buildSubPostComposerInstanceId({
                  parentSubPostId: subPostId,
                  subPostId: branchSubPostId,
                });
                const canDeleteBranchSubPost = canCurrentUserDeleteSubPost(
                  branchSubPost,
                  currentUser,
                );
                const branchSubPostText = buildSubPostTextViewModel(branchSubPost);
                const branchFloorViewState = buildSubPostFloorViewState({
                  subPostId: branchSubPostId,
                  targetSubPostStatus: resolveSubPostFloorTargetStatus({
                    targetSubPostStatus,
                    targetSubPostId,
                  }),
                  baseClassName: "sub-post-item sub-post-branch-item",
                });
                const isTargetBranchFloor = branchFloorViewState.ariaCurrent === "location";

                return (
                  <div
                    id={buildSubPostFloorDomId(branchSubPostId)}
                    key={`preview-${subPostId}-${branchSubPostId}`}
                    className={branchFloorViewState.className}
                    aria-current={branchFloorViewState.ariaCurrent}
                  >
                    <div className="sub-post-branch-head">
                      <div className="sub-post-avatar sub-avatar">
                        {authorInitial(branchSubPostAuthor)}
                      </div>
                      <strong className="sub-author">{branchSubPostAuthor}</strong>
                      {isTargetBranchFloor && (
                        <span className="sub-post-target-floor-badge">定位</span>
                      )}
                      <span className="sub-time">
                        {formatTime(branchSubPost.createdAt, branchSubPost.createdAtText)}
                      </span>
                    </div>

                    {branchSubPostText.shouldShow && (
                      <p className={branchSubPostText.className}>{branchSubPostText.text}</p>
                    )}
                    {renderSubPostMedia(branchSubPost, `${branchSubPostAuthor} 的子帖`)}

                    <div className="sub-post-actions sub-post-actions-bottom sub-sub-post-actions">
                      <div className="sub-post-actions-left">
                        <button
                          type="button"
                          className="sub-post-action-btn jump-btn"
                          onClick={() => jumpToSubPostFloor(branchSubPostId)}
                          title="跳转到该子帖"
                          aria-label="跳转到该子帖"
                        >
                          <span className="action-icon">
                            <UiIcon name="jump" />
                          </span>
                        </button>

                        {branchMetricBadges ? (
                          <div className="sub-post-left-metrics-wrap with-anchor">
                            {branchMetricBadges}
                          </div>
                        ) : (
                          <span className="sub-post-left-empty" aria-hidden="true" />
                        )}
                      </div>

                      <div className="sub-post-actions-right">
                        <button
                          type="button"
                          className={`sub-post-branch-action-btn ${branchSubPost.likedByMe ? "is-active" : ""}`}
                          onClick={() =>
                            toggleSubPostLike(
                              branchSubPostId,
                              Boolean(branchSubPost.likedByMe),
                              branchSubPostAuthor,
                            )
                          }
                          title={branchSubPost.likedByMe ? "取消点赞" : "点赞"}
                        >
                          <span className="action-icon">
                            <UiIcon
                              name={branchSubPost.likedByMe ? "heart-filled" : "heart"}
                            />
                          </span>
                        </button>

                        <div className="sub-post-more-wrap">
                          {renderSubPostMoreControl({
                            subPost: branchSubPost,
                            menuKey: subMoreMenuKey,
                            menuId: subMoreMenuId,
                            actionButtonClassName: "sub-post-branch-action-btn",
                            canDelete: canDeleteBranchSubPost,
                          })}
                        </div>

                        <button
                          type="button"
                          className="sub-post-branch-action-btn sub-post-launch-btn"
                          onClick={() =>
                            startNestedSubPostComposer(branchSubPost, branchComposerInstanceId)
                          }
                          title={!isLoggedIn ? "请先登录后再发布子帖" : "发布子帖"}
                        >
                          <span className="action-icon">
                            <UiIcon name="sub-post" />
                          </span>
                        </button>
                      </div>
                    </div>

                    {renderInlineSubPostForm(
                      branchSubPostId,
                      branchComposerInstanceId,
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="sub-post-panel detail-section-block">
      {(loadingSubPosts ||
        showSubPostsError ||
        showTargetSubPostStatus ||
        showSubPostEmptyState ||
        guestDiscussionPrompt.show ||
        canManageMainPost) && (
        <div className="sub-post-panel-head">
          <div className="sub-post-panel-status">
            {loadingSubPosts && <p className="paper-inline-status side-empty">正在读取子帖...</p>}
            {!loadingSubPosts && showTargetSubPostStatus && (
              <div
                className={`sub-post-target-state ${targetSubPostStatus.kind || ""}`}
                role="status"
                aria-live="polite"
              >
                <span className="sub-post-target-message">{targetSubPostStatus.message}</span>
                {targetSubPostStatus.description && (
                  <span className="sub-post-target-description">
                    {targetSubPostStatus.description}
                  </span>
                )}
                {(targetSubPostStatus.targetAuthor || targetSubPostStatus.targetPreview) && (
                  <span className="sub-post-target-preview">
                    {targetSubPostStatus.targetAuthor && (
                      <strong className="sub-post-target-preview-author">
                        @{targetSubPostStatus.targetAuthor}
                      </strong>
                    )}
                    {targetSubPostStatus.targetPreview && (
                      <span className="sub-post-target-preview-text">
                        {targetSubPostStatus.targetPreview}
                      </span>
                    )}
                  </span>
                )}
                {targetSubPostStatus.actionLabel && (
                  <button
                    type="button"
                    className="sub-post-target-retry"
                    onClick={retryTargetSubPostLocation}
                    disabled={targetSubPostRetryControl.disabled}
                  >
                    {targetSubPostRetryControl.label}
                  </button>
                )}
                {targetSubPostStatus.copyActionLabel && (
                  <button
                    type="button"
                    className="sub-post-target-copy"
                    onClick={() =>
                      copyTargetSubPostLink?.(targetSubPostStatus.targetSubPostId)
                    }
                  >
                    {targetSubPostStatus.copyActionLabel}
                  </button>
                )}
              </div>
            )}
            {showSubPostsError && (
              <div className="sub-post-failure-state" role="status" aria-live="polite">
                <p className="paper-inline-status side-empty">{failureState.message}</p>
                <button
                  type="button"
                  className="sub-post-retry"
                  onClick={retrySubPosts}
                  disabled={subPostsRetryControl.disabled}
                >
                  {subPostsRetryControl.label}
                </button>
              </div>
            )}
            {showSubPostEmptyState && (
              <div className="sub-post-empty-state">
                <p className="paper-inline-status side-empty">{emptyState.message}</p>
                {emptyState.showLoginAction && (
                  <button
                    type="button"
                    className="sub-post-empty-login"
                    onClick={openLoginFromEmptyState}
                  >
                    {emptyState.actionLabel}
                  </button>
                )}
              </div>
            )}
            {!loadingSubPosts && guestDiscussionPrompt.show && (
              <div className="sub-post-guest-discussion" role="note">
                <span>{guestDiscussionPrompt.message}</span>
                <button
                  type="button"
                  className="sub-post-guest-discussion-login"
                  onClick={openLoginFromDiscussionPrompt}
                >
                  {guestDiscussionPrompt.actionLabel}
                </button>
              </div>
            )}
          </div>
          {canManageMainPost && (
            <div className="btn-group">
              <button
                type="button"
                className="post-detail-manage-btn"
                onClick={() => openEditComposer(selectedPost)}
              >
                编辑
              </button>
              <button
                type="button"
                className="post-detail-manage-btn danger"
                onClick={() => deletePost(selectedPost)}
              >
                删除
              </button>
            </div>
          )}
        </div>
      )}
      {!loadingSubPosts && subPosts.length > 0 && (
        <div className="sub-post-list">
          {orderedSubPostFloors.map((subPost) => renderSubPostFloor(subPost))}
          {subPostsHasMore && showLoadMoreError && (
            <div className="sub-post-load-more-failure" role="status" aria-live="polite">
              <span>{loadMoreFailureState.message}</span>
              <button
                type="button"
                className="sub-post-load-more-retry"
                onClick={retryLoadMoreSubPosts}
              >
                {loadMoreFailureState.actionLabel}
              </button>
            </div>
          )}
          {subPostsHasMore && !showLoadMoreError && (
            <button
              type="button"
              className="sub-post-load-more"
              onClick={() => loadMoreSubPosts?.()}
              disabled={loadingMoreSubPosts}
            >
              {loadingMoreSubPosts ? "正在加载更多内容..." : "查看更多子帖"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
