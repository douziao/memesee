import { describe, expect, it } from "vitest";
import {
  buildRecoveryActionClass,
  buildRecoveryControlState,
} from "./recoveryControl";

describe("buildRecoveryControlState", () => {
  it("keeps recovery actions enabled with their idle label", () => {
    expect(buildRecoveryControlState({
      isBusy: false,
      idleLabel: "重试读取子帖",
    })).toEqual({
      disabled: false,
      label: "重试读取子帖",
    });
  });

  it("disables busy recovery actions with the shared retrying copy", () => {
    expect(buildRecoveryControlState({
      isBusy: true,
      idleLabel: "重试加载",
    })).toEqual({
      disabled: true,
      label: "正在重试...",
    });
  });

  it("can keep a non-retry idle label while the recovery group is busy", () => {
    expect(buildRecoveryControlState({
      isBusy: true,
      idleLabel: "返回首页",
      keepIdleLabelWhenBusy: true,
    })).toEqual({
      disabled: true,
      label: "返回首页",
    });
  });
});

describe("buildRecoveryActionClass", () => {
  it("marks the selected recovery action as primary", () => {
    expect(buildRecoveryActionClass({
      action: "retry",
      primaryAction: "retry",
      baseClassName: "neo-btn small",
    })).toBe("neo-btn small");
  });

  it("marks non-primary recovery actions as secondary", () => {
    expect(buildRecoveryActionClass({
      action: "home",
      primaryAction: "retry",
      baseClassName: "neo-btn small",
    })).toBe("neo-btn small secondary");
  });
});
