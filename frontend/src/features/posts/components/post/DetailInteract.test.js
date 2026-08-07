import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildPostShareButtonClassName,
  buildPostShareMobileStatus,
  buildPostShareButtonState,
  buildPostMoreMenuId,
  buildPostMoreWrapClassName,
  getPostMoreMenuNavigationTarget,
  runPostMoreAction,
  shouldFocusPostMoreMenuOnOpen,
  shouldRestorePostMoreFocus,
  shouldShowGuestEngagementPrompt,
} from "./DetailInteract";

const detailInteractSource = readFileSync(
  new URL("./DetailInteract.jsx", import.meta.url),
  "utf8",
);

describe("shouldShowGuestEngagementPrompt", () => {
  it("shows the engagement CTA for guests on a loaded post detail", () => {
    expect(shouldShowGuestEngagementPrompt({
      isLoggedIn: false,
      selectedPost: { id: 42 },
    })).toBe(true);
  });

  it("shows the engagement CTA for guests when detail payloads only expose postId", () => {
    expect(shouldShowGuestEngagementPrompt({
      isLoggedIn: false,
      selectedPost: { postId: "42" },
    })).toBe(true);
  });

  it("hides the engagement CTA for logged-in users", () => {
    expect(shouldShowGuestEngagementPrompt({
      isLoggedIn: true,
      selectedPost: { id: 42 },
    })).toBe(false);
  });

  it("hides the engagement CTA when the post id is not usable", () => {
    expect(shouldShowGuestEngagementPrompt({
      isLoggedIn: false,
      selectedPost: { id: "draft" },
    })).toBe(false);
  });
});

describe("top sub-post media draft contract", () => {
  it("renders the shared media draft control in the top sub-post composer", () => {
    expect(detailInteractSource).toContain("import SubPostMediaDraft");
    expect(detailInteractSource).toContain("<SubPostMediaDraft");
    expect(detailInteractSource).toContain("onRetryFailedUploads={retryFailedSubPostMediaUploads}");
    expect(detailInteractSource).toContain("onRefreshMediaAssets={refreshSubPostMediaAssets}");
    expect(detailInteractSource).toContain("disabled={!isLoggedIn || submittingSubPost}");
    expect(detailInteractSource).toContain("disabled={!isLoggedIn || submittingSubPost || uploadingSubPostMedia}");
    expect(detailInteractSource).toContain("uploadStatusId={TOP_SUB_POST_MEDIA_UPLOAD_STATUS_ID}");
    expect(detailInteractSource).toContain("aria-describedby={uploadingSubPostMedia ? TOP_SUB_POST_MEDIA_UPLOAD_STATUS_ID : undefined}");
  });
});

describe("runPostMoreAction", () => {
  it("runs the menu action before closing the menu", () => {
    const events = [];
    const action = vi.fn(() => events.push("action"));
    const closePostMore = vi.fn(() => events.push("close"));

    runPostMoreAction(action, closePostMore);

    expect(action).toHaveBeenCalledTimes(1);
    expect(closePostMore).toHaveBeenCalledWith("menu-action");
    expect(events).toEqual(["action", "close"]);
  });

  it("still closes the menu when an optional action is missing", () => {
    const closePostMore = vi.fn();

    runPostMoreAction(null, closePostMore);

    expect(closePostMore).toHaveBeenCalledWith("menu-action");
  });
});

describe("buildPostMoreMenuId", () => {
  it("uses a stable post-scoped id for loaded posts", () => {
    expect(buildPostMoreMenuId({ id: 42 })).toBe("detail-post-more-menu-42");
    expect(buildPostMoreMenuId({ id: "42" })).toBe("detail-post-more-menu-42");
    expect(buildPostMoreMenuId({ postId: "42" })).toBe("detail-post-more-menu-42");
  });

  it("falls back to a safe current-post id for unusable post ids", () => {
    expect(buildPostMoreMenuId({ id: "draft" })).toBe("detail-post-more-menu-current");
    expect(buildPostMoreMenuId(null)).toBe("detail-post-more-menu-current");
  });
});

describe("buildPostMoreWrapClassName", () => {
  it("marks the more menu wrapper when expanded", () => {
    expect(buildPostMoreWrapClassName(false)).toBe("detail-post-more-wrap");
    expect(buildPostMoreWrapClassName(true)).toBe("detail-post-more-wrap is-open");
  });
});

describe("buildPostShareButtonState", () => {
  it("uses the default share button copy when no share request is active", () => {
    expect(buildPostShareButtonState({
      selectedPost: { id: 42 },
      isSharingPost: () => false,
    })).toEqual({
      sharing: false,
      label: "分享",
      title: "分享",
      ariaLabel: "分享",
    });
  });

  it("uses a busy share button state while the current post is sharing", () => {
    expect(buildPostShareButtonState({
      selectedPost: { id: 42 },
      isSharingPost: (post) => post?.id === 42,
    })).toEqual({
      sharing: true,
      label: "分享中",
      title: "正在准备分享",
      ariaLabel: "正在分享",
    });
  });

  it("uses explicit location copy when the detail route targets a sub-post", () => {
    expect(buildPostShareButtonState({
      selectedPost: { id: 42 },
      isSharingPost: () => false,
      targetSubPostId: "7",
    })).toEqual({
      sharing: false,
      label: "分享定位",
      title: "分享定位",
      ariaLabel: "分享定位",
    });
  });

  it("keeps target-location context visible while sharing is busy", () => {
    expect(buildPostShareButtonState({
      selectedPost: { id: 42 },
      isSharingPost: () => true,
      targetSubPostId: 7,
    })).toEqual({
      sharing: true,
      label: "分享中",
      title: "正在准备定位分享",
      ariaLabel: "正在分享定位",
    });
  });

  it("wires busy share state to disabled and aria-busy button attributes", () => {
    expect(detailInteractSource).toContain("disabled={postShareButtonState.sharing}");
    expect(detailInteractSource).toContain("aria-busy={postShareButtonState.sharing ? \"true\" : undefined}");
    expect(detailInteractSource).toContain("{postShareButtonState.label}");
  });
});

