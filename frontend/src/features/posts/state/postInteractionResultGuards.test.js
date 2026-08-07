import { describe, expect, it } from "vitest";
import {
  buildPostRouteInteractionContextKey,
  shouldApplyMainPostDetailActionResult,
  shouldFinalizePostRouteInteractionRequest,
  shouldApplyPostRouteInteractionResult,
} from "./postInteractionResultGuards";

describe("post route interaction result guards", () => {
  it("allows interaction results to update the same main post detail", () => {
    const requestContextKey = buildPostRouteInteractionContextKey({
      routeType: "post",
      mainPostId: 42,
    });

    expect(shouldApplyPostRouteInteractionResult({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 42,
    })).toBe(true);
  });

  it("suppresses interaction results after the user leaves the originating post", () => {
    const requestContextKey = buildPostRouteInteractionContextKey({
      routeType: "post",
      mainPostId: 42,
    });

    expect(shouldApplyPostRouteInteractionResult({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 43,
    })).toBe(false);

    expect(shouldApplyPostRouteInteractionResult({
      requestContextKey,
      currentRouteType: "home",
      currentMainPostId: 42,
    })).toBe(false);
  });

  it("does not build a guard key for non-detail or invalid contexts", () => {
    expect(buildPostRouteInteractionContextKey({
      routeType: "home",
      mainPostId: 42,
    })).toBe("");
    expect(buildPostRouteInteractionContextKey({
      routeType: "post",
      mainPostId: "draft",
    })).toBe("");
  });

  it("finalizes only the latest request for the same post detail", () => {
    const requestContextKey = buildPostRouteInteractionContextKey({
      routeType: "post",
      mainPostId: 42,
    });

    expect(shouldFinalizePostRouteInteractionRequest({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 42,
      requestId: 2,
      currentRequestId: 2,
    })).toBe(true);

    expect(shouldFinalizePostRouteInteractionRequest({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 42,
      requestId: 1,
      currentRequestId: 2,
    })).toBe(false);

    expect(shouldFinalizePostRouteInteractionRequest({
      requestContextKey,
      currentRouteType: "post",
      currentMainPostId: 43,
      requestId: 2,
      currentRequestId: 2,
    })).toBe(false);
  });

  it("keeps destructive main-post actions scoped to the same detail route", () => {
    const requestContextKey = buildPostRouteInteractionContextKey({
      routeType: "post",
      mainPostId: 42,
    });

    expect(shouldApplyMainPostDetailActionResult({
      requestContextKey,
      currentRoute: { type: "post", mainPostId: 42 },
      post: { id: 42 },
    })).toBe(true);

    expect(shouldApplyMainPostDetailActionResult({
      requestContextKey,
      currentRoute: { type: "post", mainPostId: 42 },
      post: { postId: "42" },
    })).toBe(true);

    expect(shouldApplyMainPostDetailActionResult({
      requestContextKey,
      currentRoute: { type: "post", mainPostId: 42 },
      post: { id: "draft", mainPostId: "42" },
    })).toBe(true);

    expect(shouldApplyMainPostDetailActionResult({
      requestContextKey,
      currentRoute: { type: "post", mainPostId: 43 },
      post: { id: 42 },
    })).toBe(false);

    expect(shouldApplyMainPostDetailActionResult({
      requestContextKey,
      currentRoute: { type: "home" },
      post: { id: 42 },
    })).toBe(false);
  });
});
