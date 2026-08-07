import { describe, expect, it, vi } from "vitest";
import { restoreBlockedRouteHistory } from "./useAppChrome";

describe("restoreBlockedRouteHistory", () => {
  it("restores the current route through the browser navigation adapter", () => {
    const pushHistory = vi.fn(() => true);

    expect(restoreBlockedRouteHistory({
      type: "post",
      mainPostId: 42,
      targetSubPostId: 7,
      manageSource: "profile-published",
    }, pushHistory)).toBe(true);

    expect(pushHistory).toHaveBeenCalledWith("/posts/42?subPost=7&manage=published");
  });

  it("falls back to home for malformed blocked routes", () => {
    const pushHistory = vi.fn(() => true);

    expect(restoreBlockedRouteHistory({
      type: "post",
      mainPostId: "bad",
    }, pushHistory)).toBe(true);

    expect(pushHistory).toHaveBeenCalledWith("/");
  });

  it("reports false when the navigation adapter refuses a duplicate path", () => {
    expect(restoreBlockedRouteHistory({ type: "home" }, vi.fn(() => false))).toBe(false);
  });
});
