// @vitest-environment happy-dom
import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSubPost,
  deleteSubPost as deleteContentSubPost,
  getMediaAsset,
  uploadMediaAsset,
} from "../../content/api/contentApi";
import { useSubPostThread } from "./useSubPostThread";
import { UI_MESSAGES } from "../../../shared/state/uiMessages";
import { registerConfirmDialogHandler } from "../../../shared/platform/browserDialog";

vi.mock("../../content/api/contentApi", () => ({
  createSubPost: vi.fn(),
  deleteSubPost: vi.fn(),
  getMediaAsset: vi.fn(),
  toggleSubPostFavorite: vi.fn(),
  toggleSubPostLike: vi.fn(),
  uploadMediaAsset: vi.fn(),
}));

function HookHarness({ props, onRender }) {
  const value = useSubPostThread(props);

  useEffect(() => {
    onRender(value);
  }, [onRender, value]);

  return null;
}

function createImageFile(name = "reply.png") {
  return new File(["image-bytes"], name, { type: "image/png" });
}

function createPickEvent(files) {
  return {
    target: {
      files,
      value: "selected",
    },
  };
}

function createSubmitEvent() {
  return {
    preventDefault: vi.fn(),
  };
}

function createDefaultHookProps(overrides = {}) {
  return {
    routeType: "post",
    mainPostId: 42,
    routeManageSource: "",
    targetSubPostId: null,
    isLoggedIn: true,
    detailQueryRuntime: {
      selectedPost: {
        id: 42,
        communitySlug: "general",
      },
      subPosts: [],
      setSubPosts: vi.fn(),
      orderedSubPostFloors: [],
      loadingSubPosts: false,
      loadingMoreSubPosts: false,
      subPostsHasMore: false,
      subPostsError: "",
      loadingMoreSubPostsError: "",
      loadMoreSubPosts: vi.fn(),
      subPostCursor: "",
    },
    token: "token",
    client: { defaults: { baseURL: "https://api.example.com" } },
    setMessage: vi.fn(),
    setRoute: vi.fn(),
    onAuthRequired: vi.fn(),
    reportUserActivity: vi.fn().mockResolvedValue(undefined),
    currentUser: "alice",
    topbarRef: { current: null },
    subPostTextareaRef: { current: { focus: vi.fn() } },
    onSubPostDeleted: vi.fn(),
    onSubPostInteractionSynced: vi.fn(),
    mainPostMutationInterface: {
      executeMainPostMutationStrategy: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

describe("useSubPostThread media composer flow", () => {
  let root;
  let container;
  let latestHookValue;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    latestHookValue = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  async function renderHook(props = createDefaultHookProps()) {
    await act(async () => {
      root.render(
        <HookHarness
          props={props}
          onRender={(value) => {
            latestHookValue = value;
          }}
        />,
      );
    });
  }

  it("uploads image assets and submits a media-only sub-post with mediaAssetIds", async () => {
    const props = createDefaultHookProps();
    await renderHook(props);
    uploadMediaAsset.mockResolvedValueOnce({
      id: 99,
      displayUrl: "/media/99/display.webp",
      processingStatus: "READY",
    });
    createSubPost.mockResolvedValueOnce({
      id: 7,
      mainPostId: 42,
      content: "",
      mediaAssets: [{ id: 99 }],
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    await act(async () => {
      await latestHookValue.onSubPostMediaPicked(createPickEvent([createImageFile()]));
    });

    expect(uploadMediaAsset).toHaveBeenCalledWith(props.client, {
      token: "token",
      file: expect.any(File),
    });
    expect(latestHookValue.subPostMediaAssets).toEqual([
      expect.objectContaining({ id: 99 }),
    ]);
    expect(latestHookValue.subPostMediaUploadStatus).toEqual({
      type: "success",
      message: "上传 1 张图片",
    });

    const submitEvent = createSubmitEvent();
    await act(async () => {
      await latestHookValue.submitSubPost(submitEvent);
    });

    expect(submitEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(createSubPost).toHaveBeenCalledWith(props.client, {
      token: "token",
      mainPostId: 42,
      parentSubPostId: null,
      content: "",
      mediaAssetIds: [99],
    });
    expect(props.reportUserActivity).toHaveBeenCalledWith(
      { type: "SUB_POST_CREATED", communitySlug: "general" },
      { silent: true },
    );
    expect(props.mainPostMutationInterface.executeMainPostMutationStrategy)
      .toHaveBeenCalledTimes(1);
    expect(props.mainPostMutationInterface.executeMainPostMutationStrategy)
      .toHaveBeenCalledWith(expect.objectContaining({
        mutationPlan: expect.objectContaining({
          syncFeed: false,
          detailIntent: expect.objectContaining({
            type: "reload_current_thread",
            mainPostId: 42,
          }),
        }),
        effectBuilders: expect.objectContaining({
          buildNextDetail: expect.any(Function),
        }),
      }));
    const mutationStrategy =
      props.mainPostMutationInterface.executeMainPostMutationStrategy.mock.calls[0][0];
    expect(mutationStrategy.effectBuilders.buildNextDetail({
      id: 42,
      subPostCount: 0,
      latestActivityAt: "2026-01-01T00:00:00.000Z",
    })).toMatchObject({
      id: 42,
      subPostCount: 1,
      latestActivityAt: "2026-01-02T00:00:00.000Z",
    });
    expect(props.setMessage).toHaveBeenLastCalledWith(UI_MESSAGES.subPostCreated);
    expect(latestHookValue.subPostMediaAssets).toEqual([]);
    expect(latestHookValue.subPostMediaUploadStatus).toEqual({ type: "" });
  });

  it("ignores late upload results after the composer draft is cancelled", async () => {
    await renderHook();
    let resolveUpload;
    uploadMediaAsset.mockReturnValueOnce(new Promise((resolve) => {
      resolveUpload = resolve;
    }));

    await act(async () => {
      latestHookValue.onSubPostMediaPicked(createPickEvent([createImageFile("late.png")]));
      await Promise.resolve();
    });

    expect(latestHookValue.uploadingSubPostMedia).toBe(true);

    await act(async () => {
      latestHookValue.cancelTopSubPostComposer();
    });

    await act(async () => {
      resolveUpload({
        id: 77,
        displayUrl: "/media/77/display.webp",
        processingStatus: "READY",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestHookValue.uploadingSubPostMedia).toBe(false);
    expect(latestHookValue.subPostMediaAssets).toEqual([]);
    expect(latestHookValue.subPostMediaUploadStatus).toEqual({ type: "" });
  });

  it("keeps failed upload files retryable without discarding the draft", async () => {
    const props = createDefaultHookProps();
    await renderHook(props);
    const failedFile = createImageFile("retry.png");
    uploadMediaAsset
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        id: 88,
        displayUrl: "/media/88/display.webp",
        processingStatus: "READY",
      });

    await act(async () => {
      await latestHookValue.onSubPostMediaPicked(createPickEvent([failedFile]));
    });

    expect(latestHookValue.uploadingSubPostMedia).toBe(false);
    expect(latestHookValue.subPostMediaAssets).toEqual([]);
    expect(latestHookValue.subPostMediaUploadStatus).toEqual({
      type: "warning",
      message: "失败 1 张",
      canRetry: true,
    });

    await act(async () => {
      await latestHookValue.retryFailedSubPostMediaUploads();
    });

    expect(uploadMediaAsset).toHaveBeenNthCalledWith(2, props.client, {
      token: "token",
      file: failedFile,
    });
    expect(latestHookValue.subPostMediaAssets).toEqual([
      expect.objectContaining({ id: 88 }),
    ]);
    expect(latestHookValue.subPostMediaUploadStatus).toEqual({
      type: "success",
      message: "上传 1 张图片",
    });
  });

  it("refreshes processing sub-post draft media before publishing", async () => {
    const props = createDefaultHookProps();
    await renderHook(props);
    uploadMediaAsset.mockResolvedValueOnce({
      id: 66,
      displayUrl: "",
      processingStatus: "PROCESSING",
    });
    getMediaAsset.mockResolvedValueOnce({
      id: 66,
      displayUrl: "/media/66/display.webp",
      processingStatus: "READY",
    });

    await act(async () => {
      await latestHookValue.onSubPostMediaPicked(createPickEvent([createImageFile("processing.png")]));
    });

    expect(latestHookValue.subPostMediaAssets).toEqual([
      expect.objectContaining({ id: 66, processingStatus: "PROCESSING" }),
    ]);

    await act(async () => {
      await latestHookValue.refreshSubPostMediaAssets();
    });

    expect(getMediaAsset).toHaveBeenCalledWith(props.client, { assetId: 66 });
    expect(latestHookValue.uploadingSubPostMedia).toBe(false);
    expect(latestHookValue.subPostMediaAssets).toEqual([
      expect.objectContaining({
        id: 66,
        displayUrl: "/media/66/display.webp",
        processingStatus: "READY",
      }),
    ]);
    expect(latestHookValue.subPostMediaUploadStatus).toEqual({ type: "" });
  });

  it("clears the target sub-post route after deleting the currently located sub-post", async () => {
    const unregisterConfirm = registerConfirmDialogHandler(() => Promise.resolve(true));
    const setSubPosts = vi.fn();
    const reloadCurrentSubPosts = vi.fn().mockResolvedValue([]);
    const props = createDefaultHookProps({
      targetSubPostId: 7,
      setRoute: vi.fn(),
      detailQueryRuntime: {
        ...createDefaultHookProps().detailQueryRuntime,
        subPosts: [
          { id: 7, author: "alice" },
          { id: 8, author: "bob" },
        ],
        orderedSubPostFloors: [{ id: 7, author: "alice" }],
        setSubPosts,
        reloadCurrentSubPosts,
      },
    });
    deleteContentSubPost.mockResolvedValueOnce({});
    window.history.replaceState(null, "", "/posts/42?subPost=7");

    try {
      await renderHook(props);

      await act(async () => {
        await latestHookValue.deleteSubPost({ id: 7, author: "alice" });
      });

      expect(deleteContentSubPost).toHaveBeenCalledWith(props.client, {
        token: "token",
        subPostId: 7,
      });
      expect(props.setRoute).toHaveBeenCalledWith({
        type: "post",
        mainPostId: 42,
        manageSource: "",
      });
      expect(window.location.pathname).toBe("/posts/42");
      expect(window.location.search).toBe("");
      expect(reloadCurrentSubPosts).toHaveBeenCalledTimes(1);
      expect(setSubPosts).toHaveBeenCalledWith(expect.any(Function));
      expect(setSubPosts.mock.calls[0][0]([
        { id: 7, author: "alice" },
        { id: 8, author: "bob" },
      ])).toEqual([{ id: 8, author: "bob" }]);
      expect(props.mainPostMutationInterface.executeMainPostMutationStrategy)
        .toHaveBeenCalledWith(expect.objectContaining({
          mutationPlan: expect.objectContaining({
            syncFeed: true,
            detailIntent: expect.objectContaining({
              type: "reload_current_thread",
              mainPostId: 42,
            }),
          }),
          effectBuilders: expect.objectContaining({
            buildNextDetail: expect.any(Function),
            buildNextPosts: expect.any(Function),
          }),
        }));
      const mutationStrategy =
        props.mainPostMutationInterface.executeMainPostMutationStrategy.mock.calls[0][0];
      expect(mutationStrategy.effectBuilders.buildNextDetail({
        id: 42,
        subPostCount: 1,
      })).toMatchObject({
        id: 42,
        subPostCount: 0,
      });
      expect(props.setMessage).toHaveBeenLastCalledWith(UI_MESSAGES.subPostDeleted);
    } finally {
      unregisterConfirm();
    }
  });

  it("finishes delete feedback when the optional deleted callback is unavailable", async () => {
    const unregisterConfirm = registerConfirmDialogHandler(() => Promise.resolve(true));
    const props = createDefaultHookProps({
      onSubPostDeleted: { stale: true },
      detailQueryRuntime: {
        ...createDefaultHookProps().detailQueryRuntime,
        subPosts: [{ id: 7, author: "alice" }],
        setSubPosts: { stale: true },
        reloadCurrentSubPosts: vi.fn().mockResolvedValue([]),
      },
    });
    deleteContentSubPost.mockResolvedValueOnce({});

    try {
      await renderHook(props);

      await act(async () => {
        await latestHookValue.deleteSubPost({ id: 7, author: "alice" });
      });

      expect(deleteContentSubPost).toHaveBeenCalledWith(props.client, {
        token: "token",
        subPostId: 7,
      });
      expect(props.setMessage).toHaveBeenLastCalledWith(UI_MESSAGES.subPostDeleted);
    } finally {
      unregisterConfirm();
    }
  });

  it("keeps successful delete feedback when follow-up thread convergence fails", async () => {
    const unregisterConfirm = registerConfirmDialogHandler(() => Promise.resolve(true));
    const props = createDefaultHookProps({
      detailQueryRuntime: {
        ...createDefaultHookProps().detailQueryRuntime,
        subPosts: [{ id: 7, author: "alice" }],
        setSubPosts: vi.fn(),
        reloadCurrentSubPosts: vi.fn().mockRejectedValue(new Error("reload failed")),
      },
      mainPostMutationInterface: {
        executeMainPostMutationStrategy: vi.fn().mockRejectedValue(new Error("sync failed")),
      },
    });
    deleteContentSubPost.mockResolvedValueOnce({});

    try {
      await renderHook(props);

      await act(async () => {
        await latestHookValue.deleteSubPost({ id: 7, author: "alice" });
      });

      expect(deleteContentSubPost).toHaveBeenCalledWith(props.client, {
        token: "token",
        subPostId: 7,
      });
      expect(props.setMessage).toHaveBeenLastCalledWith(UI_MESSAGES.subPostDeleted);
    } finally {
      unregisterConfirm();
    }
  });
});
