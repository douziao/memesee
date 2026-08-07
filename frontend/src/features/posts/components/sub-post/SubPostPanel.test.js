import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SubPostPanel, {
  isSubPostMediaSourceReady,
  normalizeSubPostMediaSources,
  subPostMediaImageUrl,
} from "./SubPostPanel";
import SubPostMediaDraft from "./SubPostMediaDraft";
import {
  buildSubPostComposerInstanceId,
  buildSubPostFloorDomId,
  buildSubPostFloorViewState,
  buildSubPostMoreMenuActionItems,
  buildSubPostMoreMenuId,
  buildSubPostMoreMenuKey,
  buildSubPostReferenceViewModel,
  buildSubPostTextViewModel,
  canCurrentUserDeleteSubPost,
  resolveSubPostFloorTargetStatus,
  buildGuestDiscussionPromptState,
  buildSubPostEmptyState,
  buildSubPostsRetryControlState,
  buildSubPostsLoadMoreFailureState,
  buildSubPostsFailureState,
  buildTargetSubPostRetryControlState,
  getSubPostMoreMenuNavigationTarget,
  resolveSubPostDisplayAuthor,
  resolveSubPostAuthorIdentity,
  resolveSubPostReferenceAuthor,
  runSubPostMoreMenuAction,
  shouldShowSubPostEmptyState,
  shouldShowSubPostsLoadMoreFailureState,
  shouldShowSubPostsFailureState,
} from "./SubPostPanel";

describe("buildSubPostEmptyState", () => {
  it("keeps the direct first-reply copy for logged-in users", () => {
    expect(buildSubPostEmptyState({
      isLoggedIn: true,
      selectedPost: { id: 42 },
    })).toEqual({
      message: "还没有子帖，来抢首帖吧。",
      showLoginAction: false,
      actionLabel: "",
    });
  });

  it("offers a login CTA for guests on a loaded shared post", () => {
    expect(buildSubPostEmptyState({
      isLoggedIn: false,
      selectedPost: { id: 42 },
    })).toEqual({
      message: "还没有子帖。登录后可以抢首帖，参与这条讨论。",
      showLoginAction: true,
      actionLabel: "登录参与",
    });
  });

  it("offers a login CTA when the selected post only exposes postId", () => {
    expect(buildSubPostEmptyState({
      isLoggedIn: false,
      selectedPost: { postId: "42" },
    })).toEqual({
      message: "还没有子帖。登录后可以抢首帖，参与这条讨论。",
      showLoginAction: true,
      actionLabel: "登录参与",
    });
  });

  it("does not offer a login CTA when the post target is unusable", () => {
    expect(buildSubPostEmptyState({
      isLoggedIn: false,
      selectedPost: { id: "draft" },
    })).toEqual({
      message: "还没有子帖。",
      showLoginAction: false,
      actionLabel: "",
    });
  });
});

describe("buildGuestDiscussionPromptState", () => {
  it("offers a discussion-level login CTA for guests when replies already exist", () => {
    expect(buildGuestDiscussionPromptState({
      isLoggedIn: false,
      selectedPost: { id: 42 },
      subPostCount: 3,
    })).toEqual({
      show: true,
      message: "想加入这串讨论？登录后可以回复任意子帖。",
      actionLabel: "登录参与",
    });
  });

  it("accepts loaded posts that only expose postId", () => {
    expect(buildGuestDiscussionPromptState({
      isLoggedIn: false,
      selectedPost: { postId: "42" },
      subPostCount: 1,
    }).show).toBe(true);
  });

  it("hides the discussion CTA for logged-in users, empty threads, or unusable posts", () => {
    expect(buildGuestDiscussionPromptState({
      isLoggedIn: true,
      selectedPost: { id: 42 },
      subPostCount: 3,
    }).show).toBe(false);
    expect(buildGuestDiscussionPromptState({
      isLoggedIn: false,
      selectedPost: { id: 42 },
      subPostCount: 0,
    }).show).toBe(false);
    expect(buildGuestDiscussionPromptState({
      isLoggedIn: false,
      selectedPost: { id: "draft" },
      subPostCount: 3,
    }).show).toBe(false);
  });
});

