import { describe, expect, it, vi } from "vitest";
import {
  buildMainPostMutationRuntime,
  executeMainPostMutationStrategy,
} from "./mainPostMutationRuntimeHelpers";
import {
  buildDeletedMainPostMutationStrategy,
  buildDeletedSubPostMutationStrategy,
  buildSavedMainPostMutationStrategy,
} from "./mainPostMutationStrategyHelpers";

describe("main post mutation runtime compatibility", () => {
  it("forwards detail cache updates when a saved post sync runs through the legacy runtime", async () => {
    const setPosts = vi.fn((updater) => updater([]));
    const setPostDetail = vi.fn();
    const updatePostDetailCache = vi.fn();

    const mutationRuntime = buildMainPostMutationRuntime({
      currentDetailPostId: 7,
      setPosts,
      setPostDetail,
      updatePostDetailCache,
    });
    const mutationStrategy = buildSavedMainPostMutationStrategy({
      feedQueryState: {
        selectedCommunitySlug: "lobby",
        feedSortMode: "latest_message",
      },
      savedPost: {
        id: 42,
        title: "Updated title",
        communitySlug: "lobby",
      },
    });

    await executeMainPostMutationStrategy(mutationStrategy, mutationRuntime);

    expect(updatePostDetailCache).toHaveBeenCalledWith(42, expect.any(Function));
    expect(updatePostDetailCache.mock.calls[0][1]({
      id: 42,
      title: "Old title",
    })).toMatchObject({
      id: 42,
      title: "Updated title",
    });
    expect(setPostDetail).not.toHaveBeenCalled();
  });

  it("clears cached deleted post details without clearing another current detail", async () => {
    const setPosts = vi.fn((updater) => updater([
      { id: 42, title: "Deleted post" },
      { id: 7, title: "Current detail" },
    ]));
    const setPostDetail = vi.fn();
    const setSubPosts = vi.fn();
    const updatePostDetailCache = vi.fn();

    const mutationRuntime = buildMainPostMutationRuntime({
      currentDetailPostId: 7,
      setPosts,
      setPostDetail,
      setSubPosts,
      updatePostDetailCache,
    });
    const mutationStrategy = buildDeletedMainPostMutationStrategy({
      route: { type: "home" },
      selectedPostId: 7,
      deletedPostId: 42,
    });

    await executeMainPostMutationStrategy(mutationStrategy, mutationRuntime);

    expect(updatePostDetailCache).toHaveBeenCalledWith(42, expect.any(Function));
    expect(updatePostDetailCache.mock.calls[0][1]({ id: 42 })).toBeNull();
    expect(setPostDetail).not.toHaveBeenCalled();
    expect(setSubPosts).not.toHaveBeenCalled();
  });

  it("reloads the current thread when a sub-post is deleted from the active detail", async () => {
    const setPosts = vi.fn((updater) => updater([
      { id: 42, title: "Current detail", subPostCount: 1 },
    ]));
    const reloadCurrentPostThread = vi.fn().mockResolvedValue({
      postDetail: { id: 42, subPostCount: 0 },
      subPosts: [],
    });
    const mutationRuntime = buildMainPostMutationRuntime({
      currentDetailPostId: 42,
      setPosts,
      setPostDetail: vi.fn(),
      reloadCurrentPostThread,
    });
    const mutationStrategy = buildDeletedSubPostMutationStrategy({
      selectedPostId: 42,
      targetMainPostId: 42,
    });

    await executeMainPostMutationStrategy(mutationStrategy, mutationRuntime);

    expect(reloadCurrentPostThread).toHaveBeenCalledTimes(1);
  });
});
