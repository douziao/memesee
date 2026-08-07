import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildSubPostMediaUploadStatus,
  collectSubPostComposerMediaAssetIds,
  buildSubPostEngagementRequestKey,
  buildSubPostLocationCopyUrl,
  hasSubPostComposerSubmitContent,
  isSubPostComposerMediaAssetSubmitReady,
  mergeSubPostComposerMediaAssets,
  notifySubPostAuthRequired,
  removeSubPostComposerMediaAt,
  shouldApplySubPostEngagementRequestResult,
} from "./useSubPostThread";
import { UI_MESSAGES } from "../../../shared/state/uiMessages";

const subPostThreadSource = readFileSync(
  new URL("./useSubPostThread.js", import.meta.url),
  "utf8",
);

describe("buildSubPostEngagementRequestKey", () => {
  it("builds independent latest-request keys per sub-post and action", () => {
    expect(buildSubPostEngagementRequestKey({
      subPostId: "42",
      action: "Like",
    })).toBe("like:42");

    expect(buildSubPostEngagementRequestKey({
      subPostId: 42,
      action: "favorite",
    })).toBe("favorite:42");
  });

  it("rejects malformed sub-post engagement request keys", () => {
    expect(buildSubPostEngagementRequestKey({
      subPostId: 0,
      action: "like",
    })).toBe("");
    expect(buildSubPostEngagementRequestKey({
      subPostId: "bad-id",
      action: "like",
    })).toBe("");
    expect(buildSubPostEngagementRequestKey({
      subPostId: 42,
      action: "",
    })).toBe("");
  });
});

describe("buildSubPostLocationCopyUrl", () => {
  it("builds a stable public target link without relying on the current URL", () => {
    expect(buildSubPostLocationCopyUrl({
      post: { id: 42 },
      origin: "https://memesee.world",
      targetSubPostId: "7",
    })).toBe("https://memesee.world/posts/42?subPost=7");
  });

  it("rejects malformed target ids or unusable main posts", () => {
    expect(buildSubPostLocationCopyUrl({
      post: { id: 42 },
      origin: "https://memesee.world",
      targetSubPostId: "bad-id",
    })).toBe("");

    expect(buildSubPostLocationCopyUrl({
      post: { id: "draft" },
      origin: "https://memesee.world",
      targetSubPostId: 7,
    })).toBe("");
  });
});

describe("shouldApplySubPostEngagementRequestResult", () => {
  it("applies only the latest response for the same sub-post action", () => {
    const latestRequestIds = new Map([
      ["like:42", 2],
      ["favorite:42", 1],
    ]);

    expect(shouldApplySubPostEngagementRequestResult({
      requestKey: "like:42",
      requestId: 2,
      latestRequestIds,
    })).toBe(true);

    expect(shouldApplySubPostEngagementRequestResult({
      requestKey: "like:42",
      requestId: 1,
      latestRequestIds,
    })).toBe(false);

    expect(shouldApplySubPostEngagementRequestResult({
      requestKey: "favorite:42",
      requestId: 1,
      latestRequestIds,
    })).toBe(true);
  });

  it("keeps requests independent across sub-posts and rejects incomplete requests", () => {
    expect(shouldApplySubPostEngagementRequestResult({
      requestKey: "like:42",
      requestId: 3,
      latestRequestIds: { "like:42": 3, "like:43": 1 },
    })).toBe(true);

    expect(shouldApplySubPostEngagementRequestResult({
      requestKey: "like:43",
      requestId: 3,
      latestRequestIds: { "like:42": 3, "like:43": 1 },
    })).toBe(false);

    expect(shouldApplySubPostEngagementRequestResult({
      requestKey: "",
      requestId: 3,
      latestRequestIds: { "like:42": 3 },
    })).toBe(false);

    expect(shouldApplySubPostEngagementRequestResult({
      requestKey: "like:42",
      requestId: 0,
      latestRequestIds: { "like:42": 3 },
    })).toBe(false);
  });
});

describe("notifySubPostAuthRequired", () => {
  it("keeps the auth-required toast and opens the login modal", () => {
    const setMessage = vi.fn();
    const onAuthRequired = vi.fn();

    notifySubPostAuthRequired({ setMessage, onAuthRequired });

    expect(setMessage).toHaveBeenCalledWith(UI_MESSAGES.authRequired);
    expect(onAuthRequired).toHaveBeenCalledWith("login");
  });

  it("does not fail when the login modal action is unavailable", () => {
    const setMessage = vi.fn();

    notifySubPostAuthRequired({ setMessage });

    expect(setMessage).toHaveBeenCalledWith(UI_MESSAGES.authRequired);
  });
});

