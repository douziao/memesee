import { describe, expect, it } from "vitest";
import {
  markNotificationItemReadById,
  markNotificationItemsPostUnavailable,
  markNotificationItemsRead,
  markNotificationItemsSubPostUnavailable,
  normalizeNotificationUnreadCount,
  syncNotificationItemsForPostSnapshot,
} from "./useNotifications";

describe("normalizeNotificationUnreadCount", () => {
  it("keeps unread counts finite and non-negative", () => {
    expect(normalizeNotificationUnreadCount(3)).toBe(3);
    expect(normalizeNotificationUnreadCount("4")).toBe(4);
    expect(normalizeNotificationUnreadCount(-1)).toBe(0);
    expect(normalizeNotificationUnreadCount(Number.NaN)).toBe(0);
    expect(normalizeNotificationUnreadCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeNotificationUnreadCount("bad-count")).toBe(0);
  });
});

describe("markNotificationItemsRead", () => {
  it("marks every notification item read without mutating the previous list", () => {
    const previous = [
      { id: 1, read: false, title: "新通知" },
      { id: 2, read: true, title: "旧通知" },
    ];

    const next = markNotificationItemsRead(previous);

    expect(next).toEqual([
      { id: 1, read: true, title: "新通知" },
      { id: 2, read: true, title: "旧通知" },
    ]);
    expect(previous[0].read).toBe(false);
    expect(next[0]).not.toBe(previous[0]);
  });

  it("treats malformed notification lists as empty", () => {
    expect(markNotificationItemsRead(null)).toEqual([]);
  });
});

describe("markNotificationItemReadById", () => {
  it("marks one unread notification read and reports the unread delta", () => {
    const previous = [
      { id: 1, read: false, title: "新通知" },
      { id: 2, read: false, title: "其他通知" },
    ];

    const result = markNotificationItemReadById(previous, "1");

    expect(result).toEqual({
      items: [
        { id: 1, read: true, title: "新通知" },
        previous[1],
      ],
      readDelta: 1,
    });
    expect(previous[0].read).toBe(false);
    expect(result.items[0]).not.toBe(previous[0]);
    expect(result.items[1]).toBe(previous[1]);
  });

  it("keeps already-read, missing, and malformed notification ids stable", () => {
    const previous = [
      { id: 1, read: true, title: "已读通知" },
      { id: 2, read: false, title: "未读通知" },
    ];

    expect(markNotificationItemReadById(previous, 1)).toEqual({
      items: previous,
      readDelta: 0,
    });
    expect(markNotificationItemReadById(previous, 99)).toEqual({
      items: previous,
      readDelta: 0,
    });
    expect(markNotificationItemReadById(previous, "bad-id")).toEqual({
      items: previous,
      readDelta: 0,
    });
    expect(markNotificationItemReadById(null, 1)).toEqual({
      items: [],
      readDelta: 0,
    });
  });
});

describe("syncNotificationItemsForPostSnapshot", () => {
  it("updates matching notification titles and quoted body titles without mutating previous items", () => {
    const previous = [
      {
        id: 1,
        postId: "42",
        postTitle: "旧标题",
        body: "alice 回复了《旧标题》：新的子帖内容",
      },
      {
        id: 2,
        postId: "7",
        postTitle: "其他标题",
        body: "bob 点赞了《其他标题》",
      },
    ];

    const next = syncNotificationItemsForPostSnapshot(previous, {
      id: 42,
      title: "新标题",
    });

    expect(next).toEqual([
      {
        id: 1,
        postId: "42",
        postTitle: "新标题",
        body: "alice 回复了《新标题》：新的子帖内容",
      },
      previous[1],
    ]);
    expect(previous[0].postTitle).toBe("旧标题");
    expect(next[0]).not.toBe(previous[0]);
    expect(next[1]).toBe(previous[1]);
  });

  it("keeps malformed inputs stable when no usable post snapshot is available", () => {
    const previous = [{ id: 1, postId: "42", postTitle: "旧标题" }];

    expect(syncNotificationItemsForPostSnapshot(previous, { id: 42, title: "" })).toBe(previous);
    expect(syncNotificationItemsForPostSnapshot(null, { id: 42, title: "新标题" })).toEqual([]);
  });

  it("accepts postTitle snapshots from saved-post sync payloads", () => {
    expect(syncNotificationItemsForPostSnapshot([{
      id: 1,
      postId: 42,
      postTitle: "旧标题",
      body: "bob 收藏了《旧标题》",
    }], {
      id: 42,
      postTitle: "保存后的标题",
    })).toEqual([{
      id: 1,
      postId: 42,
      postTitle: "保存后的标题",
      body: "bob 收藏了《保存后的标题》",
    }]);
  });

  it("accepts postId snapshots from saved-post sync payloads", () => {
    expect(syncNotificationItemsForPostSnapshot([{
      id: 1,
      postId: 42,
      postTitle: "旧标题",
      body: "bob 点赞了《旧标题》",
    }], {
      postId: 42,
      postTitle: "详情页标题",
    })).toEqual([{
      id: 1,
      postId: 42,
      postTitle: "详情页标题",
      body: "bob 点赞了《详情页标题》",
    }]);
  });

  it("falls back to usable mainPostId aliases when syncing notification titles", () => {
    expect(syncNotificationItemsForPostSnapshot([{
      id: 1,
      postId: "draft",
      mainPostId: "42",
      postTitle: "旧标题",
      body: "alice 回复了《旧标题》：新的子帖内容",
    }], {
      mainPostId: 42,
      postTitle: "别名标题",
    })).toEqual([{
      id: 1,
      postId: "draft",
      mainPostId: "42",
      postTitle: "别名标题",
      body: "alice 回复了《别名标题》：新的子帖内容",
    }]);
  });
});