describe("buildSubPostsFailureState", () => {
  it("uses a readable local retry message for sub-post load failures", () => {
    expect(buildSubPostsFailureState("子帖加载失败，请稍后重试。")).toEqual({
      message: "子帖加载失败，请稍后重试。",
      actionLabel: "重试读取子帖",
    });
  });

  it("falls back to a retryable sub-post error message", () => {
    expect(buildSubPostsFailureState("")).toEqual({
      message: "子帖加载失败，请稍后重试。",
      actionLabel: "重试读取子帖",
    });
  });
});

describe("buildSubPostsLoadMoreFailureState", () => {
  it("uses a readable bottom retry message for pagination failures", () => {
    expect(buildSubPostsLoadMoreFailureState("子帖加载失败，请稍后重试。")).toEqual({
      message: "子帖加载失败，请稍后重试。",
      actionLabel: "重试加载更多",
    });
  });

  it("falls back to a pagination-specific retry message", () => {
    expect(buildSubPostsLoadMoreFailureState("")).toEqual({
      message: "更多子帖加载失败，请稍后重试。",
      actionLabel: "重试加载更多",
    });
  });
});

describe("shouldShowSubPostsFailureState", () => {
  it("shows the generic sub-post failure when there is no shared target status", () => {
    expect(shouldShowSubPostsFailureState({
      subPostsError: "子帖加载失败，请稍后重试。",
      loadingSubPosts: false,
      targetSubPostStatus: null,
    })).toBe(true);
  });

  it("hides the generic failure behind a contextual shared target error", () => {
    expect(shouldShowSubPostsFailureState({
      subPostsError: "子帖加载失败，请稍后重试。",
      loadingSubPosts: false,
      targetSubPostStatus: {
        kind: "error",
        message: "目标子帖暂时没有定位成功。",
      },
    })).toBe(false);
  });

  it("does not hide ordinary failures behind loading or missing target notices", () => {
    expect(shouldShowSubPostsFailureState({
      subPostsError: "子帖加载失败，请稍后重试。",
      loadingSubPosts: false,
      targetSubPostStatus: {
        kind: "missing",
        message: "未找到这条子帖。",
      },
    })).toBe(true);

    expect(shouldShowSubPostsFailureState({
      subPostsError: "子帖加载失败，请稍后重试。",
      loadingSubPosts: true,
      targetSubPostStatus: {
        kind: "error",
        message: "目标子帖暂时没有定位成功。",
      },
    })).toBe(false);
  });
});

describe("shouldShowSubPostsLoadMoreFailureState", () => {
  it("shows load-more failures only for non-empty idle errors", () => {
    expect(shouldShowSubPostsLoadMoreFailureState({
      loadingMoreSubPostsError: "更多子帖加载失败，请稍后重试。",
      loadingMoreSubPosts: false,
    })).toBe(true);

    expect(shouldShowSubPostsLoadMoreFailureState({
      loadingMoreSubPostsError: "   ",
      loadingMoreSubPosts: false,
    })).toBe(false);

    expect(shouldShowSubPostsLoadMoreFailureState({
      loadingMoreSubPostsError: "更多子帖加载失败，请稍后重试。",
      loadingMoreSubPosts: true,
    })).toBe(false);
  });
});

describe("shouldShowSubPostEmptyState", () => {
  it("shows the ordinary empty state only when the sub-post list is idle and empty", () => {
    expect(shouldShowSubPostEmptyState({
      loadingSubPosts: false,
      showSubPostsError: false,
      targetSubPostStatus: null,
      subPostCount: 0,
    })).toBe(true);
  });

  it("hides the ordinary empty state behind shared target location states", () => {
    expect(shouldShowSubPostEmptyState({
      loadingSubPosts: false,
      showSubPostsError: false,
      targetSubPostStatus: {
        kind: "missing",
        message: "未找到这条子帖，可能已被删除或暂不可见。",
      },
      subPostCount: 0,
    })).toBe(false);

    expect(shouldShowSubPostEmptyState({
      loadingSubPosts: false,
      showSubPostsError: false,
      targetSubPostStatus: {
        kind: "loading",
        message: "正在定位目标子帖...",
      },
      subPostCount: 0,
    })).toBe(false);

    expect(shouldShowSubPostEmptyState({
      loadingSubPosts: false,
      showSubPostsError: false,
      targetSubPostStatus: {
        kind: "located",
        message: "已定位到目标子帖。",
      },
      subPostCount: 0,
    })).toBe(false);
  });

  it("hides the ordinary empty state while loading, on errors, or once posts exist", () => {
    expect(shouldShowSubPostEmptyState({
      loadingSubPosts: true,
      showSubPostsError: false,
      subPostCount: 0,
    })).toBe(false);

    expect(shouldShowSubPostEmptyState({
      loadingSubPosts: false,
      showSubPostsError: true,
      subPostCount: 0,
    })).toBe(false);

    expect(shouldShowSubPostEmptyState({
      loadingSubPosts: false,
      showSubPostsError: false,
      subPostCount: 1,
    })).toBe(false);
  });
});

