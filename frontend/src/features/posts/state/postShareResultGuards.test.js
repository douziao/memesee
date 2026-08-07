import { describe, expect, it } from "vitest";
import {
  beginShareRequest,
  buildMainPostShareContextKey,
  buildSubPostMenuShareContextKey,
  finalizeShareRequest,
  shouldApplyMainPostShareResult,
  shouldApplySubPostMenuShareResult,
} from "./postShareResultGuards";

describe("main post share result guards", () => {
  it("keeps share feedback scoped to the same post route and target", () => {
    const requestContextKey = buildMainPostShareContextKey({
      route: { type: "post", mainPostId: 42, targetSubPostId: 7 },
      post: { id: 42 },
    });

    expect(shouldApplyMainPostShareResult({
      requestContextKey,
      currentRoute: { type: "post", mainPostId: 42, targetSubPostId: 7 },
      post: { id: 42 },
    })).toBe(true);

    expect(shouldApplyMainPostShareResult({
      requestContextKey,
      currentRoute: { type: "post", mainPostId: 42, targetSubPostId: 8 },
      post: { id: 42 },
    })).toBe(false);
  });

  it("keeps share feedback when post payloads only expose public id aliases", () => {
    const requestContextKey = buildMainPostShareContextKey({
      route: { type: "post", mainPostId: 42 },
      post: { postId: 42 },
    });

    expect(requestContextKey).toBe("post:42:0");
    expect(shouldApplyMainPostShareResult({
      requestContextKey,
      currentRoute: { type: "post", mainPostId: 42 },
      post: { mainPostId: "42" },
    })).toBe(true);
  });

  it("suppresses stale main share feedback after leaving the shared post", () => {
    const requestContextKey = buildMainPostShareContextKey({
      route: { type: "post", mainPostId: 42 },
      post: { id: 42 },
    });

    expect(shouldApplyMainPostShareResult({
      requestContextKey,
      currentRoute: { type: "post", mainPostId: 43 },
      post: { id: 42 },
    })).toBe(false);

    expect(shouldApplyMainPostShareResult({
      requestContextKey,
      currentRoute: { type: "home" },
      post: { id: 42 },
    })).toBe(false);
  });
});

describe("sub-post menu share result guards", () => {
  it("keeps sub-post share feedback on the same main post", () => {
    const requestContextKey = buildSubPostMenuShareContextKey({
      routeType: "post",
      mainPostId: 42,
      subPostId: 7,
    });

    expect(shouldApplySubPostMenuShareResult({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 42,
      subPostId: 7,
    })).toBe(true);
  });

  it("suppresses stale sub-post share feedback after route changes", () => {
    const requestContextKey = buildSubPostMenuShareContextKey({
      routeType: "post",
      mainPostId: 42,
      subPostId: 7,
    });

    expect(shouldApplySubPostMenuShareResult({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 43,
      subPostId: 7,
    })).toBe(false);

    expect(shouldApplySubPostMenuShareResult({
      requestContextKey,
      currentRouteType: "home",
      currentMainPostId: 42,
      subPostId: 7,
    })).toBe(false);
  });
});

describe("share request lifecycle guards", () => {
  it("allows only one active share request for the same context key", () => {
    const activeRequestKeys = new Set();

    expect(beginShareRequest(activeRequestKeys, "post:42:0")).toBe(true);
    expect(beginShareRequest(activeRequestKeys, "post:42:0")).toBe(false);
    expect(beginShareRequest(activeRequestKeys, "post:43:0")).toBe(true);

    finalizeShareRequest(activeRequestKeys, "post:42:0");

    expect(beginShareRequest(activeRequestKeys, "post:42:0")).toBe(true);
  });

  it("rejects invalid share request stores and empty context keys", () => {
    expect(beginShareRequest(new Set(), "")).toBe(false);
    expect(beginShareRequest(null, "post:42:0")).toBe(false);
  });

  it("does not fail when finalizing an unavailable request store", () => {
    expect(() => finalizeShareRequest(null, "post:42:0")).not.toThrow();
  });
});
