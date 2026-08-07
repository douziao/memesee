import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildMainPostEngagementRequestKey,
  resolveMainPostEngagementTargetAuthor,
  shouldApplyMainPostEngagementRequestResult,
} from "./useMainPostEngagement";

const mainPostEngagementSource = readFileSync(
  new URL("./useMainPostEngagement.js", import.meta.url),
  "utf8",
);

describe("buildMainPostEngagementRequestKey", () => {
  it("builds independent latest-request keys per main post and action", () => {
    expect(buildMainPostEngagementRequestKey({
      mainPostId: "42",
      action: "Like",
    })).toBe("like:42");

    expect(buildMainPostEngagementRequestKey({
      mainPostId: 42,
      action: "favorite",
    })).toBe("favorite:42");
  });

  it("rejects malformed engagement request keys", () => {
    expect(buildMainPostEngagementRequestKey({
      mainPostId: 0,
      action: "like",
    })).toBe("");
    expect(buildMainPostEngagementRequestKey({
      mainPostId: "bad-id",
      action: "like",
    })).toBe("");
    expect(buildMainPostEngagementRequestKey({
      mainPostId: 42,
      action: "",
    })).toBe("");
  });
});

describe("shouldApplyMainPostEngagementRequestResult", () => {
  it("applies only the latest response for the same main post action", () => {
    const latestRequestIds = new Map([
      ["like:42", 2],
      ["favorite:42", 1],
    ]);

    expect(shouldApplyMainPostEngagementRequestResult({
      requestKey: "like:42",
      requestId: 2,
      latestRequestIds,
    })).toBe(true);

    expect(shouldApplyMainPostEngagementRequestResult({
      requestKey: "like:42",
      requestId: 1,
      latestRequestIds,
    })).toBe(false);

    expect(shouldApplyMainPostEngagementRequestResult({
      requestKey: "favorite:42",
      requestId: 1,
      latestRequestIds,
    })).toBe(true);
  });

  it("supports plain object request tables and rejects incomplete requests", () => {
    expect(shouldApplyMainPostEngagementRequestResult({
      requestKey: "like:42",
      requestId: 3,
      latestRequestIds: { "like:42": 3 },
    })).toBe(true);

    expect(shouldApplyMainPostEngagementRequestResult({
      requestKey: "",
      requestId: 3,
      latestRequestIds: { "like:42": 3 },
    })).toBe(false);

    expect(shouldApplyMainPostEngagementRequestResult({
      requestKey: "like:42",
      requestId: 0,
      latestRequestIds: { "like:42": 3 },
    })).toBe(false);
  });
});

describe("main post LIKE_GIVEN target author contract", () => {
  it("resolves selected post authors across main-post id aliases", () => {
    expect(resolveMainPostEngagementTargetAuthor(
      42,
      {
        postId: "42",
        author: "selected-author",
      },
      [],
    )).toBe("selected-author");
  });

  it("resolves feed post authors across main-post id aliases", () => {
    expect(resolveMainPostEngagementTargetAuthor(
      42,
      {
        id: 7,
        author: "other-author",
      },
      [
        {
          id: "draft",
          mainPostId: "42",
          author: "feed-author",
        },
      ],
    )).toBe("feed-author");
  });

  it("returns an empty target author for malformed main-post ids", () => {
    expect(resolveMainPostEngagementTargetAuthor(
      "draft",
      {
        postId: "42",
        author: "selected-author",
      },
      [],
    )).toBe("");
  });

  it("matches selected and feed posts by numeric ids before reporting LIKE_GIVEN", () => {
    expect(mainPostEngagementSource).toContain("resolveMainPostEngagementTargetAuthor(");
    expect(mainPostEngagementSource).toContain("targetUsername: targetAuthor");
  });
});