describe("buildSubPostsRetryControlState", () => {
  it("uses the failure action label when sub-post retry is idle", () => {
    expect(buildSubPostsRetryControlState({
      loadingSubPosts: false,
      actionLabel: "重试读取子帖",
    })).toEqual({
      disabled: false,
      label: "重试读取子帖",
    });
  });

  it("disables duplicate sub-post retries while loading", () => {
    expect(buildSubPostsRetryControlState({
      loadingSubPosts: true,
      actionLabel: "重试读取子帖",
    })).toEqual({
      disabled: true,
      label: "正在重试...",
    });
  });
});

describe("buildTargetSubPostRetryControlState", () => {
  it("uses target retry copy when location retry is idle", () => {
    expect(buildTargetSubPostRetryControlState({
      targetSubPostStatus: {
        actionLabel: "重试定位",
        retryAction: "loadMore",
      },
      loadingMoreSubPosts: false,
    })).toEqual({
      disabled: false,
      label: "重试定位",
    });
  });

  it("disables load-more target retries while more sub-posts are loading", () => {
    expect(buildTargetSubPostRetryControlState({
      targetSubPostStatus: {
        actionLabel: "重试定位",
        retryAction: "loadMore",
      },
      loadingMoreSubPosts: true,
    })).toEqual({
      disabled: true,
      label: "正在重试...",
    });
  });

  it("disables reload target retries while the first sub-post page is loading", () => {
    expect(buildTargetSubPostRetryControlState({
      targetSubPostStatus: {
        actionLabel: "重试定位",
        retryAction: "reload",
      },
      loadingSubPosts: true,
    })).toEqual({
      disabled: true,
      label: "正在重试...",
    });
  });

  it("keeps the located target jump action available while background loading continues", () => {
    expect(buildTargetSubPostRetryControlState({
      targetSubPostStatus: {
        actionLabel: "回到目标子帖",
        retryAction: "scrollToTarget",
      },
      loadingSubPosts: true,
      loadingMoreSubPosts: true,
    })).toEqual({
      disabled: false,
      label: "回到目标子帖",
    });
  });

  it("keeps the missing target main-post action available while loading continues", () => {
    expect(buildTargetSubPostRetryControlState({
      targetSubPostStatus: {
        actionLabel: "查看主帖",
        retryAction: "clearTarget",
      },
      loadingSubPosts: true,
      loadingMoreSubPosts: true,
    })).toEqual({
      disabled: false,
      label: "查看主帖",
    });
  });

  it("disables missing target retries while the first sub-post page is reloading", () => {
    expect(buildTargetSubPostRetryControlState({
      targetSubPostStatus: {
        actionLabel: "重试定位",
        retryAction: "reload",
      },
      loadingSubPosts: true,
      loadingMoreSubPosts: true,
    })).toEqual({
      disabled: true,
      label: "正在重试...",
    });
  });

  it("returns an empty idle control when there is no target retry action", () => {
    expect(buildTargetSubPostRetryControlState({
      targetSubPostStatus: {
        message: "正在定位目标子帖...",
      },
    })).toEqual({
      disabled: false,
      label: "",
    });
  });
});

