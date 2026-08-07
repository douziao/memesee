import { describe, expect, it } from "vitest";
import {
  buildDetailInteractionProps,
  buildDetailStatusProps,
  buildSubPostPanelProps,
} from "./appLayoutDetailSectionBuilders";

describe("buildDetailStatusProps", () => {
  it("passes retry and home recovery actions to the post detail status view", () => {
    const refreshCurrentPostThread = () => {};
    const backToLatest = () => {};

    expect(buildDetailStatusProps({
      detail: {
        loadingPostDetail: false,
        refreshingCurrentPostThread: false,
        postDetailErrorType: "load_failed",
        selectedPost: null,
        refreshCurrentPostThread,
      },
      actions: {
        backToLatest,
      },
    })).toEqual({
      loadingPostDetail: false,
      refreshingCurrentPostThread: false,
      postDetailErrorType: "load_failed",
      selectedPost: null,
      refreshCurrentPostThread,
      backToLatest,
    });
  });
});

describe("buildDetailInteractionProps", () => {
  it("passes the login modal action to guest-facing post detail interactions", () => {
    const openAuthModal = () => {};
    const isSharingPost = () => false;
    const retryFailedSubPostMediaUploads = () => {};
    const refreshSubPostMediaAssets = () => {};
    const props = buildDetailInteractionProps({
      shell: {
        isLoggedIn: false,
        route: {
          type: "post",
          mainPostId: 42,
          targetSubPostId: 7,
        },
      },
      detail: {
        selectedLikeCount: 0,
        selectedFavoriteCount: 0,
        togglePostLike: () => {},
        togglePostFavorite: () => {},
        handlePostReport: () => {},
      },
      subPostThread: {
        openMainPostSubPostComposer: () => {},
        requireAuthNotice: () => {},
        showTopSubPostComposer: false,
        activeSubPostTarget: null,
        subPostInput: "",
        setSubPostInput: () => {},
        submittingSubPost: false,
        submitSubPost: () => {},
        retryFailedSubPostMediaUploads,
        refreshSubPostMediaAssets,
        cancelTopSubPostComposer: () => {},
      },
      refs: {
        subPostComposerRef: { current: null },
        subPostTextareaRef: { current: null },
      },
      actions: {
        sharePost: () => {},
        isSharingPost,
      },
      helpers: {
        formatHeatScore: () => "",
        formatTime: () => "",
      },
      auth: {
        openAuthModal,
      },
    });

    expect(props.actionProps.openAuthModal).toBe(openAuthModal);
    expect(props.actionProps.isSharingPost).toBe(isSharingPost);
    expect(props.actionProps.targetSubPostId).toBe(7);
    expect(props.composerProps.retryFailedSubPostMediaUploads)
      .toBe(retryFailedSubPostMediaUploads);
    expect(props.composerProps.refreshSubPostMediaAssets)
      .toBe(refreshSubPostMediaAssets);
  });

  it("falls back to ordinary post sharing when the target sub-post is confirmed missing", () => {
    const props = buildDetailInteractionProps({
      shell: {
        isLoggedIn: false,
        route: {
          type: "post",
          mainPostId: 42,
          targetSubPostId: 404,
        },
      },
      detail: {
        selectedLikeCount: 0,
        selectedFavoriteCount: 0,
        togglePostLike: () => {},
        togglePostFavorite: () => {},
        handlePostReport: () => {},
      },
      subPostThread: {
        targetSubPostStatus: {
          kind: "missing",
          targetSubPostId: 404,
        },
        openMainPostSubPostComposer: () => {},
        requireAuthNotice: () => {},
        showTopSubPostComposer: false,
        activeSubPostTarget: null,
        subPostInput: "",
        setSubPostInput: () => {},
        submittingSubPost: false,
        submitSubPost: () => {},
        cancelTopSubPostComposer: () => {},
      },
      refs: {
        subPostComposerRef: { current: null },
        subPostTextareaRef: { current: null },
      },
      actions: {
        sharePost: () => {},
        isSharingPost: () => false,
      },
      helpers: {
        formatHeatScore: () => "",
        formatTime: () => "",
      },
      auth: {},
    });

    expect(props.actionProps.targetSubPostId).toBe(0);
  });
});

describe("buildSubPostPanelProps", () => {
  it("passes the login modal action to empty discussion state props", () => {
    const openAuthModal = () => {};
    const reloadCurrentSubPosts = () => {};
    const handleSubPostShareFromMenu = () => {};
    const copyTargetSubPostLink = () => {};
    const retryFailedSubPostMediaUploads = () => {};
    const refreshSubPostMediaAssets = () => {};
    const targetSubPostStatus = {
      kind: "missing",
      message: "未找到这条子帖，可能已被删除或暂不可见。",
    };
    const props = buildSubPostPanelProps({
      shell: {
        route: { type: "post" },
        currentUser: "",
        isLoggedIn: false,
      },
      detail: {
        loadingSubPosts: false,
        subPostsError: "子帖加载失败，请稍后重试。",
        loadingMoreSubPosts: false,
        loadingMoreSubPostsError: "更多子帖加载失败，请稍后重试。",
        subPostsHasMore: false,
        loadMoreSubPosts: () => {},
        reloadCurrentSubPosts,
        selectedPost: { id: 42, author: "owner" },
        subPosts: [],
        orderedSubPostFloors: [],
        subPostNodeMap: new Map(),
      },
      subPostThread: {
        activeSubPostTarget: null,
        subPostInput: "",
        setSubPostInput: () => {},
        submittingSubPost: false,
        submitSubPost: () => {},
        retryFailedSubPostMediaUploads,
        refreshSubPostMediaAssets,
        startNestedSubPostComposer: () => {},
        cancelNestedSubPostComposer: () => {},
        requireAuthNotice: () => {},
        collapsedSubPostBranches: {},
        subPostMoreMenuId: "",
        toggleSubPostBranches: () => {},
        jumpToSubPostFloor: () => {},
        toggleSubPostMoreMenu: () => {},
        handleSubPostFavoriteFromMenu: () => {},
        handleSubPostShareFromMenu,
        copyTargetSubPostLink,
        handleSubPostReport: () => {},
        toggleSubPostLike: () => {},
        deleteSubPost: () => {},
        targetSubPostStatus,
      },
      actions: {
        openEditComposer: () => {},
        deletePost: () => {},
      },
      helpers: {
        authorInitial: () => "",
        formatTime: () => "",
        subPostQuotePreview: () => "",
      },
      auth: {
        openAuthModal,
      },
    });

    expect(props.composerProps.openAuthModal).toBe(openAuthModal);
    expect(props.composerProps.retryFailedSubPostMediaUploads)
      .toBe(retryFailedSubPostMediaUploads);
    expect(props.composerProps.refreshSubPostMediaAssets)
      .toBe(refreshSubPostMediaAssets);
    expect(props.listProps.subPostsError).toBe("子帖加载失败，请稍后重试。");
    expect(props.listProps.loadingMoreSubPostsError).toBe("更多子帖加载失败，请稍后重试。");
    expect(props.listProps.reloadCurrentSubPosts).toBe(reloadCurrentSubPosts);
    expect(props.listProps.targetSubPostStatus).toBe(targetSubPostStatus);
    expect(props.interactionProps.handleSubPostShareFromMenu).toBe(handleSubPostShareFromMenu);
    expect(props.interactionProps.copyTargetSubPostLink).toBe(copyTargetSubPostLink);
  });
});
