import { describe, expect, it, vi } from "vitest";
import { buildDetailQueryRuntime } from "./appDataQueryRuntimeHelpers";

describe("buildDetailQueryRuntime", () => {
  it("preserves the sub-post state setter for detail mutation runtimes", () => {
    const setSubPosts = vi.fn();

    const runtime = buildDetailQueryRuntime({
      selectedPost: { id: 42 },
      setPostDetail: vi.fn(),
      setSubPosts,
    });

    expect(runtime.currentDetailPostId).toBe(42);
    expect(runtime.setSubPosts).toBe(setSubPosts);
  });
});