describe("buildSubPostMoreMenuId", () => {
  it("builds stable ids for main and branch sub-post menus", () => {
    expect(buildSubPostMoreMenuId("main-42")).toBe("sub-post-more-menu-main-42");
    expect(buildSubPostMoreMenuId("sub-42-99")).toBe("sub-post-more-menu-sub-42-99");
  });

  it("sanitizes unusual keys before using them in aria-controls", () => {
    expect(buildSubPostMoreMenuId("sub 42/99")).toBe("sub-post-more-menu-sub-42-99");
    expect(buildSubPostMoreMenuId("")).toBe("sub-post-more-menu-current");
  });
});

describe("SubPostMediaDraft retry control", () => {
  it("renders retryable failed upload controls beside the upload status", () => {
    const markup = renderToStaticMarkup(createElement(SubPostMediaDraft, {
      mediaAssets: [],
      uploading: false,
      uploadStatus: {
        type: "warning",
        message: "失败 1 张",
        canRetry: true,
        retryLabel: "重试失败图片",
      },
      onMediaPicked: vi.fn(),
      onRetryFailedUploads: vi.fn(),
      removeMediaAt: vi.fn(),
    }));

    expect(markup).toContain("失败 1 张");
    expect(markup).toContain("重试失败图片");
    expect(markup).toContain("sub-post-media-upload-retry");
  });

  it("disables retry while the draft is busy", () => {
    const markup = renderToStaticMarkup(createElement(SubPostMediaDraft, {
      mediaAssets: [],
      uploading: true,
      uploadStatus: {
        type: "warning",
        message: "失败 1 张",
        canRetry: true,
        retryLabel: "重试失败图片",
      },
      onMediaPicked: vi.fn(),
      onRetryFailedUploads: vi.fn(),
      removeMediaAt: vi.fn(),
    }));

    expect(markup).toContain("sub-post-media-upload-retry");
    expect(markup).toContain("disabled=\"\"");
  });

  it("renders a refresh control for processing draft media", () => {
    const markup = renderToStaticMarkup(createElement(SubPostMediaDraft, {
      mediaAssets: [{
        id: 66,
        processingStatus: "PROCESSING",
      }],
      uploading: false,
      uploadStatus: { type: "" },
      onMediaPicked: vi.fn(),
      onRefreshMediaAssets: vi.fn(),
      removeMediaAt: vi.fn(),
    }));

    expect(markup).toContain("刷新图片状态");
    expect(markup).toContain("sub-post-media-refresh");
  });

  it("disables refresh while draft media status is refreshing", () => {
    const markup = renderToStaticMarkup(createElement(SubPostMediaDraft, {
      mediaAssets: [{
        id: 66,
        processingStatus: "FAILED",
      }],
      uploading: true,
      uploadStatus: { type: "uploading", message: "正在刷新图片状态..." },
      onMediaPicked: vi.fn(),
      onRefreshMediaAssets: vi.fn(),
      removeMediaAt: vi.fn(),
    }));

    expect(markup).toContain("刷新图片状态");
    expect(markup).toContain("disabled=\"\"");
  });
});

describe("sub-post identity helpers", () => {
  it("builds stable menu keys for main and branch sub-post actions", () => {
    expect(buildSubPostMoreMenuKey({ subPostId: 42 })).toBe("main-42");
    expect(buildSubPostMoreMenuKey({
      parentSubPostId: 42,
      subPostId: 99,
    })).toBe("sub-42-99");
  });

  it("builds stable composer instance ids for nested reply forms", () => {
    expect(buildSubPostComposerInstanceId({ subPostId: 42 })).toBe("floor-42");
    expect(buildSubPostComposerInstanceId({
      parentSubPostId: 42,
      subPostId: 99,
    })).toBe("branch-42-99");
  });

  it("builds stable floor DOM anchors used by deep-link scrolling", () => {
    expect(buildSubPostFloorDomId(42)).toBe("sub-post-floor-42");
    expect(buildSubPostFloorDomId("draft item")).toBe("sub-post-floor-draft-item");
  });

  it("resolves author identity from either normalized author field", () => {
    expect(resolveSubPostAuthorIdentity({ author: "nya" })).toBe("nya");
    expect(resolveSubPostAuthorIdentity({ authorUsername: "alice" })).toBe("alice");
    expect(resolveSubPostAuthorIdentity({ author: " nya ", authorUsername: "alice" }))
      .toBe("nya");
  });

  it("builds a stable display author fallback for incomplete sub-post payloads", () => {
    expect(resolveSubPostDisplayAuthor({ author: "nya" })).toBe("nya");
    expect(resolveSubPostDisplayAuthor({ authorUsername: "alice" })).toBe("alice");
    expect(resolveSubPostDisplayAuthor({})).toBe("未知用户");
  });

  it("allows delete controls for the current sub-post author across payload shapes", () => {
    expect(canCurrentUserDeleteSubPost({ author: "nya" }, "nya")).toBe(true);
    expect(canCurrentUserDeleteSubPost({ authorUsername: "nya" }, "nya")).toBe(true);
    expect(canCurrentUserDeleteSubPost({ authorUsername: "nya" }, "alice")).toBe(false);
    expect(canCurrentUserDeleteSubPost({ authorUsername: "nya" }, "")).toBe(false);
  });
});

