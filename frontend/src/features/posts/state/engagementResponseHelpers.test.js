import { describe, expect, it } from "vitest";
import {
  resolveNextEngagementActive,
  resolveNextEngagementCount,
  resolveNextEngagementScore,
} from "./engagementResponseHelpers";

describe("engagement response helpers", () => {
  it("uses explicit active state from the response when available", () => {
    expect(resolveNextEngagementActive({
      response: { likedByMe: false },
      activeKey: "likedByMe",
      wasActive: false,
    })).toBe(false);
  });

  it("falls back to the toggled active state when the response omits it", () => {
    expect(resolveNextEngagementActive({
      response: {},
      activeKey: "likedByMe",
      wasActive: false,
    })).toBe(true);
    expect(resolveNextEngagementActive({
      response: {},
      activeKey: "likedByMe",
      wasActive: true,
    })).toBe(false);
  });

  it("preserves a local count transition when the response omits or echoes a stale count", () => {
    expect(resolveNextEngagementCount({
      response: {},
      countKey: "likeCount",
      currentCount: 4,
      wasActive: false,
      nextActive: true,
    })).toBe(5);

    expect(resolveNextEngagementCount({
      response: { likeCount: 4 },
      countKey: "likeCount",
      currentCount: 4,
      wasActive: false,
      nextActive: true,
    })).toBe(5);
  });

  it("accepts valid response counts and keeps invalid counts non-negative", () => {
    expect(resolveNextEngagementCount({
      response: { likeCount: 8 },
      countKey: "likeCount",
      currentCount: 4,
      wasActive: false,
      nextActive: true,
    })).toBe(8);

    expect(resolveNextEngagementCount({
      response: { likeCount: -2 },
      countKey: "likeCount",
      currentCount: 0,
      wasActive: true,
      nextActive: false,
    })).toBe(0);
  });

  it("only uses finite hot score values from responses", () => {
    expect(resolveNextEngagementScore({
      response: { hotScore: 12.5 },
    })).toBe(12.5);
    expect(resolveNextEngagementScore({
      response: { hotScore: "bad" },
    })).toBeUndefined();
    expect(resolveNextEngagementScore({
      response: {},
    })).toBeUndefined();
  });
});