describe("buildPostShareButtonClassName", () => {
  it("marks target sub-post shares with a visible state class", () => {
    expect(buildPostShareButtonClassName({ targetSubPostId: 7 })).toContain(
      "is-target-share",
    );
    expect(buildPostShareButtonClassName({ targetSubPostId: "7" })).toContain(
      "is-target-share",
    );
  });

  it("keeps ordinary post shares in the base share button class", () => {
    expect(buildPostShareButtonClassName({ targetSubPostId: 0 })).toBe(
      "detail-interact-btn detail-interact-btn-large detail-interact-btn-share",
    );
    expect(buildPostShareButtonClassName({ targetSubPostId: "bad-id" })).toBe(
      "detail-interact-btn detail-interact-btn-large detail-interact-btn-share",
    );
  });
});

describe("buildPostShareMobileStatus", () => {
  it("keeps ordinary post shares quiet on mobile", () => {
    expect(buildPostShareMobileStatus({
      sharing: false,
      targetSubPostId: 0,
    })).toBe("");
  });

  it("shows the target sub-post share context when button labels are hidden on mobile", () => {
    expect(buildPostShareMobileStatus({
      sharing: false,
      targetSubPostId: "7",
    })).toBe("定位分享");
  });

  it("keeps busy share context visible on mobile", () => {
    expect(buildPostShareMobileStatus({
      sharing: true,
      targetSubPostId: 0,
    })).toBe("正在准备分享");
    expect(buildPostShareMobileStatus({
      sharing: true,
      targetSubPostId: 7,
    })).toBe("准备定位分享");
  });

  it("renders mobile share context as a polite status outside the action buttons", () => {
    expect(detailInteractSource).toContain("const postShareMobileStatus = buildPostShareMobileStatus({");
    expect(detailInteractSource).toMatch(
      /className="detail-share-mobile-status" role="status" aria-live="polite"/,
    );
  });
});

describe("shouldRestorePostMoreFocus", () => {
  it("restores focus after keyboard and menu-action closes", () => {
    expect(shouldRestorePostMoreFocus("keyboard")).toBe(true);
    expect(shouldRestorePostMoreFocus("menu-action")).toBe(true);
  });

  it("does not steal focus after pointer or programmatic closes", () => {
    expect(shouldRestorePostMoreFocus("outside")).toBe(false);
    expect(shouldRestorePostMoreFocus("programmatic")).toBe(false);
    expect(shouldRestorePostMoreFocus()).toBe(false);
  });
});

describe("shouldFocusPostMoreMenuOnOpen", () => {
  it("focuses the first menu action for keyboard-triggered opens", () => {
    expect(shouldFocusPostMoreMenuOnOpen({ detail: 0 })).toBe(true);
  });

  it("keeps focus on the opener for pointer-triggered opens", () => {
    expect(shouldFocusPostMoreMenuOnOpen({ detail: 1 })).toBe(false);
    expect(shouldFocusPostMoreMenuOnOpen({ detail: 2 })).toBe(false);
  });

  it("treats missing event detail as keyboard-compatible", () => {
    expect(shouldFocusPostMoreMenuOnOpen(null)).toBe(true);
    expect(shouldFocusPostMoreMenuOnOpen({})).toBe(true);
  });
});

describe("getPostMoreMenuNavigationTarget", () => {
  it("cycles forward with right and down arrows", () => {
    expect(getPostMoreMenuNavigationTarget({
      key: "ArrowRight",
      currentIndex: 0,
      itemCount: 2,
    })).toBe(1);
    expect(getPostMoreMenuNavigationTarget({
      key: "ArrowDown",
      currentIndex: 1,
      itemCount: 2,
    })).toBe(0);
  });

  it("cycles backward with left and up arrows", () => {
    expect(getPostMoreMenuNavigationTarget({
      key: "ArrowLeft",
      currentIndex: 0,
      itemCount: 2,
    })).toBe(1);
    expect(getPostMoreMenuNavigationTarget({
      key: "ArrowUp",
      currentIndex: 1,
      itemCount: 2,
    })).toBe(0);
  });

  it("jumps with home and end", () => {
    expect(getPostMoreMenuNavigationTarget({
      key: "Home",
      currentIndex: 1,
      itemCount: 2,
    })).toBe(0);
    expect(getPostMoreMenuNavigationTarget({
      key: "End",
      currentIndex: 0,
      itemCount: 2,
    })).toBe(1);
  });

  it("ignores unsupported keys and invalid menu bounds", () => {
    expect(getPostMoreMenuNavigationTarget({
      key: "Enter",
      currentIndex: 0,
      itemCount: 2,
    })).toBeNull();
    expect(getPostMoreMenuNavigationTarget({
      key: "ArrowDown",
      currentIndex: 0,
      itemCount: 0,
    })).toBeNull();
    expect(getPostMoreMenuNavigationTarget({
      key: "ArrowDown",
      currentIndex: 1.5,
      itemCount: 2,
    })).toBeNull();
  });
});