function renderSubPostPanel(props = {}) {
  const subPosts = props.subPosts || [];
  return renderToStaticMarkup(createElement(SubPostPanel, {
    listProps: {
      loadingSubPosts: false,
      subPostsError: "",
      loadingMoreSubPosts: false,
      loadingMoreSubPostsError: "",
      subPostsHasMore: false,
      loadMoreSubPosts: vi.fn(),
      reloadCurrentSubPosts: vi.fn(),
      selectedPost: { id: 42, author: "post-author", subPostCount: subPosts.length },
      subPosts,
      orderedSubPostFloors: subPosts,
      subPostNodeMap: new Map(subPosts.map((subPost) => [
        subPost.id,
        { ...subPost, branchSubPosts: subPost.branchSubPosts || [] },
      ])),
      targetSubPostStatus: null,
      targetSubPostId: null,
      ...props.listProps,
    },
    managementProps: {
      allowPostManagement: false,
      currentUser: "",
      openEditComposer: vi.fn(),
      deletePost: vi.fn(),
      ...props.managementProps,
    },
    composerProps: {
      activeSubPostTarget: null,
      subPostInput: "",
      setSubPostInput: vi.fn(),
      submittingSubPost: false,
      submitSubPost: vi.fn(),
      isLoggedIn: true,
      startNestedSubPostComposer: vi.fn(),
      cancelNestedSubPostComposer: vi.fn(),
      requireAuthNotice: vi.fn(),
      openAuthModal: vi.fn(),
      ...props.composerProps,
    },
    interactionProps: {
      collapsedSubPostBranches: {},
      subPostMoreMenuId: "",
      toggleSubPostBranches: vi.fn(),
      jumpToSubPostFloor: vi.fn(),
      clearTargetSubPostLocation: vi.fn(),
      toggleSubPostMoreMenu: vi.fn(),
      handleSubPostFavoriteFromMenu: vi.fn(),
      handleSubPostShareFromMenu: vi.fn(),
      copyTargetSubPostLink: vi.fn(),
      handleSubPostReport: vi.fn(),
      toggleSubPostLike: vi.fn(),
      deleteSubPost: vi.fn(),
      currentUser: "",
      ...props.interactionProps,
    },
    helperProps: {
      authorInitial: (name) => String(name || "?").slice(0, 1).toUpperCase(),
      formatTime: () => "刚刚",
      subPostQuotePreview: (value) => value || "",
      ...props.helperProps,
    },
  }));
}

