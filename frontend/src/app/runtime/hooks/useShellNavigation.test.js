import { describe, expect, it } from "vitest";
import { shouldOpenProfileNotificationsOnMineOpen } from "./useShellNavigation";

describe("shouldOpenProfileNotificationsOnMineOpen", () => {
  it("uses the explicit account-entry option to open the notification page", () => {
    expect(shouldOpenProfileNotificationsOnMineOpen({
      openNotifications: true,
    })).toBe(true);

    expect(shouldOpenProfileNotificationsOnMineOpen({})).toBe(false);
    expect(shouldOpenProfileNotificationsOnMineOpen()).toBe(false);
  });
});
