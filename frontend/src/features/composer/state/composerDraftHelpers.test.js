import { describe, expect, it } from "vitest";
import {
  appendComposerMarkdownImages,
  buildComposerMarkdownImageInsertion,
  buildComposerDraftRestoredMessage,
  buildComposerDraftRestoreValidationState,
  buildComposerEditOpenContextKey,
  buildComposerEditSnapshot,
  buildComposerMarkdownMediaValidationMessage,
  buildComposerModeSwitchContent,
  buildComposerPendingUploadSubmitValidation,
  buildComposerSubmitContextKey,
  buildComposerSubmitPayload,
  buildComposerSubmitStatus,
  buildComposerSubmitValidation,
  buildComposerUploadContextKey,
  buildComposerUploadMessage,
  buildComposerUploadStatus,
  buildComposerMediaUrlsFromAssets,
  extractComposerMarkdownMediaRefs,
  findFirstMissingComposerMarkdownMediaRange,
  findMissingComposerMarkdownMediaRefs,
  findUnreferencedComposerMarkdownMediaAssets,
  hasComposerEditChanges,
  hasComposerDraftContent,
  isComposerMediaAssetRefreshPending,
  isComposerMediaAssetSubmitReady,
  limitComposerUploadFilesByMediaCapacity,
  mergeComposerRefreshedMediaAssets,
  mergeComposerMediaAssets,
  mergeComposerMediaUrls,
  normalizeComposerMediaDraft,
  removeMissingComposerMarkdownMediaRefs,
  shouldAutoSaveComposerDraftAfterSubmitFailure,
  shouldApplyComposerEditOpenResult,
  shouldApplyComposerSubmitResult,
  shouldApplyComposerUploadResult,
  shouldConfirmComposerNavigationLeave,
  shouldProtectComposerDraftUnload,
  shouldResetComposerUploadFeedback,
  shouldRestoreSavedComposerDraft,
} from "./composerDraftHelpers";
import {
  buildComposerMarkdownMediaEditorStatus,
  buildComposerMarkdownMediaPreviewStatus,
  buildComposerMarkdownMediaUsageStatus,
} from "./composerMarkdownStatusHelpers";

describe("hasComposerDraftContent", () => {
  it("detects meaningful draft content across text, tags, and media", () => {
    expect(hasComposerDraftContent({
      title: "  ",
      content: "",
      composerTagDraft: "",
      composerTags: [],
      composerMediaUrls: [],
    })).toBe(false);

    expect(hasComposerDraftContent({
      title: "一个标题",
      content: "",
      composerTagDraft: "",
      composerTags: [],
      composerMediaUrls: [],
    })).toBe(true);

    expect(hasComposerDraftContent({
      title: "",
      content: "",
      composerTagDraft: "",
      composerTags: [],
      composerMediaUrls: ["/media/1.webp"],
    })).toBe(true);

  });

  it("tolerates missing draft fields", () => {
    expect(hasComposerDraftContent({})).toBe(false);
  });
});

describe("shouldProtectComposerDraftUnload", () => {
  it("only protects unsaved drafts while the composer route is active", () => {
    expect(shouldProtectComposerDraftUnload({
      routeType: "compose",
      hasUnsavedDraft: true,
    })).toBe(true);

    expect(shouldProtectComposerDraftUnload({
      routeType: "home",
      hasUnsavedDraft: true,
    })).toBe(false);

    expect(shouldProtectComposerDraftUnload({
      routeType: "compose",
      hasUnsavedDraft: false,
    })).toBe(false);
  });
});

describe("shouldConfirmComposerNavigationLeave", () => {
  it("only confirms app navigation away from compose when draft or edit changes exist", () => {
    expect(shouldConfirmComposerNavigationLeave({
      routeType: "compose",
      hasUnsavedDraft: true,
      hasUnsavedEdit: false,
    })).toBe(true);

    expect(shouldConfirmComposerNavigationLeave({
      routeType: "compose",
      hasUnsavedDraft: false,
      hasUnsavedEdit: true,
    })).toBe(true);

    expect(shouldConfirmComposerNavigationLeave({
      routeType: "compose",
      hasUnsavedDraft: false,
      hasUnsavedEdit: false,
    })).toBe(false);

    expect(shouldConfirmComposerNavigationLeave({
      routeType: "home",
      hasUnsavedDraft: true,
      hasUnsavedEdit: true,
    })).toBe(false);
  });
});

describe("shouldAutoSaveComposerDraftAfterSubmitFailure", () => {
  it("auto-saves new post drafts after submit failures when content exists", () => {
    expect(shouldAutoSaveComposerDraftAfterSubmitFailure({
      isEditing: false,
      hasUnsavedDraft: true,
    })).toBe(true);
  });

  it("does not save empty or edit submit failures into the new-post draft slot", () => {
    expect(shouldAutoSaveComposerDraftAfterSubmitFailure({
      isEditing: false,
      hasUnsavedDraft: false,
    })).toBe(false);

    expect(shouldAutoSaveComposerDraftAfterSubmitFailure({
      isEditing: true,
      hasUnsavedDraft: true,
    })).toBe(false);
  });
});