describe("markNotificationItemsPostUnavailable", () => {
  it("clears matching main and sub-post targets so deleted-post notifications become disabled", () => {
    const previous = [
      { id: 1, postId: "42", subPostId: "9", title: "回复" },
      { id: 2, postId: 7, subPostId: "3", title: "其他" },
    ];

    const next = markNotificationItemsPostUnavailable(previous, 42);

    expect(next).toEqual([
      {
        id: 1,
        postId: null,
        mainPostId: null,
        subPostId: null,
        targetSubPostId: null,
        title: "回复",
        unavailableReason: "post-deleted",
      },
      previous[1],
    ]);
    expect(previous[0].postId).toBe("42");
    expect(next[0]).not.toBe(previous[0]);
    expect(next[1]).toBe(previous[1]);
  });

  it("keeps malformed deletion ids from changing the current notification list", () => {
    const previous = [{ id: 1, postId: "42" }];

    expect(markNotificationItemsPostUnavailable(previous, "bad-id")).toBe(previous);
    expect(markNotificationItemsPostUnavailable(null, 42)).toEqual([]);
  });

  it("marks notifications that only expose mainPostId aliases unavailable", () => {
    const previous = [{
      id: 1,
      mainPostId: "42",
      targetSubPostId: "9",
      title: "别名通知",
    }];

    expect(markNotificationItemsPostUnavailable(previous, 42)).toEqual([{
      id: 1,
      mainPostId: null,
      postId: null,
      targetSubPostId: null,
      subPostId: null,
      title: "别名通知",
      unavailableReason: "post-deleted",
    }]);
  });

  it("falls back to usable mainPostId aliases when the preferred post id is malformed", () => {
    const previous = [{
      id: 1,
      postId: "draft",
      mainPostId: "42",
      targetSubPostId: "9",
      title: "别名通知",
    }];

    expect(markNotificationItemsPostUnavailable(previous, 42)).toEqual([{
      id: 1,
      postId: null,
      mainPostId: null,
      targetSubPostId: null,
      subPostId: null,
      title: "别名通知",
      unavailableReason: "post-deleted",
    }]);
  });
});

describe("markNotificationItemsSubPostUnavailable", () => {
  it("clears only matching sub-post targets while keeping the parent post openable", () => {
    const previous = [
      { id: 1, postId: "42", subPostId: "9", title: "回复" },
      { id: 2, postId: "42", subPostId: "10", title: "其他回复" },
      { id: 3, postId: "7", subPostId: null, title: "主帖通知" },
    ];

    const next = markNotificationItemsSubPostUnavailable(previous, 9);

    expect(next).toEqual([
      {
        id: 1,
        postId: "42",
        subPostId: null,
        targetSubPostId: null,
        title: "回复",
        unavailableReason: "sub-post-deleted",
      },
      previous[1],
      previous[2],
    ]);
    expect(previous[0].subPostId).toBe("9");
    expect(next[0]).not.toBe(previous[0]);
    expect(next[1]).toBe(previous[1]);
    expect(next[2]).toBe(previous[2]);
  });

  it("keeps malformed sub-post deletion ids from changing the notification list", () => {
    const previous = [{ id: 1, postId: "42", subPostId: "9" }];

    expect(markNotificationItemsSubPostUnavailable(previous, "bad-id")).toBe(previous);
    expect(markNotificationItemsSubPostUnavailable(null, 9)).toEqual([]);
  });

  it("marks notifications that only expose targetSubPostId aliases as falling back to the main post", () => {
    const previous = [{
      id: 1,
      postId: "42",
      targetSubPostId: "9",
      title: "别名子帖",
    }];

    expect(markNotificationItemsSubPostUnavailable(previous, 9)).toEqual([{
      id: 1,
      postId: "42",
      targetSubPostId: null,
      subPostId: null,
      title: "别名子帖",
      unavailableReason: "sub-post-deleted",
    }]);
  });

  it("falls back to usable targetSubPostId aliases when the preferred sub-post id is malformed", () => {
    const previous = [{
      id: 1,
      postId: "42",
      subPostId: "draft",
      targetSubPostId: "9",
      title: "别名子帖",
    }];

    expect(markNotificationItemsSubPostUnavailable(previous, 9)).toEqual([{
      id: 1,
      postId: "42",
      subPostId: null,
      targetSubPostId: null,
      title: "别名子帖",
      unavailableReason: "sub-post-deleted",
    }]);
  });
});
