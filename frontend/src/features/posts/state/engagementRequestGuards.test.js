import { describe, expect, it } from "vitest";
import {
  buildEngagementRequestKey,
  shouldApplyLatestEngagementRequestResult,
} from "./engagementRequestGuards";

describe("buildEngagementRequestKey", () => {
  it("normalizes target ids and actions into stable latest-request keys", () => {
    expect(buildEngagementRequestKey({
      targetId: "42",
      action: " Like ",
    })).toBe("like:42");
  });

  it("rejects missing target ids and actions", () => {
    expect(buildEngagementRequestKey({ targetId: 0, action: "like" })).toBe("");
    expect(buildEngagementRequestKey({ targetId: "bad-id", action: "like" })).toBe("");
    expect(buildEngagementRequestKey({ targetId: 42, action: "" })).toBe("");
  });
});

describe("shouldApplyLatestEngagementRequestResult", () => {
  it("accepts only the latest request id for a key", () => {
    const latestRequestIds = new Map([["like:42", 2]]);

    expect(shouldApplyLatestEngagementRequestResult({
      requestKey: "like:42",
      requestId: 2,
      latestRequestIds,
    })).toBe(true);

    expect(shouldApplyLatestEngagementRequestResult({
      requestKey: "like:42",
      requestId: 1,
      latestRequestIds,
    })).toBe(false);
  });

  it("supports plain object request tables and rejects incomplete requests", () => {
    expect(shouldApplyLatestEngagementRequestResult({
      requestKey: "favorite:42",
      requestId: 3,
      latestRequestIds: { "favorite:42": 3 },
    })).toBe(true);

    expect(shouldApplyLatestEngagementRequestResult({
      requestKey: "",
      requestId: 3,
      latestRequestIds: { "favorite:42": 3 },
    })).toBe(false);

    expect(shouldApplyLatestEngagementRequestResult({
      requestKey: "favorite:42",
      requestId: 0,
      latestRequestIds: { "favorite:42": 3 },
    })).toBe(false);
  });
});