describe("composer submit context guards", () => {
  it("builds distinct submit contexts for new posts and edits", () => {
    expect(buildComposerSubmitContextKey({
      routeType: "compose",
      editingMainPostId: null,
    })).toBe("compose:new");

    expect(buildComposerSubmitContextKey({
      routeType: "compose",
      editingMainPostId: 42,
    })).toBe("compose:42");

    expect(buildComposerSubmitContextKey({
      routeType: "home",
      editingMainPostId: 42,
    })).toBe("");
  });

  it("applies submit results only to the latest matching composer session", () => {
    const requestContextKey = buildComposerSubmitContextKey({
      routeType: "compose",
      editingMainPostId: 42,
    });

    expect(shouldApplyComposerSubmitResult({
      requestContextKey,
      currentRouteType: "compose",
      currentEditingMainPostId: 42,
      requestId: 2,
      currentRequestId: 2,
    })).toBe(true);

    expect(shouldApplyComposerSubmitResult({
      requestContextKey,
      currentRouteType: "compose",
      currentEditingMainPostId: 43,
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldApplyComposerSubmitResult({
      requestContextKey,
      currentRouteType: "home",
      currentEditingMainPostId: 42,
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldApplyComposerSubmitResult({
      requestContextKey,
      currentRouteType: "compose",
      currentEditingMainPostId: 42,
      requestId: 1,
      currentRequestId: 2,
    })).toBe(false);
  });
});

describe("composer edit-open context guards", () => {
  it("builds edit-open context keys from the source route and target post", () => {
    expect(buildComposerEditOpenContextKey({
      routeType: "post",
      mainPostId: 42,
      targetSubPostId: 7,
      editingMainPostId: null,
      postId: 42,
    })).toBe("edit-open:post:42:7:new:42");

    expect(buildComposerEditOpenContextKey({
      routeType: "home",
      editingMainPostId: null,
      postId: 42,
    })).toBe("edit-open:home:0:0:new:42");

    expect(buildComposerEditOpenContextKey({
      routeType: "post",
      mainPostId: 42,
      postId: 0,
    })).toBe("");
  });

  it("applies edit-open results only to the latest matching source route", () => {
    const requestContextKey = buildComposerEditOpenContextKey({
      routeType: "post",
      mainPostId: 42,
      targetSubPostId: 7,
      editingMainPostId: null,
      postId: 42,
    });

    expect(shouldApplyComposerEditOpenResult({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 42,
      currentTargetSubPostId: 7,
      currentEditingMainPostId: null,
      postId: 42,
      requestId: 2,
      currentRequestId: 2,
    })).toBe(true);

    expect(shouldApplyComposerEditOpenResult({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 43,
      currentTargetSubPostId: 7,
      currentEditingMainPostId: null,
      postId: 42,
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldApplyComposerEditOpenResult({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 42,
      currentTargetSubPostId: 8,
      currentEditingMainPostId: null,
      postId: 42,
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldApplyComposerEditOpenResult({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 42,
      currentTargetSubPostId: 7,
      currentEditingMainPostId: null,
      postId: 42,
      requestId: 1,
      currentRequestId: 2,
    })).toBe(false);
  });
});

describe("composer upload context guards", () => {
  it("builds upload contexts from the active composer session", () => {
    expect(buildComposerUploadContextKey({
      routeType: "compose",
      editingMainPostId: null,
      composerMode: "long",
      composerCommunitySlug: "general",
    })).toBe("upload:new:long:general");

    expect(buildComposerUploadContextKey({
      routeType: "compose",
      editingMainPostId: 42,
      composerMode: "rich",
      composerCommunitySlug: " memes ",
    })).toBe("upload:42:rich:memes");

    expect(buildComposerUploadContextKey({
      routeType: "home",
      editingMainPostId: null,
      composerMode: "long",
      composerCommunitySlug: "general",
    })).toBe("");
  });

  it("applies upload results only to the latest matching composer context", () => {
    const requestContextKey = buildComposerUploadContextKey({
      routeType: "compose",
      editingMainPostId: 42,
      composerMode: "long",
      composerCommunitySlug: "general",
    });

    expect(shouldApplyComposerUploadResult({
      requestContextKey,
      currentRouteType: "compose",
      currentEditingMainPostId: 42,
      currentComposerMode: "long",
      currentComposerCommunitySlug: "general",
      requestId: 2,
      currentRequestId: 2,
    })).toBe(true);

    expect(shouldApplyComposerUploadResult({
      requestContextKey,
      currentRouteType: "home",
      currentEditingMainPostId: 42,
      currentComposerMode: "long",
      currentComposerCommunitySlug: "general",
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldApplyComposerUploadResult({
      requestContextKey,
      currentRouteType: "compose",
      currentEditingMainPostId: 43,
      currentComposerMode: "long",
      currentComposerCommunitySlug: "general",
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldApplyComposerUploadResult({
      requestContextKey,
      currentRouteType: "compose",
      currentEditingMainPostId: 42,
      currentComposerMode: "rich",
      currentComposerCommunitySlug: "general",
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldApplyComposerUploadResult({
      requestContextKey,
      currentRouteType: "compose",
      currentEditingMainPostId: 42,
      currentComposerMode: "long",
      currentComposerCommunitySlug: "memes",
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldApplyComposerUploadResult({
      requestContextKey,
      currentRouteType: "compose",
      currentEditingMainPostId: 42,
      currentComposerMode: "long",
      currentComposerCommunitySlug: "general",
      requestId: 1,
      currentRequestId: 2,
    })).toBe(false);
  });

  it("resets upload feedback when the composer upload context changes", () => {
    const previousContextKey = buildComposerUploadContextKey({
      routeType: "compose",
      editingMainPostId: null,
      composerMode: "long",
      composerCommunitySlug: "general",
    });
    const nextCommunityContextKey = buildComposerUploadContextKey({
      routeType: "compose",
      editingMainPostId: null,
      composerMode: "long",
      composerCommunitySlug: "memes",
    });
    const nextModeContextKey = buildComposerUploadContextKey({
      routeType: "compose",
      editingMainPostId: null,
      composerMode: "rich",
      composerCommunitySlug: "general",
    });

    expect(shouldResetComposerUploadFeedback({
      previousContextKey,
      nextContextKey: previousContextKey,
    })).toBe(false);

    expect(shouldResetComposerUploadFeedback({
      previousContextKey,
      nextContextKey: nextCommunityContextKey,
    })).toBe(true);

    expect(shouldResetComposerUploadFeedback({
      previousContextKey,
      nextContextKey: nextModeContextKey,
    })).toBe(true);

    expect(shouldResetComposerUploadFeedback({
      previousContextKey,
      nextContextKey: "",
    })).toBe(true);
  });
});

describe("shouldRestoreSavedComposerDraft", () => {
  it("only restores drafts owned by the current signed-in user", () => {
    const now = new Date("2026-06-08T10:00:00.000Z").getTime();

    expect(shouldRestoreSavedComposerDraft({
      savedDraft: {
        ownerUsername: "alice",
        title: "草稿",
        savedAt: "2026-06-08T09:45:00.000Z",
      },
      currentUser: "alice",
      now,
    })).toBe(true);

    expect(shouldRestoreSavedComposerDraft({
      savedDraft: {
        ownerUsername: "alice",
        title: "草稿",
        savedAt: "2026-06-08T09:45:00.000Z",
      },
      currentUser: "bob",
      now,
    })).toBe(false);
  });

  it("does not restore legacy or anonymous drafts without a scoped owner", () => {
    const now = new Date("2026-06-08T10:00:00.000Z").getTime();

    expect(shouldRestoreSavedComposerDraft({
      savedDraft: { title: "旧版草稿" },
      currentUser: "alice",
      now,
    })).toBe(false);

    expect(shouldRestoreSavedComposerDraft({
      savedDraft: {
        ownerUsername: "alice",
        title: "草稿",
        savedAt: "2026-06-08T09:45:00.000Z",
      },
      currentUser: "",
      now,
    })).toBe(false);

    expect(shouldRestoreSavedComposerDraft({
      savedDraft: null,
      currentUser: "alice",
      now,
    })).toBe(false);
  });

  it("expires old or invalid saved drafts", () => {
    const now = new Date("2026-06-08T10:00:00.000Z").getTime();

    expect(shouldRestoreSavedComposerDraft({
      savedDraft: {
        ownerUsername: "alice",
        savedAt: "2026-05-24T09:59:59.000Z",
      },
      currentUser: "alice",
      now,
    })).toBe(false);

    expect(shouldRestoreSavedComposerDraft({
      savedDraft: {
        ownerUsername: "alice",
        savedAt: "not-a-date",
      },
      currentUser: "alice",
      now,
    })).toBe(false);

    expect(shouldRestoreSavedComposerDraft({
      savedDraft: {
        ownerUsername: "alice",
        savedAt: "2026-06-08T10:01:00.000Z",
      },
      currentUser: "alice",
      now,
    })).toBe(false);
  });
});

describe("buildComposerDraftRestoredMessage", () => {
  const now = new Date("2026-06-08T10:00:00.000Z").getTime();

  it("describes recently restored draft age", () => {
    expect(buildComposerDraftRestoredMessage({
      savedAt: "2026-06-08T09:59:45.000Z",
      now,
    })).toBe("已恢复刚刚保存的草稿。");

    expect(buildComposerDraftRestoredMessage({
      savedAt: "2026-06-08T09:42:00.000Z",
      now,
    })).toBe("已恢复 18 分钟前保存的草稿。");

    expect(buildComposerDraftRestoredMessage({
      savedAt: "2026-06-08T07:30:00.000Z",
      now,
    })).toBe("已恢复 2 小时前保存的草稿。");

    expect(buildComposerDraftRestoredMessage({
      savedAt: "2026-06-05T09:30:00.000Z",
      now,
    })).toBe("已恢复 3 天前保存的草稿。");
  });

  it("keeps a neutral fallback for invalid draft timestamps", () => {
    expect(buildComposerDraftRestoredMessage({
      savedAt: "not-a-date",
      now,
    })).toBe("已恢复保存的草稿。");
  });

  it("mentions media entries that were dropped while restoring a draft", () => {
    expect(buildComposerDraftRestoredMessage({
      savedAt: "2026-06-08T09:42:00.000Z",
      droppedMediaCount: 2,
      now,
    })).toBe("已恢复 18 分钟前保存的草稿。 已忽略 2 张不可用图片。");
  });

  it("mentions missing markdown media refs after restoring a draft", () => {
    expect(buildComposerDraftRestoredMessage({
      savedAt: "2026-06-08T09:42:00.000Z",
      missingMediaRefCount: 1,
      now,
    })).toBe("已恢复 18 分钟前保存的草稿。 正文中有 1 处图片引用需要处理。");
  });

  it("combines dropped media and missing markdown ref notices", () => {
    expect(buildComposerDraftRestoredMessage({
      savedAt: "2026-06-08T09:42:00.000Z",
      droppedMediaCount: 2,
      missingMediaRefCount: 3,
      now,
    })).toBe(
      "已恢复 18 分钟前保存的草稿。 已忽略 2 张不可用图片。 正文中有 3 处图片引用需要处理。",
    );
  });
});

describe("buildComposerDraftRestoreValidationState", () => {
  it("surfaces missing markdown media refs as a content validation state", () => {
    expect(buildComposerDraftRestoreValidationState({
      composerMode: "long",
      content: "正文\n![缺失](media:gone)\n![存在](media:pub-1)",
      composerMediaAssets: [{ id: 7, publicId: "pub-1" }],
    })).toEqual({
      message: "正文中有 1 张图片已不在当前草稿中，请删除对应的 media 图片引用或重新上传。",
      target: "content",
      missingMediaRefCount: 1,
    });
  });

  it("stays empty for rich drafts or valid long-form media refs", () => {
    expect(buildComposerDraftRestoreValidationState({
      composerMode: "rich",
      content: "说明 ![忽略](media:gone)",
      composerMediaAssets: [],
    })).toEqual({
      message: "",
      target: "",
      missingMediaRefCount: 0,
    });

    expect(buildComposerDraftRestoreValidationState({
      composerMode: "long",
      content: "正文\n![存在](media:pub-1)",
      composerMediaAssets: [{ id: 7, publicId: "pub-1" }],
    })).toEqual({
      message: "",
      target: "",
      missingMediaRefCount: 0,
    });
  });
});

describe("composer edit snapshots", () => {
  it("detects meaningful edits against the initial post snapshot", () => {
    const initial = buildComposerEditSnapshot({
      title: "原标题",
      content: "原内容",
      communitySlug: "general",
      composerMode: "long",
      composerTags: ["梗图"],
      composerTagDraft: "",
      composerMediaAssets: [{ id: 7, url: "/media/7.webp" }],
    });

    expect(hasComposerEditChanges(initial, buildComposerEditSnapshot({
      title: "原标题",
      content: "原内容",
      communitySlug: "general",
      composerMode: "long",
      composerTags: ["梗图"],
      composerTagDraft: "",
      composerMediaAssets: [{ id: 7, url: "/media/7.webp" }],
    }))).toBe(false);

    expect(hasComposerEditChanges(initial, buildComposerEditSnapshot({
      title: "新标题",
      content: "原内容",
      communitySlug: "general",
      composerMode: "long",
      composerTags: ["梗图"],
      composerTagDraft: "",
      composerMediaAssets: [{ id: 7, url: "/media/7.webp" }],
    }))).toBe(true);
  });

  it("includes uncommitted tag drafts and media ordering in the snapshot", () => {
    const initial = buildComposerEditSnapshot({
      title: "",
      content: "",
      communitySlug: "general",
      composerMode: "rich",
      composerTags: ["A"],
      composerMediaAssets: [{ id: 1 }, { id: 2 }],
    });

    expect(hasComposerEditChanges(initial, buildComposerEditSnapshot({
      title: "",
      content: "",
      communitySlug: "general",
      composerMode: "rich",
      composerTags: ["A"],
      composerTagDraft: "B",
      composerMediaAssets: [{ id: 1 }, { id: 2 }],
    }))).toBe(true);

    expect(hasComposerEditChanges(initial, buildComposerEditSnapshot({
      title: "",
      content: "",
      communitySlug: "general",
      composerMode: "rich",
      composerTags: ["A"],
      composerMediaAssets: [{ id: 2 }, { id: 1 }],
    }))).toBe(true);
  });
});

describe("buildComposerModeSwitchContent", () => {
  it("keeps text while removing markdown image syntax when switching to rich mode", () => {
    expect(buildComposerModeSwitchContent({
      currentMode: "long",
      nextMode: "rich",
      content: "开头\n![内置图](media:pub-7)\n中段\n![外链](https://example.com/a.jpg)\n<img src=\"/x.jpg\" />\n结尾",
    })).toBe("开头\n\n中段\n\n结尾");
  });

  it("preserves rich captions and inserts uploaded media when switching back to long mode", () => {
    expect(buildComposerModeSwitchContent({
      currentMode: "rich",
      nextMode: "long",
      content: "这是一段图文说明",
      composerMediaAssets: [
        { id: 7, publicId: "pub-7", originalFilename: "图一.png" },
        { id: 8, publicId: "pub-8", originalFilename: "图二.png" },
      ],
    })).toBe("这是一段图文说明\n![图一.png](media:pub-7)\n![图二.png](media:pub-8)\n");
  });

  it("preserves rich captions without adding media syntax when no submit-ready media exists", () => {
    expect(buildComposerModeSwitchContent({
      currentMode: "rich",
      nextMode: "long",
      content: "这是一段图文说明",
      composerMediaAssets: [],
    })).toBe("这是一段图文说明");
  });

  it("does not rewrite content when the mode is unchanged", () => {
    expect(buildComposerModeSwitchContent({
      currentMode: "long",
      nextMode: "long",
      content: "正文\n![图](media:pub-7)\n",
    })).toBe("正文\n![图](media:pub-7)\n");
  });
});

describe("buildComposerUploadMessage", () => {
  it("summarizes successful, skipped, and failed files", () => {
    expect(buildComposerUploadMessage({
      imageCount: 2,
      skippedCount: 1,
      failedCount: 1,
    })).toBe("上传 2 张图片，跳过 1 个无效/超限，失败 1 张");
  });

  it("keeps the neutral fallback for empty upload batches", () => {
    expect(buildComposerUploadMessage({
      imageCount: 0,
      skippedCount: 0,
      failedCount: 0,
    })).toBe("上传完成。");
  });
});

describe("buildComposerUploadStatus", () => {
  it("shows an uploading status while files are in flight", () => {
    expect(buildComposerUploadStatus({
      uploading: true,
      imageCount: 0,
      skippedCount: 0,
      failedCount: 0,
    })).toEqual({
      type: "uploading",
      message: "上传中...",
    });
  });

  it("keeps partial upload failures visible as a warning", () => {
    expect(buildComposerUploadStatus({
      uploading: false,
      imageCount: 2,
      skippedCount: 1,
      failedCount: 1,
      retryableFailedCount: 1,
    })).toEqual({
      type: "warning",
      message: "上传 2 张图片，跳过 1 个无效/超限，失败 1 张",
      canRetry: true,
      retryLabel: "重试失败图片",
    });
  });

  it("keeps skipped-only upload batches visible as a warning", () => {
    expect(buildComposerUploadStatus({
      uploading: false,
      skippedCount: 2,
    })).toEqual({
      type: "warning",
      message: "跳过 2 个无效/超限",
    });
  });

  it("shows a success status when all selected images upload", () => {
    expect(buildComposerUploadStatus({
      uploading: false,
      imageCount: 2,
      skippedCount: 0,
      failedCount: 0,
    })).toEqual({
      type: "success",
      message: "上传 2 张图片",
    });
  });

  it("explains hard upload errors without losing draft context", () => {
    expect(buildComposerUploadStatus({
      uploading: false,
      errorMessage: "附件上传失败，请稍后重试。",
      retryableFailedCount: 2,
    })).toEqual({
      type: "error",
      message: "附件上传失败，请稍后重试。 已上传的图片和正文草稿仍保留，可直接重试失败图片。",
      canRetry: true,
      retryLabel: "重试失败图片",
    });
  });

  it("keeps a reselect hint for hard upload errors without retryable files", () => {
    expect(buildComposerUploadStatus({
      uploading: false,
      errorMessage: "附件上传失败，请稍后重试。",
      retryableFailedCount: 0,
    })).toEqual({
      type: "error",
      message: "附件上传失败，请稍后重试。 已上传的图片和正文草稿仍保留，可以重新选择图片重试。",
    });
  });

  it("stays empty when there is no upload result to show", () => {
    expect(buildComposerUploadStatus({
      uploading: false,
      imageCount: 0,
      skippedCount: 0,
      failedCount: 0,
    })).toEqual({ type: "" });
  });
});

describe("normalizeComposerMediaDraft", () => {
  it("keeps only media entries that can be displayed and submitted", () => {
    const normalized = normalizeComposerMediaDraft({
      mediaUrls: [
        "/media/fallback.webp",
        "/media/orphan-url.webp",
        "/media/fallback-9.webp",
        "/media/duplicate.webp",
      ],
      mediaAssets: [
        { id: 7, publicId: "pub-7", displayUrl: "/media/7.webp" },
        { id: 0, publicId: "missing-id", url: "/media/no-id.webp" },
        { id: 9, publicId: "uses-fallback" },
        { id: 7, publicId: "duplicate", url: "/media/duplicate.webp" },
        { id: 10, publicId: "missing-url" },
      ],
    });

    expect(normalized.mediaUrls).toEqual([
      "/media/7.webp",
      "/media/fallback-9.webp",
      "",
    ]);
    expect(normalized.mediaAssets.map((asset) => asset.id)).toEqual([7, 9, 10]);
    expect(normalized.mediaAssets[1]).toMatchObject({
      id: 9,
      url: "/media/fallback-9.webp",
      displayUrl: "/media/fallback-9.webp",
    });
    expect(normalized.mediaAssets[2]).toMatchObject({
      id: 10,
      publicId: "missing-url",
    });
    expect(normalized.mediaAssets[2].url).toBeUndefined();
    expect(normalized.droppedCount).toBe(2);
  });

  it("drops legacy URL-only draft media without submit-ready assets", () => {
    expect(normalizeComposerMediaDraft({
      mediaUrls: ["/media/legacy.webp"],
      mediaAssets: [],
    })).toEqual({
      mediaUrls: [],
      mediaAssets: [],
      droppedCount: 1,
    });
  });
});

describe("composer media draft merge helpers", () => {
  it("treats id-backed processing media as submit-ready even before variants are ready", () => {
    expect(isComposerMediaAssetSubmitReady({
      id: 10,
      processingStatus: "PROCESSING",
    })).toBe(true);
    expect(isComposerMediaAssetSubmitReady({
      id: 0,
      processingStatus: "READY",
      displayUrl: "/media/no-id.webp",
    })).toBe(false);
  });

  it("only schedules processing media assets for metadata refresh", () => {
    expect(isComposerMediaAssetRefreshPending({
      id: 10,
      processingStatus: "PROCESSING",
    })).toBe(true);
    expect(isComposerMediaAssetRefreshPending({
      id: 10,
      processingStatus: "READY",
    })).toBe(false);
    expect(isComposerMediaAssetRefreshPending({
      id: 10,
      processingStatus: "FAILED",
    })).toBe(false);
    expect(isComposerMediaAssetRefreshPending({
      id: 0,
      processingStatus: "PROCESSING",
    })).toBe(false);
  });

  it("merges submit-ready uploaded assets into the draft, including processing placeholders", () => {
    const existingAssets = [{ id: 7, url: "/media/existing.webp" }];
    const uploadedAssets = [
      { id: 8, url: "/media/new.webp" },
      { id: 0, url: "/media/no-id.webp" },
      { id: 9, displayUrl: "/media/display-only.webp" },
      { id: 7, url: "/media/duplicate.webp" },
      { id: 10, processingStatus: "PROCESSING" },
    ];

    expect(mergeComposerMediaAssets(existingAssets, uploadedAssets).map((asset) => asset.id))
      .toEqual([7, 8, 9, 10]);
    expect(mergeComposerMediaUrls(["/media/existing.webp"], uploadedAssets, existingAssets)).toEqual([
      "/media/existing.webp",
      "/media/new.webp",
      "/media/display-only.webp",
      "",
    ]);
  });

  it("merges refreshed media assets in-place and rebuilds preview urls in asset order", () => {
    const existingAssets = [
      { id: 7, processingStatus: "READY", displayUrl: "/media/7.webp" },
      { id: 8, processingStatus: "PROCESSING" },
      { id: 9, processingStatus: "PROCESSING", displayUrl: "/media/stale-9.webp" },
    ];
    const refreshedAssets = [
      {
        id: 8,
        processingStatus: "READY",
        displayUrl: "/media/8-display.webp",
        mediumUrl: "/media/8-medium.webp",
      },
      {
        id: 9,
        processingStatus: "FAILED",
      },
    ];

    const nextAssets = mergeComposerRefreshedMediaAssets(existingAssets, refreshedAssets);

    expect(nextAssets).not.toBe(existingAssets);
    expect(nextAssets).toEqual([
      { id: 7, processingStatus: "READY", displayUrl: "/media/7.webp" },
      {
        id: 8,
        processingStatus: "READY",
        displayUrl: "/media/8-display.webp",
        mediumUrl: "/media/8-medium.webp",
      },
      {
        id: 9,
        processingStatus: "FAILED",
        displayUrl: "/media/stale-9.webp",
      },
    ]);
    expect(buildComposerMediaUrlsFromAssets(nextAssets, ["/media/7.webp", "", "/media/stale-9.webp"]))
      .toEqual([
        "/media/7.webp",
        "/media/8-display.webp",
        "/media/stale-9.webp",
      ]);
  });
});

describe("limitComposerUploadFilesByMediaCapacity", () => {
  it("keeps upload batches within the remaining composer media slots", () => {
    const files = ["a.png", "b.png", "c.png"];

    expect(limitComposerUploadFilesByMediaCapacity({
      imageFiles: files,
      existingMediaCount: 18,
      skippedCount: 1,
    })).toEqual({
      imageFiles: ["a.png", "b.png"],
      skippedCount: 2,
    });
  });

  it("skips the whole upload batch when the media draft is already full", () => {
    expect(limitComposerUploadFilesByMediaCapacity({
      imageFiles: ["a.png", "b.png"],
      existingMediaCount: 20,
    })).toEqual({
      imageFiles: [],
      skippedCount: 2,
    });
  });

  it("normalizes invalid capacity inputs without dropping uploadable files", () => {
    expect(limitComposerUploadFilesByMediaCapacity({
      imageFiles: ["a.png", "b.png"],
      existingMediaCount: -4,
      skippedCount: -2,
    })).toEqual({
      imageFiles: ["a.png", "b.png"],
      skippedCount: 0,
    });

    expect(limitComposerUploadFilesByMediaCapacity({
      imageFiles: ["a.png", "b.png"],
      existingMediaCount: "bad-count",
      skippedCount: Number.POSITIVE_INFINITY,
    })).toEqual({
      imageFiles: ["a.png", "b.png"],
      skippedCount: 0,
    });
  });
});

describe("composer markdown media validation", () => {
  it("appends uploaded markdown images when there is no editor selection", () => {
    expect(appendComposerMarkdownImages(
      "正文结尾  \n",
      [{ id: 7, publicId: "pub-7", originalFilename: "图一.png" }],
    )).toBe("正文结尾\n![图一.png](media:pub-7)\n");
  });

  it("inserts uploaded markdown images at the current editor selection", () => {
    const content = "开头\n这里放图\n结尾";
    expect(appendComposerMarkdownImages(
      content,
      [
        { id: 7, publicId: "pub-7", originalFilename: "图一.png" },
        { id: 8, publicId: "pub-8", originalFilename: "图二.png" },
      ],
      {
        selectionStart: content.indexOf("这里放图"),
        selectionEnd: content.indexOf("这里放图") + "这里放图".length,
      },
    )).toBe("开头\n![图一.png](media:pub-7)\n![图二.png](media:pub-8)\n结尾");
  });

  it("returns the cursor position after inserted markdown images", () => {
    const content = "开头\n这里放图\n结尾";
    const insertion = buildComposerMarkdownImageInsertion({
      content,
      uploadedAssets: [{ id: 7, publicId: "pub-7", originalFilename: "图一.png" }],
      insertSelection: {
        selectionStart: content.indexOf("这里放图"),
        selectionEnd: content.indexOf("这里放图") + "这里放图".length,
      },
    });
    const expectedContent = "开头\n![图一.png](media:pub-7)\n结尾";
    const expectedCursor = expectedContent.indexOf("结尾");
    expect(insertion).toEqual({
      content: expectedContent,
      selectionStart: expectedCursor,
      selectionEnd: expectedCursor,
    });
  });

  it("trims trailing insert-point spaces before restoring markdown images", () => {
    const content = "正文结尾  ";
    const insertion = buildComposerMarkdownImageInsertion({
      content,
      uploadedAssets: [{ id: 7, publicId: "pub-7", originalFilename: "图一.png" }],
      insertSelection: {
        selectionStart: content.length,
        selectionEnd: content.length,
      },
    });
    const expectedContent = "正文结尾\n![图一.png](media:pub-7)\n";

    expect(insertion).toEqual({
      content: expectedContent,
      selectionStart: expectedContent.length,
      selectionEnd: expectedContent.length,
    });
  });

  it("replaces a blank placeholder line with restored markdown images", () => {
    const content = "开头\n   \n结尾";
    const insertion = buildComposerMarkdownImageInsertion({
      content,
      uploadedAssets: [{ id: 7, publicId: "pub-7", originalFilename: "图一.png" }],
      insertSelection: {
        selectionStart: "开头\n".length,
        selectionEnd: "开头\n   ".length,
      },
    });
    const expectedContent = "开头\n![图一.png](media:pub-7)\n结尾";

    expect(insertion).toEqual({
      content: expectedContent,
      selectionStart: expectedContent.indexOf("结尾"),
      selectionEnd: expectedContent.indexOf("结尾"),
    });
  });

  it("extracts unique media refs from markdown images", () => {
    expect(extractComposerMarkdownMediaRefs(
      "![图](media:asset-a)\n![重复](media:asset-a)\n![数字](media:42?width=300)\n![外链](https://example.com/a.jpg)",
    )).toEqual(["asset-a", "42"]);
  });

  it("finds media references missing from the current composer assets", () => {
    expect(findMissingComposerMarkdownMediaRefs({
      content: "![保留](media:pub-1)\n![数字](media:7)\n![缺失](media:gone)",
      composerMediaAssets: [
        { id: 7, publicId: "pub-7" },
        { id: 12, publicId: "pub-1" },
      ],
    })).toEqual(["gone"]);
  });

  it("finds uploaded media assets not referenced by long-form markdown", () => {
    expect(findUnreferencedComposerMarkdownMediaAssets({
      content: "![保留](media:pub-1)\n![数字](media:7)",
      composerMediaAssets: [
        { id: 7, publicId: "pub-7" },
        { id: 12, publicId: "pub-1" },
        { id: 13, publicId: "unused" },
      ],
    }).map((asset) => asset.id)).toEqual([13]);
  });

  it("returns the source range for the first missing markdown media reference", () => {
    const content = "正文\n![存在](media:pub-1)\n中段\n![缺失](media:gone?width=300)\n![另一个](media:gone-2)";

    expect(findFirstMissingComposerMarkdownMediaRange({
      content,
      composerMediaAssets: [{ id: 12, publicId: "pub-1" }],
    })).toEqual({
      ref: "gone",
      selectionStart: content.indexOf("![缺失]"),
      selectionEnd: content.indexOf("\n![另一个]"),
    });
  });

  it("builds concise validation copy for missing markdown media", () => {
    expect(buildComposerMarkdownMediaValidationMessage(["gone"])).toBe(
      "正文中有 1 张图片已不在当前草稿中，请删除对应的 media 图片引用或重新上传。",
    );

    expect(buildComposerMarkdownMediaValidationMessage(["a", "b"])).toBe(
      "正文中有 2 张图片已不在当前草稿中，请删除对应的 media 图片引用或重新上传。",
    );

    expect(buildComposerMarkdownMediaValidationMessage([])).toBe("");
  });

  it("builds preview status for missing markdown media", () => {
    expect(buildComposerMarkdownMediaPreviewStatus({
      content: "![缺失](media:gone)",
      composerMediaAssets: [],
    })).toEqual({
      type: "warning",
      message: "正文中有 1 张图片已不在当前草稿中，请删除对应的 media 图片引用或重新上传。",
      actionLabel: "回到正文",
      cleanActionLabel: "清理引用",
      missingCount: 1,
      selectionStart: 0,
      selectionEnd: "![缺失](media:gone)".length,
    });

    expect(buildComposerMarkdownMediaPreviewStatus({
      content: "![存在](media:asset-1)",
      composerMediaAssets: [{ id: 1, publicId: "asset-1" }],
    })).toEqual({ type: "" });
  });

  it("builds editor status for missing markdown media with a locate action", () => {
    expect(buildComposerMarkdownMediaEditorStatus({
      content: "前文\n![缺失](media:gone)",
      composerMediaAssets: [],
    })).toEqual({
      type: "warning",
      message: "正文中有 1 张图片已不在当前草稿中，请删除对应的 media 图片引用或重新上传。",
      actionLabel: "定位引用",
      cleanActionLabel: "清理引用",
      missingCount: 1,
      selectionStart: "前文\n".length,
      selectionEnd: "前文\n![缺失](media:gone)".length,
    });
  });

  it("builds usage status for uploaded media not referenced by markdown", () => {
    expect(buildComposerMarkdownMediaUsageStatus({
      content: "正文\n![保留](media:pub-1)",
      composerMediaAssets: [
        { id: 12, publicId: "pub-1" },
        { id: 13, publicId: "unused" },
      ],
    })).toEqual({
      type: "info",
      message: "有 1 张已上传图片未在正文中引用，发布时不会带上。",
      actionLabel: "重新插入",
      unusedCount: 1,
    });

    expect(buildComposerMarkdownMediaUsageStatus({
      content: "![保留](media:pub-1)",
      composerMediaAssets: [{ id: 12, publicId: "pub-1" }],
    })).toEqual({ type: "" });
  });

  it("removes missing markdown media references without touching available media or text", () => {
    expect(removeMissingComposerMarkdownMediaRefs({
      content: "开头\n![存在](media:pub-1)\n![缺失](media:gone?width=300)\n结尾",
      composerMediaAssets: [{ id: 7, publicId: "pub-1" }],
    })).toEqual({
      content: "开头\n![存在](media:pub-1)\n结尾",
      removedCount: 1,
    });
  });

  it("trims blank space left by missing markdown media cleanup", () => {
    expect(removeMissingComposerMarkdownMediaRefs({
      content: "\n![缺失一](media:gone-1)\n\n正文\n\n![缺失二](media:gone-2)\n",
      composerMediaAssets: [],
    })).toEqual({
      content: "正文",
      removedCount: 2,
    });
  });

  it("keeps external markdown images when cleaning missing composer media", () => {
    expect(removeMissingComposerMarkdownMediaRefs({
      content: "![外链](https://example.com/a.jpg)\n![数字](media:7)",
      composerMediaAssets: [{ id: 7 }],
    })).toEqual({
      content: "![外链](https://example.com/a.jpg)\n![数字](media:7)",
      removedCount: 0,
    });
  });
});

describe("buildComposerSubmitPayload", () => {
  it("only submits markdown-referenced media assets for long posts", () => {
    expect(buildComposerSubmitPayload({
      communitySlug: "general",
      title: "标题",
      content: "正文\n![引用](media:pub-7)\n![数字](media:8)",
      composerMode: "long",
      composerMediaAssets: [
        { id: 7, publicId: "pub-7" },
        { id: 8, publicId: "pub-8" },
        { id: 9, publicId: "unused" },
      ],
      tags: ["梗图"],
    })).toEqual({
      communitySlug: "general",
      title: "标题",
      content: "正文\n![引用](media:pub-7)\n![数字](media:8)",
      postMode: "long",
      mediaAssetIds: [7, 8],
      tags: ["梗图"],
    });
  });

  it("keeps all uploaded media assets for rich posts", () => {
    expect(buildComposerSubmitPayload({
      communitySlug: "general",
      title: "标题",
      content: "配文 ![会被清理](media:7)",
      composerMode: "rich",
      composerMediaAssets: [
        { id: 7, publicId: "pub-7" },
        { id: 8, publicId: "pub-8" },
      ],
      tags: [],
    })).toEqual({
      communitySlug: "general",
      title: "标题",
      content: "配文",
      postMode: "rich",
      mediaAssetIds: [7, 8],
      tags: [],
    });
  });
});

describe("buildComposerSubmitValidation", () => {
  const validBaseInput = {
    title: "标题",
    communitySlug: "general",
    uploadingAssets: false,
    composerMode: "long",
    composerMediaUrls: [],
    content: "正文",
    composerMediaAssets: [],
  };

  it("keeps submit validation order stable from title to upload state", () => {
    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      title: " ",
      uploadingAssets: true,
    })).toEqual({
      message: "请输入主帖标题。",
      target: "title",
    });

    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      title: "1234567890123456789012345678901",
    })).toEqual({
      message: "主帖标题不能超过 30 个字。",
      target: "title",
    });

    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      communitySlug: "",
      uploadingAssets: true,
    })).toEqual({
      message: "请选择社区。",
      target: "community",
    });

    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      uploadingAssets: true,
    })).toEqual({
      message: "图片仍在上传，请完成后再发布。",
      target: "media",
    });
  });

  it("validates mode-specific content before submit", () => {
    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      composerMode: "rich",
      content: "",
      composerMediaUrls: [],
    })).toEqual({
      message: "图文模式至少上传 1 张图片。",
      target: "media",
    });

    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      content: " ",
    })).toEqual({
      message: "请输入主帖内容。",
      target: "content",
    });
  });

  it("requires a submit-ready media asset for rich posts", () => {
    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      composerMode: "rich",
      content: "",
      composerMediaUrls: ["/media/orphan.webp"],
      composerMediaAssets: [],
    })).toEqual({
      message: "图文模式至少上传 1 张图片。",
      target: "media",
    });
  });

  it("allows rich posts with processing media assets that do not have display urls yet", () => {
    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      composerMode: "rich",
      content: "",
      composerMediaUrls: [""],
      composerMediaAssets: [{ id: 7, processingStatus: "PROCESSING" }],
    })).toEqual({
      message: "",
      target: "",
    });
  });

  it("blocks long-form submit when markdown media refs are stale", () => {
    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      content: "正文\n![缺失](media:gone)",
      composerMediaAssets: [],
      tagValidationMessage: "TAG 最多 3 个，不能继续添加。",
    })).toEqual({
      message: "正文中有 1 张图片已不在当前草稿中，请删除对应的 media 图片引用或重新上传。",
      target: "content",
    });
  });

  it("returns tag validation after core post fields pass", () => {
    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      tagValidationMessage: "TAG 总长度不能超过 12 个字符。",
    })).toEqual({
      message: "TAG 总长度不能超过 12 个字符。",
      target: "tag",
    });
  });

  it("returns an empty validation result when local submit checks pass", () => {
    expect(buildComposerSubmitValidation({
      ...validBaseInput,
      content: "正文\n![存在](media:pub-1)",
      composerMediaAssets: [{ id: 7, publicId: "pub-1" }],
      tagValidationMessage: "",
    })).toEqual({
      message: "",
      target: "",
    });
  });
});

