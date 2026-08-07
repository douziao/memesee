import { describe, expect, it } from "vitest";
import {
  buildAccountEntryOpenOptions,
  shouldOpenNotificationsFromAccountEntry,
} from "./accountEntryHelpers";

describe("account entry notification routing", () => {
  it("opens notifications directly only for logged-in users with unread notifications", () => {
    expect(shouldOpenNotificationsFromAccountEntry({
      isLoggedIn: true,
      notificationUnreadCount: 3,
    })).toBe(true);

    expect(shouldOpenNotificationsFromAccountEntry({
      isLoggedIn: true,
      notificationUnreadCount: 0,
    })).toBe(false);

    expect(shouldOpenNotificationsFromAccountEntry({
      isLoggedIn: false,
      notificationUnreadCount: 3,
    })).toBe(false);
  });

  it("builds stable account entry options for the shell navigation action", () => {
    expect(buildAccountEntryOpenOptions({
      isLoggedIn: true,
      notificationUnreadCount: "2",
    })).toEqual({
      openNotifications: true,
    });

    expect(buildAccountEntryOpenOptions({
      isLoggedIn: true,
      notificationUnreadCount: "bad-count",
    })).toEqual({});
  });
});
