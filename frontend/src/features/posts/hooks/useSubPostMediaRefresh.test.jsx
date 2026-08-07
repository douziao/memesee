// @vitest-environment happy-dom
import React, { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMediaAsset } from "../../content/api/contentApi";
import { useSubPostMediaRefresh } from "./useSubPostMediaRefresh";

vi.mock("../../content/api/contentApi", () => ({
  getMediaAsset: vi.fn(),
}));

function HookHarness({
  client,
  initialSubPosts,
  onRender,
}) {
  const [subPosts, setSubPosts] = useState(initialSubPosts);

  useSubPostMediaRefresh({
    client,
    apiBase: "https://api.example.com",
    subPosts,
    setSubPosts,
  });

  useEffect(() => {
    onRender({ subPosts });
  }, [onRender, subPosts]);

  return null;
}

describe("useSubPostMediaRefresh", () => {
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

  it("refreshes processing media in loaded sub-posts", async () => {
    const client = { defaults: { baseURL: "https://api.example.com" } };
    await renderHarness({
      client,
      initialSubPosts: [
        {
          id: 7,
          mediaAssets: [
            {
              id: 11,
              processingStatus: "PROCESSING",
              width: 1600,
              height: 900,
            },
          ],
        },
      ],
    });

    getMediaAsset.mockResolvedValueOnce({
      id: 11,
      displayUrl: "/media/11/display.webp",
      originalUrl: "/media/11/original.webp",
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
    expect(getMediaAsset).toHaveBeenCalledWith(client, { assetId: 11 });
    expect(latestState.subPosts[0].mediaUrls).toEqual([
      "https://api.example.com/media/11/display.webp",
    ]);
    expect(latestState.subPosts[0].mediaAssets[0]).toMatchObject({
      id: 11,
      displayUrl: "https://api.example.com/media/11/display.webp",
      processingStatus: "READY",
    });
  });

  it("does not request media when loaded sub-posts have no processing assets", async () => {
    await renderHarness({
      client: { defaults: { baseURL: "https://api.example.com" } },
      initialSubPosts: [
        {
          id: 7,
          mediaAssets: [{ id: 11, processingStatus: "READY", displayUrl: "/media/11.webp" }],
        },
      ],
    });

    await act(async () => {
      vi.advanceTimersByTime(7000);
      await Promise.resolve();
    });

    expect(getMediaAsset).not.toHaveBeenCalled();
  });
});