describe("buildComposerSubmitStatus", () => {
  it("shows a saving status for new post publishing", () => {
    expect(buildComposerSubmitStatus({
      publishing: true,
      submitError: "",
      isEditing: false,
    })).toEqual({
      type: "saving",
      message: "正在发布主帖...",
    });
  });

  it("shows a saving status for edit publishing", () => {
    expect(buildComposerSubmitStatus({
      publishing: true,
      submitError: "",
      isEditing: true,
    })).toEqual({
      type: "saving",
      message: "正在保存修改...",
    });
  });

  it("keeps publish failures visible and explains that content remains", () => {
    expect(buildComposerSubmitStatus({
      publishing: false,
      validationMessage: "",
      submitError: "网络连接失败",
      isEditing: false,
    })).toEqual({
      type: "error",
      message: "网络连接失败 内容仍保留在编辑器中，可以修改后重试。",
      canRetry: true,
      retryLabel: "重试发布",
    });
  });

  it("uses edit-specific retry copy after save failures", () => {
    expect(buildComposerSubmitStatus({
      publishing: false,
      validationMessage: "",
      submitError: "保存失败",
      isEditing: true,
    })).toEqual({
      type: "error",
      message: "保存失败 内容仍保留在编辑器中，可以修改后重试。",
      canRetry: true,
      retryLabel: "重试保存",
    });
  });

  it("shows local validation without publish-failure wording", () => {
    expect(buildComposerSubmitStatus({
      publishing: false,
      validationMessage: "请输入主帖标题。",
      validationTarget: "title",
      submitError: "网络连接失败",
      isEditing: false,
    })).toEqual({
      type: "validation",
      message: "请输入主帖标题。",
      focusTarget: "title",
    });
  });

  it("keeps saving status ahead of validation messages", () => {
    expect(buildComposerSubmitStatus({
      publishing: true,
      validationMessage: "请输入主帖标题。",
      validationTarget: "title",
      submitError: "网络连接失败",
      isEditing: false,
    })).toEqual({
      type: "saving",
      message: "正在发布主帖...",
    });
  });

  it("stays empty when idle", () => {
    expect(buildComposerSubmitStatus({
      publishing: false,
      submitError: "",
      isEditing: false,
    })).toEqual({ type: "" });
  });
});

describe("buildComposerPendingUploadSubmitValidation", () => {
  it("blocks publishing while selected images are still uploading", () => {
    expect(buildComposerPendingUploadSubmitValidation({
      uploadingAssets: true,
    })).toEqual({
      message: "图片仍在上传，请完成后再发布。",
      target: "media",
    });
  });

  it("stays empty when there is no pending upload", () => {
    expect(buildComposerPendingUploadSubmitValidation({
      uploadingAssets: false,
    })).toEqual({
      message: "",
      target: "",
    });
  });
});
