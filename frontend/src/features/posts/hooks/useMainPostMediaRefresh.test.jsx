// @vitest-environment happy-dom
import React, { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMediaAsset } from "../../content/api/contentApi";
import { useMainPostMediaRefresh } from "./useMainPostMediaRefresh";

vi.mock("../../content/api/contentApi", () => ({
  getMediaAsset: vi.fn(),
}));

function HookHarness({
  client,
  initialPosts,
  initialPostDetail,
  updatePostDetailCache,
  onRender,
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [postDetail, setPostDetail] = useState(initialPostDetail);

  useMainPostMediaRefresh({
    client,
    apiBase: "https://api.example.com",
    posts,
    selectedPost: postDetail,
    setPosts,
    setPostDetail,
    updatePostDetailCache,
  });

  useEffect(() => {
    onRender({ posts, postDetail });
  }, [onRender, postDetail, posts]);

  return null;
}

describe("useMainPostMediaRefresh", () => {
  let root;
  let container;
  let latestState;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    latestState = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  async function renderHarness(props) {
    await act(async () => {
      root.render(
        <HookHarness
          {...props}
          onRender={(state) => {
            latestState = state;
          }}
        />,
      );
    });
  }

  it("refreshes processing media across feed posts, selected detail, and detail cache", async () => {
    const client = { defaults: { baseURL: "https://api.example.com" } };
    const updatePostDetailCache = vi.fn();
    await renderHarness({
      client,
      updatePostDetailCache,
      initialPosts: [
        {
          id: 42,
          postMode: "rich",
          mediaAssets: [
            {
              id: 7,
              processingStatus: "PROCESSING",
              width: 1600,
              height: 900,
            },
          ],
        },
      ],
      initialPostDetail: {
        id: 42,
        postMode: "rich",
        mediaAssets: [
          {
            id: 7,
            processingStatus: "PROCESSING",
            width: 1600,
            height: 900,
          },
        ],
      },
    });

    getMediaAsset.mockResolvedValueOnce({
      id: 7,
      displayUrl: "/media/7/display.webp",
      thumbUrl: "/media/7/thumb.webp",
      originalUrl: "/media/7/original.webp",
      processingStatus: "READY",
      width: 1600,
      height: 900,
    });

    await act(async () => {
      vi.advanceTimersByTime(3500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getMediaAsset).toHaveBeenCalledTimes(1);
    expect(getMediaAsset).toHaveBeenCalledWith(client, { assetId: 7 });
    expect(latestState.posts[0].mediaUrls).toEqual(["https://api.example.com/media/7/display.webp"]);
    expect(latestState.posts[0].previewImages).toEqual(["https://api.example.com/media/7/thumb.webp"]);
    expect(latestState.postDetail.mediaAssets[0]).toMatchObject({
      id: 7,
      displayUrl: "https://api.example.com/media/7/display.webp",
      processingStatus: "READY",
    });
    expect(updatePostDetailCache).toHaveBeenCalledWith(42, expect.any(Function));
    const cacheUpdater = updatePostDetailCache.mock.calls[0][1];
    expect(cacheUpdater({
      id: 42,
      mediaAssets: [{ id: 7, processingStatus: "PROCESSING" }],
    }).mediaUrls).toEqual(["https://api.example.com/media/7/display.webp"]);
  });

  it("does not request media when visible posts have no processing assets", async () => {
    await renderHarness({
      client: { defaults: { baseURL: "https://api.example.com" } },
      updatePostDetailCache: vi.fn(),
      initialPosts: [
        {
          id: 42,
          mediaAssets: [{ id: 7, processingStatus: "READY", displayUrl: "/media/7.webp" }],
        },
      ],
      initialPostDetail: null,
    });

    await act(async () => {
      vi.advanceTimersByTime(7000);
      await Promise.resolve();
    });

    expect(getMediaAsset).not.toHaveBeenCalled();
  });
});