describe("sub-post media rendering", () => {
  it("normalizes ready and processing sub-post media sources", () => {
    expect(isSubPostMediaSourceReady({ processingStatus: "READY" })).toBe(true);
    expect(isSubPostMediaSourceReady({ processingStatus: "PROCESSING" })).toBe(false);
    expect(subPostMediaImageUrl({
      processingStatus: "PROCESSING",
      displayUrl: "/media/stale.webp",
    })).toBe("");

    expect(normalizeSubPostMediaSources({
      mediaAssets: [
        {
          id: 7,
          processingStatus: "PROCESSING",
          width: 1600,
          height: 900,
        },
        {
          id: 8,
          displayUrl: "/media/8.webp",
          processingStatus: "READY",
        },
      ],
    })).toEqual([
      expect.objectContaining({
        processingStatus: "PROCESSING",
        src: "",
      }),
      expect.objectContaining({
        processingStatus: "READY",
        src: "/media/8.webp",
      }),
    ]);
  });

  it("renders sub-post processing media placeholders in the discussion thread", () => {
    const markup = renderSubPostPanel({
      subPosts: [
        {
          id: 7,
          author: "alice",
          content: "带图子帖",
          mediaAssets: [
            {
              id: 99,
              processingStatus: "PROCESSING",
              width: 1600,
              height: 900,
            },
          ],
        },
      ],
    });

    expect(markup).toContain('class="sub-post-media-grid count-1"');
    expect(markup).toContain("图片处理中");
    expect(markup).toContain('class="sub-post-media-item is-status-placeholder"');
  });

  it("renders media-only sub-posts with a readable summary instead of an empty paragraph", () => {
    const markup = renderSubPostPanel({
      subPosts: [
        {
          id: 7,
          author: "alice",
          content: "",
          mediaAssets: [
            {
              id: 99,
              displayUrl: "/media/99.webp",
              processingStatus: "READY",
            },
          ],
        },
      ],
    });

    expect(markup).toContain('class="sub-post-text sub-post-text-media-only"');
    expect(markup).toContain("1张图");
    expect(markup).toContain('class="sub-post-media-grid count-1"');
  });

  it("renders nested sub-post media draft controls and disables submit while uploading", () => {
    const markup = renderSubPostPanel({
      subPosts: [
        {
          id: 7,
          author: "alice",
          content: "可回复子帖",
        },
      ],
      composerProps: {
        activeSubPostTarget: {
          id: 7,
          composerInstanceId: "floor-7",
        },
        subPostInput: "",
        subPostMediaAssets: [
          {
            id: 99,
            displayUrl: "/media/99.webp",
            processingStatus: "READY",
          },
        ],
        uploadingSubPostMedia: true,
        subPostMediaUploadStatus: {
          type: "uploading",
          message: "图片上传中...",
        },
      },
    });

    expect(markup).toContain('class="sub-post-media-draft"');
    expect(markup).toContain('class="sub-post-media-upload-status uploading"');
    expect(markup).toContain('id="inline-sub-post-media-upload-status"');
    expect(markup).toContain("图片上传中...");
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-describedby="inline-sub-post-media-upload-status"');
    expect(markup).toContain(">上传中...</button>");
  });
});

describe("buildSubPostFloorViewState", () => {
  it("marks the located target sub-post as the current location", () => {
    expect(buildSubPostFloorViewState({
      subPostId: 42,
      targetSubPostStatus: {
        kind: "located",
        targetSubPostId: "42",
      },
    })).toEqual({
      className: "sub-post-root-thread is-target-location",
      ariaCurrent: "location",
    });
  });

  it("marks located branch replies without forcing root-floor styling", () => {
    expect(buildSubPostFloorViewState({
      subPostId: 99,
      targetSubPostStatus: {
        kind: "located",
        targetSubPostId: "99",
      },
      baseClassName: "sub-post-item sub-post-branch-item",
    })).toEqual({
      className: "sub-post-item sub-post-branch-item is-target-location",
      ariaCurrent: "location",
    });
  });

  it("keeps ordinary and non-located sub-post floors unmarked", () => {
    expect(buildSubPostFloorViewState({
      subPostId: 41,
      targetSubPostStatus: {
        kind: "located",
        targetSubPostId: 42,
      },
    })).toEqual({
      className: "sub-post-root-thread",
      ariaCurrent: undefined,
    });

    expect(buildSubPostFloorViewState({
      subPostId: 42,
      targetSubPostStatus: {
        kind: "loading",
        targetSubPostId: 42,
      },
    })).toEqual({
      className: "sub-post-root-thread",
      ariaCurrent: undefined,
    });
  });
});

