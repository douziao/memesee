import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeMainPostPrefetchId,
  resolveMainPostShareTarget,
  shouldPrefetchMainPostDetail,
} from "./useMainPostActions";
import { UI_MESSAGES } from "../../../shared/state/uiMessages";

const mainPostActionsSource = readFileSync(
  new URL("./useMainPostActions.js", import.meta.url),
  "utf8",
);

describe("shouldPrefetchMainPostDetail", () => {
  it("allows prefetching valid posts when the network budget allows it", () => {
    expect(shouldPrefetchMainPostDetail({
      post: { id: 42 },
      canPrefetch: true,
    })).toBe(true);
  });

  it("allows prefetching posts that only expose postId aliases", () => {
    expect(shouldPrefetchMainPostDetail({
      post: { postId: "42" },
      canPrefetch: true,
    })).toBe(true);
  });

  it("blocks prefetching when the network budget is constrained", () => {
    expect(shouldPrefetchMainPostDetail({
      post: { id: 42 },
      canPrefetch: false,
    })).toBe(false);
  });

  it("does not prefetch invalid posts", () => {
    expect(shouldPrefetchMainPostDetail({
      post: null,
      canPrefetch: true,
    })).toBe(false);
    expect(shouldPrefetchMainPostDetail({
      post: { id: 0 },
      canPrefetch: true,
    })).toBe(false);
    expect(shouldPrefetchMainPostDetail({
      post: { id: "abc" },
      canPrefetch: true,
    })).toBe(false);
  });

  it("suppresses repeated prefetch attempts inside the cooldown window", () => {
    expect(shouldPrefetchMainPostDetail({
      post: { id: 42 },
      canPrefetch: true,
      now: 2000,
      lastPrefetchedAt: 1200,
      cooldownMs: 1200,
    })).toBe(false);

    expect(shouldPrefetchMainPostDetail({
      post: { id: 42 },
      canPrefetch: true,
      now: 2400,
      lastPrefetchedAt: 1200,
      cooldownMs: 1200,
    })).toBe(true);
  });
});

describe("main post share feedback contract", () => {
  it("deduplicates active main-post share attempts by context key", () => {
    expect(mainPostActionsSource).toContain("const mainPostShareRequestKeysRef = useRef(new Set())");
    expect(mainPostActionsSource).toContain("const [activeMainPostShareKeys, setActiveMainPostShareKeys] = useState(() => new Set())");
    expect(mainPostActionsSource).toContain("beginShareRequest(mainPostShareRequestKeysRef.current, requestContextKey)");
    expect(mainPostActionsSource).toContain("finalizeShareRequest(mainPostShareRequestKeysRef.current, requestContextKey)");
  });

  it("exposes main-post sharing state without suppressing invalid share failures", () => {
    expect(mainPostActionsSource).toContain("function isSharingPost(post)");
    expect(mainPostActionsSource).toContain("return Boolean(requestContextKey && activeMainPostShareKeys.has(requestContextKey))");
    expect(mainPostActionsSource).toContain("const shouldDeduplicate = Boolean(requestContextKey)");
    expect(mainPostActionsSource).toContain("isSharingPost,");
  });
});

describe("main post deletion cache contract", () => {
  it("marks deleted posts unavailable in the detail runtime before mutation follow-up", () => {
    expect(mainPostActionsSource).toContain("detailQueryRuntime?.markDeletedPost?.(postId)");
    expect(mainPostActionsSource.indexOf("detailQueryRuntime?.markDeletedPost?.(postId)"))
      .toBeLessThan(mainPostActionsSource.indexOf("buildDeletedMainPostMutationStrategy({"));
  });
});

