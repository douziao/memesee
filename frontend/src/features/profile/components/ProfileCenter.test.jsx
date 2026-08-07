import { describe, expect, it } from "vitest";
import { buildProfileCenterStatus } from "./ProfileCenter";

describe("buildProfileCenterStatus", () => {
  it("keeps profile loading, logged-out, ready, error, and empty states distinct", () => {
    expect(buildProfileCenterStatus({
      loadingProfile: true,
      isLoggedIn: true,
      profile: null,
      profileError: "",
    })).toEqual({
      type: "loading",
      kicker: "个人中心",
      title: "正在打开个人中心",
      description: "你的主页、通知和收藏马上就好。",
    });

    expect(buildProfileCenterStatus({
      loadingProfile: false,
      isLoggedIn: false,
      profile: null,
      profileError: "",
    })).toEqual({
      type: "logged-out",
      title: "请先登录后查看个人中心",
      description: "登录后可以查看通知、收藏、点赞和发布记录。",
    });

    expect(buildProfileCenterStatus({
      loadingProfile: false,
      isLoggedIn: true,
      profile: { username: "nya" },
      profileError: "个人主页加载失败，请稍后重试。",
    })).toEqual({ type: "ready" });

    expect(buildProfileCenterStatus({
      loadingProfile: false,
      isLoggedIn: true,
      profile: null,
      profileError: "个人主页加载失败，请稍后重试。",
    })).toEqual({
      type: "error",
      title: "个人中心加载失败",
      description: "个人主页加载失败，请稍后重试。",
      actionLabel: "重试打开个人中心",
    });

    expect(buildProfileCenterStatus({
      loadingProfile: false,
      isLoggedIn: true,
      profile: null,
      profileError: "",
    })).toEqual({
      type: "empty",
      title: "个人资料暂时不可用",
      description: "可以稍后再试一次。",
    });
  });
});
