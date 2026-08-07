import { describe, expect, it } from "vitest";
import { POST_DETAIL_ERROR_TYPES } from "../../state/postDetailQueryRuntimeHelpers";
import {
  buildPostDetailRetryCopy,
  buildPostDetailRetryControlState,
  postDetailRetryActionClass,
} from "./PostDetailStates";

describe("buildPostDetailRetryCopy", () => {
  it("uses unavailable-content copy for missing or deleted posts", () => {
    expect(buildPostDetailRetryCopy(POST_DETAIL_ERROR_TYPES.notFound)).toEqual({
      title: "主帖已不可用",
      description: "这条内容可能已经被删除，或链接里的帖子编号不存在。",
      subtext: "建议返回首页继续浏览；如果刚刚恢复了网络，也可以再确认一次状态。",
      tone: "empty",
      primaryAction: "home",
    });
  });

  it("keeps transient failures distinct from unavailable posts", () => {
    expect(buildPostDetailRetryCopy(POST_DETAIL_ERROR_TYPES.loadFailed)).toEqual({
      title: "主帖暂时加载失败",
      description: "网络或服务刚才没有响应成功，内容不一定已经消失。",
      subtext: "可以稍后重试加载，或返回首页继续浏览其它内容。",
      tone: "default",
      primaryAction: "retry",
    });
  });

  it("promotes the right action for each retry state", () => {
    const unavailableCopy = buildPostDetailRetryCopy(POST_DETAIL_ERROR_TYPES.notFound);
    const transientCopy = buildPostDetailRetryCopy(POST_DETAIL_ERROR_TYPES.loadFailed);

    expect(postDetailRetryActionClass(unavailableCopy, "home")).toBe("neo-btn small");
    expect(postDetailRetryActionClass(unavailableCopy, "retry")).toBe("neo-btn small secondary");
    expect(postDetailRetryActionClass(transientCopy, "home")).toBe("neo-btn small secondary");
    expect(postDetailRetryActionClass(transientCopy, "retry")).toBe("neo-btn small");
  });

  it("keeps retry controls enabled with stable labels while idle", () => {
    expect(buildPostDetailRetryControlState({
      action: "home",
      refreshing: false,
    })).toEqual({
      disabled: false,
      label: "返回首页",
    });

    expect(buildPostDetailRetryControlState({
      action: "retry",
      refreshing: false,
    })).toEqual({
      disabled: false,
      label: "重试加载",
    });
  });

  it("disables both recovery actions while a post detail retry is in flight", () => {
    expect(buildPostDetailRetryControlState({
      action: "home",
      refreshing: true,
    })).toEqual({
      disabled: true,
      label: "返回首页",
    });

    expect(buildPostDetailRetryControlState({
      action: "retry",
      refreshing: true,
    })).toEqual({
      disabled: true,
      label: "正在重试...",
    });
  });
});