describe("target sub-post landing marker", () => {
  it("renders a persistent target marker on the located top-level sub-post", () => {
    const markup = renderSubPostPanel({
      subPosts: [
        {
          id: 7,
          author: "alice",
          content: "目标子帖",
        },
      ],
      listProps: {
        targetSubPostStatus: {
          kind: "located",
          targetSubPostId: 7,
          message: "已定位到目标子帖。",
        },
      },
    });

    expect(markup).toContain('aria-current="location"');
    expect(markup).toContain('class="sub-post-target-floor-badge"');
    expect(markup).toContain(">定位</span>");
  });

  it("renders a persistent target marker on located branch replies", () => {
    const markup = renderSubPostPanel({
      subPosts: [
        {
          id: 7,
          author: "parent",
          content: "父级子帖",
          branchSubPosts: [
            {
              id: 8,
              author: "branch",
              content: "目标分支回复",
            },
          ],
        },
      ],
      listProps: {
        targetSubPostStatus: {
          kind: "located",
          targetSubPostId: 8,
          message: "已定位到目标子帖。",
        },
      },
    });

    expect(markup).toContain('class="sub-post-item sub-post-branch-item is-target-location"');
    expect(markup).toContain('class="sub-post-target-floor-badge"');
    expect(markup).toContain(">定位</span>");
  });
});

describe("resolveSubPostFloorTargetStatus", () => {
  it("keeps the explicit target status when one is available", () => {
    const status = {
      kind: "missing",
      targetSubPostId: 42,
    };

    expect(resolveSubPostFloorTargetStatus({
      targetSubPostStatus: status,
      targetSubPostId: 7,
    })).toBe(status);
  });

  it("falls back to the route target so loaded deep-link floors keep location semantics", () => {
    expect(resolveSubPostFloorTargetStatus({
      targetSubPostStatus: null,
      targetSubPostId: "42",
    })).toEqual({
      kind: "located",
      targetSubPostId: 42,
    });
  });

  it("ignores unusable route targets", () => {
    expect(resolveSubPostFloorTargetStatus({
      targetSubPostStatus: null,
      targetSubPostId: "draft",
    })).toBeNull();
  });
});

describe("sub-post reference helpers", () => {
  it("builds a media-only sub-post text view model", () => {
    expect(buildSubPostTextViewModel({
      content: "",
      mediaAssets: [{ id: 99 }],
    })).toEqual({
      shouldShow: true,
      text: "1张图",
      className: "sub-post-text sub-post-text-media-only",
    });
  });

  it("resolves referenced sub-post authors across target and parent payload shapes", () => {
    expect(resolveSubPostReferenceAuthor({ targetSubPostAuthor: "bob" })).toBe("bob");
    expect(resolveSubPostReferenceAuthor({ targetSubPostAuthorUsername: "bob" })).toBe("bob");
    expect(resolveSubPostReferenceAuthor({ parentSubPostAuthor: "alice" })).toBe("alice");
    expect(resolveSubPostReferenceAuthor({ parentSubPostAuthorUsername: "alice" }))
      .toBe("alice");
    expect(resolveSubPostReferenceAuthor({
      targetSubPostAuthor: " bob ",
      parentSubPostAuthor: "alice",
    })).toBe("bob");
  });

  it("builds a visible reference view model when the quoted sub-post is available", () => {
    const quotePreview = vi.fn((value) => `引用：${value || "空"}`);

    expect(buildSubPostReferenceViewModel({
      targetSubPostAuthorUsername: "bob",
      targetSubPostPreview: "被回复的内容",
    }, quotePreview)).toEqual({
      shouldShow: true,
      author: "bob",
      preview: "引用：被回复的内容",
    });
    expect(quotePreview).toHaveBeenCalledWith("被回复的内容");
  });

  it("keeps deleted references visible even when the author is unavailable", () => {
    expect(buildSubPostReferenceViewModel({
      targetSubPostDeleted: true,
      targetSubPostPreview: "该子帖已删除。",
    }, (value) => value)).toEqual({
      shouldShow: true,
      author: "",
      preview: "该子帖已删除。",
    });
  });

  it("hides references when neither author nor deletion state is available", () => {
    expect(buildSubPostReferenceViewModel({
      targetSubPostPreview: "孤立摘要",
    }, (value) => value)).toEqual({
      shouldShow: false,
      author: "",
      preview: "",
    });
  });
});

