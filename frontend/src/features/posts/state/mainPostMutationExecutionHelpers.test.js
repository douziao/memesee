import { describe, expect, it, vi } from "vitest";
import { buildClearCurrentMainPostDetailIntent } from "./mainPostDetailIntentHelpers";
import {
  buildMainPostDetailExecutionRuntime,
  executeMainPostDetailExecution,
} from "./mainPostMutationExecutionHelpers";

describe("main post mutation detail execution compatibility", () => {
  it("forwards cache and sub-post cleanup helpers for clear detail intents", async () => {
    const setPostDetail = vi.fn();
    const setSubPosts = vi.fn();
    const updatePostDetailCache = vi.fn();

    const detailExecutionRuntime = buildMainPostDetailExecutionRuntime({
      detailIntent: buildClearCurrentMainPostDetailIntent(42),
      currentDetailPostId: 42,
      setPostDetail,
      setSubPosts,
      updatePostDetailCache,
    });

    await expect(
      executeMainPostDetailExecution(detailExecutionRuntime),
    ).resolves.toBe(true);

    expect(updatePostDetailCache).toHaveBeenCalledWith(42, expect.any(Function));
    expect(updatePostDetailCache.mock.calls[0][1]({ id: 42 })).toBeNull();
    expect(setPostDetail).toHaveBeenCalledWith(null);
    expect(setSubPosts).toHaveBeenCalledWith([]);
  });
});
