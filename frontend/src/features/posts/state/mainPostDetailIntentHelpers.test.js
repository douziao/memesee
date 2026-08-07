import { describe, expect, it, vi } from "vitest";
import {
  buildClearCurrentMainPostDetailIntent,
  buildMainPostDetailIntentExecutionContext,
  buildSyncCurrentMainPostDetailIntent,
  executeMainPostDetailIntent,
} from "./mainPostDetailIntentHelpers";

describe("main post detail intent cache sync", () => {
  it("syncs cached post details when the current detail state is patched", async () => {
    const setPostDetail = vi.fn((updater) =>
      updater({ id: 42, title: "旧标题" }),
    );
    const updatePostDetailCache = vi.fn();
    const buildNextDetail = (post) => ({
      ...post,
      title: "新标题",
    });

    await expect(executeMainPostDetailIntent(buildMainPostDetailIntentExecutionContext({
      detailIntent: buildSyncCurrentMainPostDetailIntent(42),
      currentDetailPostId: 42,
      setPostDetail,
      buildNextDetail,
      updatePostDetailCache,
    }))).resolves.toBe(true);

    expect(updatePostDetailCache).toHaveBeenCalledWith(42, buildNextDetail);
    expect(setPostDetail).toHaveBeenCalledTimes(1);
  });

  it("clears cached post details when the current detail state is cleared", async () => {
    const setPostDetail = vi.fn();
    const setSubPosts = vi.fn();
    const updatePostDetailCache = vi.fn();

    await expect(executeMainPostDetailIntent(buildMainPostDetailIntentExecutionContext({
      detailIntent: buildClearCurrentMainPostDetailIntent(42),
      currentDetailPostId: 42,
      setPostDetail,
      setSubPosts,
      updatePostDetailCache,
    }))).resolves.toBe(true);

    expect(updatePostDetailCache).toHaveBeenCalledWith(42, expect.any(Function));
    expect(updatePostDetailCache.mock.calls[0][1]({ id: 42 })).toBeNull();
    expect(setPostDetail).toHaveBeenCalledWith(null);
    expect(setSubPosts).toHaveBeenCalledWith([]);
  });

  it("syncs cached post details without patching a different current detail", async () => {
    const setPostDetail = vi.fn();
    const updatePostDetailCache = vi.fn();
    const buildNextDetail = (post) => ({
      ...post,
      title: "新标题",
    });

    await expect(executeMainPostDetailIntent(buildMainPostDetailIntentExecutionContext({
      detailIntent: buildSyncCurrentMainPostDetailIntent(42),
      currentDetailPostId: 7,
      setPostDetail,
      buildNextDetail,
      updatePostDetailCache,
    }))).resolves.toBe(true);

    expect(updatePostDetailCache).toHaveBeenCalledWith(42, buildNextDetail);
    expect(setPostDetail).not.toHaveBeenCalled();
  });

  it("clears cached post details without clearing a different current detail", async () => {
    const setPostDetail = vi.fn();
    const setSubPosts = vi.fn();
    const updatePostDetailCache = vi.fn();

    await expect(executeMainPostDetailIntent(buildMainPostDetailIntentExecutionContext({
      detailIntent: buildClearCurrentMainPostDetailIntent(42),
      currentDetailPostId: 7,
      setPostDetail,
      setSubPosts,
      updatePostDetailCache,
    }))).resolves.toBe(true);

    expect(updatePostDetailCache).toHaveBeenCalledWith(42, expect.any(Function));
    expect(updatePostDetailCache.mock.calls[0][1]({ id: 42 })).toBeNull();
    expect(setPostDetail).not.toHaveBeenCalled();
    expect(setSubPosts).not.toHaveBeenCalled();
  });

  it("skips malformed optional cleanup runtimes while clearing current detail", async () => {
    const setPostDetail = vi.fn();

    await expect(executeMainPostDetailIntent(buildMainPostDetailIntentExecutionContext({
      detailIntent: buildClearCurrentMainPostDetailIntent(42),
      currentDetailPostId: 42,
      setPostDetail,
      setSubPosts: { stale: true },
    }))).resolves.toBe(true);

    expect(setPostDetail).toHaveBeenCalledWith(null);
  });
});