describe("buildSubPostMoreMenuActionItems", () => {
  it("builds the standard sub-post more menu actions without delete access", () => {
    expect(buildSubPostMoreMenuActionItems({
      subPost: { id: 42, favoritedByMe: false },
      canDelete: false,
      actionButtonClassName: "sub-post-action-btn",
    })).toEqual([
      {
        key: "favorite",
        className: "sub-post-action-btn more-expand favorite",
        title: "收藏",
        ariaLabel: "收藏",
        icon: "star",
      },
      {
        key: "share",
        className: "sub-post-action-btn more-expand share",
        title: "分享这条子帖",
        ariaLabel: "分享这条子帖",
        icon: "share",
      },
      {
        key: "report",
        className: "sub-post-action-btn more-expand report",
        title: "举报",
        ariaLabel: "举报",
        icon: "flag",
      },
    ]);
  });

  it("marks favorited actions active and adds delete when the user can manage the sub-post", () => {
    expect(buildSubPostMoreMenuActionItems({
      subPost: { id: 42, favoritedByMe: true },
      canDelete: true,
      actionButtonClassName: "sub-post-branch-action-btn",
    })).toEqual([
      {
        key: "favorite",
        className: "sub-post-branch-action-btn more-expand favorite is-active",
        title: "取消收藏",
        ariaLabel: "取消收藏",
        icon: "star-filled",
      },
      {
        key: "share",
        className: "sub-post-branch-action-btn more-expand share",
        title: "分享这条子帖",
        ariaLabel: "分享这条子帖",
        icon: "share",
      },
      {
        key: "report",
        className: "sub-post-branch-action-btn more-expand report",
        title: "举报",
        ariaLabel: "举报",
        icon: "flag",
      },
      {
        key: "delete",
        className: "sub-post-branch-action-btn more-expand danger",
        title: "删除子帖",
        ariaLabel: "删除子帖",
        icon: "close",
      },
    ]);
  });
});

describe("runSubPostMoreMenuAction", () => {
  it("runs the selected action before closing the current menu", () => {
    const events = [];
    const action = vi.fn(() => events.push("action"));
    const closeMenu = vi.fn(() => events.push("close"));

    runSubPostMoreMenuAction(action, closeMenu, "main-42");

    expect(action).toHaveBeenCalledTimes(1);
    expect(closeMenu).toHaveBeenCalledWith("main-42");
    expect(events).toEqual(["action", "close"]);
  });

  it("still closes the current menu when an optional action is unavailable", () => {
    const closeMenu = vi.fn();

    runSubPostMoreMenuAction(null, closeMenu, "sub-42-99");

    expect(closeMenu).toHaveBeenCalledWith("sub-42-99");
  });
});

describe("getSubPostMoreMenuNavigationTarget", () => {
  it("cycles forward through sub-post menu items", () => {
    expect(getSubPostMoreMenuNavigationTarget({
      key: "ArrowRight",
      currentIndex: 0,
      itemCount: 4,
    })).toBe(1);
    expect(getSubPostMoreMenuNavigationTarget({
      key: "ArrowDown",
      currentIndex: 3,
      itemCount: 4,
    })).toBe(0);
  });

  it("cycles backward through sub-post menu items", () => {
    expect(getSubPostMoreMenuNavigationTarget({
      key: "ArrowLeft",
      currentIndex: 0,
      itemCount: 3,
    })).toBe(2);
    expect(getSubPostMoreMenuNavigationTarget({
      key: "ArrowUp",
      currentIndex: 2,
      itemCount: 3,
    })).toBe(1);
  });

  it("supports home and end jumps", () => {
    expect(getSubPostMoreMenuNavigationTarget({
      key: "Home",
      currentIndex: 2,
      itemCount: 4,
    })).toBe(0);
    expect(getSubPostMoreMenuNavigationTarget({
      key: "End",
      currentIndex: 0,
      itemCount: 4,
    })).toBe(3);
  });

  it("ignores unsupported keys and invalid indexes", () => {
    expect(getSubPostMoreMenuNavigationTarget({
      key: "Enter",
      currentIndex: 0,
      itemCount: 4,
    })).toBeNull();
    expect(getSubPostMoreMenuNavigationTarget({
      key: "ArrowRight",
      currentIndex: -1,
      itemCount: 4,
    })).toBeNull();
    expect(getSubPostMoreMenuNavigationTarget({
      key: "ArrowRight",
      currentIndex: 0,
      itemCount: 0,
    })).toBeNull();
  });
});