describe("sub-post media draft helpers", () => {
  it("keeps only usable uploaded media asset ids for submit payloads", () => {
    expect(isSubPostComposerMediaAssetSubmitReady({ id: 7 })).toBe(true);
    expect(isSubPostComposerMediaAssetSubmitReady({ id: 0 })).toBe(false);

    expect(collectSubPostComposerMediaAssetIds([
      { id: 7 },
      { id: "8" },
      { id: 0 },
      null,
    ])).toEqual([7, 8]);
  });

  it("deduplicates and caps sub-post media draft assets", () => {
    const merged = mergeSubPostComposerMediaAssets([
      { id: 1 },
    ], [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
      { id: 6 },
      { id: 7 },
    ]);

    expect(merged.map((asset) => asset.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("removes sub-post media draft assets by index", () => {
    const assets = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(removeSubPostComposerMediaAt(assets, 1)).toEqual([{ id: 1 }, { id: 3 }]);
    expect(removeSubPostComposerMediaAt(assets, 9)).toBe(assets);
  });

  it("builds readable sub-post media upload statuses", () => {
    expect(buildSubPostMediaUploadStatus({ uploading: true })).toEqual({
      type: "uploading",
      message: "图片上传中...",
    });

    expect(buildSubPostMediaUploadStatus({
      imageCount: 1,
      skippedCount: 2,
      failedCount: 1,
    })).toEqual({
      type: "warning",
      message: "上传 1 张图片，跳过 2 个无效/超限，失败 1 张",
      canRetry: true,
    });

    expect(buildSubPostMediaUploadStatus({
      errorMessage: "附件上传失败。",
      retryableFailedCount: 1,
    })).toEqual({
      type: "error",
      message: "附件上传失败。 已上传的图片和子帖草稿仍保留。",
      canRetry: true,
    });
  });

  it("accepts media-only sub-post drafts but rejects fully empty drafts", () => {
    expect(hasSubPostComposerSubmitContent({
      content: "   ",
      mediaAssetIds: [99],
    })).toBe(true);

    expect(hasSubPostComposerSubmitContent({
      content: "补一张图",
      mediaAssetIds: [],
    })).toBe(true);

    expect(hasSubPostComposerSubmitContent({
      content: "   ",
      mediaAssetIds: [0, null],
    })).toBe(false);
  });
});

describe("sub-post main-post identity contract", () => {
  it("uses the normalized selected post id for create and count mutation paths", () => {
    expect(subPostThreadSource).toContain("const selectedPostId = resolveMainPostId(selectedPost);");
    expect(subPostThreadSource).toContain("mainPostId: selectedPostId");
    expect(subPostThreadSource).toContain("targetMainPostId: selectedPostId");
    expect(subPostThreadSource).not.toContain("mainPostId: selectedPost.id");
    expect(subPostThreadSource).not.toContain("targetMainPostId: selectedPost?.id");
  });

  it("passes uploaded sub-post media asset ids into create requests", () => {
    expect(subPostThreadSource).toContain("uploadMediaAsset as uploadContentMediaAsset");
    expect(subPostThreadSource).toContain("mediaAssetIds,");
    expect(subPostThreadSource).not.toContain("mediaAssetIds: [],");
  });
});

describe("sub-post interaction identity contract", () => {
  it("uses resolved sub-post ids for interaction context lookup", () => {
    expect(subPostThreadSource).toContain("resolveSubPostId(item) === targetId");
    expect(subPostThreadSource).not.toContain("Number(item?.id || 0) === Number(subPostId || 0)");
  });

  it("uses resolved sub-post ids for nested composer and delete paths", () => {
    expect(subPostThreadSource).toContain("const subPostId = resolveSubPostId(subPost);");
    expect(subPostThreadSource).toContain("id: subPostId");
    expect(subPostThreadSource).toContain("subPostId,");
    expect(subPostThreadSource).toContain("resolveSubPostId(item) !== subPostId");
    expect(subPostThreadSource).toContain("typeof onSubPostDeleted === \"function\"");
    expect(subPostThreadSource).toContain("onSubPostDeleted(subPostId)");
    expect(subPostThreadSource).not.toContain("id: subPost.id");
    expect(subPostThreadSource).not.toContain("subPostId: subPost.id");
    expect(subPostThreadSource).not.toContain("item.id != subPost.id");
    expect(subPostThreadSource).not.toContain("onSubPostDeleted?.(subPost.id)");
  });
});

describe("target sub-post deep-link contract", () => {
  it("opens located branch targets through the normalized branch anchor resolver", () => {
    const resolverCalls = subPostThreadSource.match(
      /resolveSubPostJumpBranchAnchorId\(\{/g,
    ) || [];

    expect(resolverCalls).toHaveLength(2);
    expect(subPostThreadSource).toContain(
      "branchAnchorId && branchAnchorId !== targetState.targetSubPostId",
    );
    expect(subPostThreadSource).not.toContain("[targetNode.parentId]: false");
  });

  it("can clear an unavailable target sub-post location back to the main post route", () => {
    expect(subPostThreadSource).toContain("function clearTargetSubPostLocation()");
    expect(subPostThreadSource).toContain("navigateToPost(mainPostId, setRoute, {");
    expect(subPostThreadSource).toContain("manageSource: routeManageSource");
    expect(subPostThreadSource).toContain("clearTargetSubPostLocation,");
  });
});

describe("sub-post share feedback contract", () => {
  it("uses contextual failure copy for sub-post share attempts", () => {
    expect(subPostThreadSource).toContain("failedMessage: UI_MESSAGES.subPostShareFailed");
  });

  it("deduplicates active sub-post share attempts by context key", () => {
    expect(subPostThreadSource).toContain("const subPostShareRequestKeysRef = useRef(new Set())");
    expect(subPostThreadSource).toContain("beginShareRequest(subPostShareRequestKeysRef.current, requestContextKey)");
    expect(subPostThreadSource).toContain("finalizeShareRequest(subPostShareRequestKeysRef.current, requestContextKey)");
  });

  it("copies target sub-post links with route-scoped stale feedback guards", () => {
    expect(subPostThreadSource).toContain("async function copyTargetSubPostLink(subPostId)");
    expect(subPostThreadSource).toContain("copyTextToClipboard(url)");
    expect(subPostThreadSource).toContain("UI_MESSAGES.subPostLocationLinkCopied");
    expect(subPostThreadSource).toContain("UI_MESSAGES.subPostLocationLinkCopyFailed");
    expect(subPostThreadSource).toContain("shouldApplySubPostMenuShareResult({");
  });
});
