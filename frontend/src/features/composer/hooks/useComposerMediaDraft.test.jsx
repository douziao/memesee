// @vitest-environment happy-dom
import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComposerMediaDraft } from "./useComposerMediaDraft";
import { getMediaAsset } from "../../content/api/contentApi";

vi.mock("../../content/api/contentApi", () => ({
  getMediaAsset: vi.fn(),
  uploadMediaAsset: vi.fn(),
}));

function HookHarness({ props, onRender }) {
  const value = useComposerMediaDraft(props);

  useEffect(() => {
    onRender(value);
  }, [onRender, value]);

  return null;
}

function createDefaultHookProps(overrides = {}) {
  return {
    client: { defaults: { baseURL: "https://api.example.com" } },
    token: "token",
    isLoggedIn: true,
    composerCommunitySlug: "general",
    composerMode: "long",
    routeType: "compose",
    editingMainPostId: null,
    setContent: vi.fn(),
    setMessage: vi.fn(),
    getContentInsertSelection: vi.fn(),
    onContentInserted: vi.fn(),
    onAuthRequired: vi.fn(),
    ...overrides,
  };
}

describe("useComposerMediaDraft media refresh", () => {
  let root;
  let container;
  let latestHookValue;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
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
    vi.clearAllTimers();
    vi.useRealTimers();
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

  it("refreshes processing composer assets and updates the preview URL when media becomes ready", async () => {
    const props = createDefaultHookProps();
    await renderHook(props);

    await act(async () => {
      latestHookValue.hydrateComposerMediaDraft({
        mediaUrls: [""],
        mediaAssets: [
          {
            id: 42,
            processingStatus: "PROCESSING",
          },
        ],
      });
    });

    getMediaAsset.mockResolvedValueOnce({
      id: 42,
      displayUrl: "https://api.example.com/media/42/display.webp",
      processingStatus: "READY",
      width: 1200,
      height: 800,
    });

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getMediaAsset).toHaveBeenCalledTimes(1);
    expect(getMediaAsset).toHaveBeenCalledWith(props.client, { assetId: 42 });
    expect(latestHookValue.composerMediaUrls).toEqual([
      "https://api.example.com/media/42/display.webp",
    ]);
    expect(latestHookValue.composerMediaAssets).toEqual([
      expect.objectContaining({
        id: 42,
        displayUrl: "https://api.example.com/media/42/display.webp",
        processingStatus: "READY",
        width: 1200,
        height: 800,
      }),
    ]);
  });

  it("does not refresh processing media outside the compose route", async () => {
    await renderHook(createDefaultHookProps({ routeType: "detail" }));

    await act(async () => {
      latestHookValue.hydrateComposerMediaDraft({
        mediaUrls: [""],
        mediaAssets: [
          {
            id: 9,
            processingStatus: "PROCESSING",
          },
        ],
      });
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(getMediaAsset).not.toHaveBeenCalled();
    expect(latestHookValue.composerMediaUrls).toEqual([""]);
  });
});