describe("normalizeMainPostPrefetchId", () => {
  it("normalizes positive integer post ids", () => {
    expect(normalizeMainPostPrefetchId({ id: 42 })).toBe(42);
    expect(normalizeMainPostPrefetchId({ id: "42" })).toBe(42);
    expect(normalizeMainPostPrefetchId({ postId: "42" })).toBe(42);
    expect(normalizeMainPostPrefetchId({ mainPostId: "42" })).toBe(42);
    expect(normalizeMainPostPrefetchId({ id: "draft", postId: 42 })).toBe(42);
    expect(normalizeMainPostPrefetchId({ id: 0 })).toBe(0);
    expect(normalizeMainPostPrefetchId({ id: "abc" })).toBe(0);
  });
});

describe("resolveMainPostShareTarget", () => {
  it("shares the main post when the current route has no target sub-post", () => {
    const post = {
      id: 42,
      title: "主帖标题",
      preview: "主帖摘要",
    };

    expect(resolveMainPostShareTarget({
      route: { type: "post", mainPostId: 42 },
      post,
      subPosts: [{ id: 7, content: "子帖正文" }],
    })).toEqual({
      post,
      targetSubPostId: 0,
      sharedMessage: UI_MESSAGES.postShared,
      copiedMessage: UI_MESSAGES.postLinkCopied,
    });
  });

  it("shares the target sub-post when the current route is a sub-post deep link", () => {
    const result = resolveMainPostShareTarget({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      post: {
        id: 42,
        title: "主帖标题",
        preview: "主帖摘要",
      },
      subPosts: [{
        id: 7,
        author: "alice",
        content: "这条子帖更适合继续传播。",
      }],
    });

    expect(result.targetSubPostId).toBe(7);
    expect(result.sharedMessage).toBe(UI_MESSAGES.subPostShared);
    expect(result.copiedMessage).toBe(UI_MESSAGES.subPostLinkCopied);
    expect(result.copiedMessage).toBe("定位分享已复制。");
    expect(result.post).toMatchObject({
      id: 42,
      title: "主帖标题 · @alice 的子帖",
      preview: "这条子帖更适合继续传播。",
    });
  });

  it("shares target sub-post content when sub-post rows only expose subPostId aliases", () => {
    const result = resolveMainPostShareTarget({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      post: {
        id: 42,
        title: "主帖标题",
        preview: "主帖摘要",
      },
      subPosts: [{
        id: "draft",
        subPostId: "7",
        authorUsername: "bob",
        content: "别名子帖更适合继续传播。",
      }],
    });

    expect(result.targetSubPostId).toBe(7);
    expect(result.post).toMatchObject({
      id: 42,
      title: "主帖标题 · @bob 的子帖",
      preview: "别名子帖更适合继续传播。",
    });
  });

  it("shares target sub-post content when the target is inside a loaded branch", () => {
    const result = resolveMainPostShareTarget({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "11",
      },
      post: {
        id: 42,
        title: "主帖标题",
        preview: "主帖摘要",
      },
      subPosts: [{
        id: 7,
        author: "alice",
        content: "顶层子帖",
        branchSubPosts: [{
          id: 11,
          parentId: 7,
          authorUsername: "carol",
          content: "分支里的这条子帖才是分享目标。",
        }],
      }],
    });

    expect(result.targetSubPostId).toBe(11);
    expect(result.sharedMessage).toBe(UI_MESSAGES.subPostShared);
    expect(result.post).toMatchObject({
      id: 42,
      title: "主帖标题 · @carol 的子帖",
      preview: "分支里的这条子帖才是分享目标。",
      shareTargetAuthor: "carol",
    });
  });

  it("falls back to the main post when the route target sub-post is not loaded", () => {
    const post = {
      id: 42,
      title: "主帖标题",
      preview: "主帖摘要",
    };

    expect(resolveMainPostShareTarget({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: "7",
      },
      post,
      subPosts: [{
        id: 8,
        author: "bob",
        content: "另一条子帖",
      }],
    })).toEqual({
      post,
      targetSubPostId: 0,
      sharedMessage: UI_MESSAGES.postShared,
      copiedMessage: UI_MESSAGES.postLinkCopied,
    });
  });
});
