import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProfileNotificationPage, {
  notificationTabLabel,
  resolveNotificationTabKeyAction,
} from "./ProfileNotificationPage";
import {
  buildNotificationAccessSummary,
  buildNotificationPageSyncStatus,
  notificationDetail,
  normalizeNotificationPostId,
  resolveNotificationPostAccess,
  shouldShowNotificationGroups,
} from "./ProfileNotificationPage";

function renderNotificationPage(props = {}) {
  return renderToStaticMarkup(
    createElement(ProfileNotificationPage, {
      activeProfileNotificationPage: true,
      notifications: [],
      notificationUnreadCount: 0,
      loadNotifications: async () => ({ notifications: [], unreadCount: 0 }),
      markNotificationsRead: async () => ({ unreadCount: 0 }),
      markNotificationReadLocally: () => {},
      navigateToPost: () => {},
      formatTime: (_createdAt, createdAtText) => createdAtText || "刚刚",
      ...props,
    }),
  );
}

describe("normalizeNotificationPostId", () => {
  it("accepts positive integer post ids from notification payloads", () => {
    expect(normalizeNotificationPostId(42)).toBe(42);
    expect(normalizeNotificationPostId("42")).toBe(42);
  });

  it("rejects malformed post ids so rows can be disabled instead of silently no-oping", () => {
    expect(normalizeNotificationPostId("")).toBe(0);
    expect(normalizeNotificationPostId(0)).toBe(0);
    expect(normalizeNotificationPostId(-1)).toBe(0);
    expect(normalizeNotificationPostId(1.5)).toBe(0);
    expect(normalizeNotificationPostId("abc")).toBe(0);
  });

  it("describes unavailable notification targets with a user-visible reason", () => {
    expect(resolveNotificationPostAccess({ postId: "42" })).toEqual({
      postId: 42,
      targetLabel: "",
      openOptions: {},
      canOpenPost: true,
      unavailableText: "",
    });
    expect(resolveNotificationPostAccess({ postId: "" })).toEqual({
      postId: 0,
      targetLabel: "",
      openOptions: {},
      canOpenPost: false,
      unavailableText: "缺少可打开的主帖信息",
    });
    expect(resolveNotificationPostAccess({
      postId: null,
      unavailableReason: "post-deleted",
    })).toEqual({
      postId: 0,
      targetLabel: "",
      openOptions: {},
      canOpenPost: false,
      unavailableText: "关联主帖已删除",
    });

    expect(resolveNotificationPostAccess({
      postId: "42",
      unavailableReason: "post-deleted",
    })).toEqual({
      postId: 42,
      targetLabel: "",
      openOptions: {},
      canOpenPost: false,
      unavailableText: "关联主帖已删除",
    });
  });

  it("accepts mainPostId aliases for notification post targets", () => {
    expect(resolveNotificationPostAccess({
      mainPostId: "42",
      subPostId: "7",
    })).toEqual({
      postId: 42,
      targetLabel: "定位子帖",
      openOptions: {
        targetSubPostId: 7,
      },
      canOpenPost: true,
      unavailableText: "",
    });
  });

  it("falls back to usable post aliases when preferred notification ids are malformed", () => {
    expect(resolveNotificationPostAccess({
      postId: "draft",
      mainPostId: "42",
    })).toEqual({
      postId: 42,
      targetLabel: "",
      openOptions: {},
      canOpenPost: true,
      unavailableText: "",
    });
  });

  it("opens sub-post notifications with a target sub-post deep-link option", () => {
    expect(resolveNotificationPostAccess({
      postId: "42",
      subPostId: "7",
    })).toEqual({
      postId: 42,
      targetLabel: "定位子帖",
      openOptions: {
        targetSubPostId: 7,
      },
      canOpenPost: true,
      unavailableText: "",
    });

    expect(resolveNotificationPostAccess({
      postId: "42",
      subPostId: "bad-id",
    })).toEqual({
      postId: 42,
      targetLabel: "",
      openOptions: {},
      canOpenPost: true,
      unavailableText: "",
    });
  });

  it("falls back to usable sub-post aliases when preferred target ids are malformed", () => {
    expect(resolveNotificationPostAccess({
      postId: "42",
      subPostId: "draft",
      targetSubPostId: "7",
    })).toEqual({
      postId: 42,
      targetLabel: "定位子帖",
      openOptions: {
        targetSubPostId: 7,
      },
      canOpenPost: true,
      unavailableText: "",
    });
  });

  it("accepts targetSubPostId aliases for sub-post notification deep links", () => {
    expect(resolveNotificationPostAccess({
      postId: "42",
      targetSubPostId: "7",
    })).toEqual({
      postId: 42,
      targetLabel: "定位子帖",
      openOptions: {
        targetSubPostId: 7,
      },
      canOpenPost: true,
      unavailableText: "",
    });
  });

  it("keeps notifications openable at the parent post after a sub-post target is cleared", () => {
    expect(resolveNotificationPostAccess({
      postId: "42",
      subPostId: null,
    })).toEqual({
      postId: 42,
      targetLabel: "",
      openOptions: {},
      canOpenPost: true,
      unavailableText: "",
    });

    expect(resolveNotificationPostAccess({
      postId: "42",
      targetSubPostId: "7",
      unavailableReason: "sub-post-deleted",
    })).toEqual({
      postId: 42,
      targetLabel: "",
      openOptions: {},
      canOpenPost: true,
      unavailableText: "关联子帖已删除，将打开主帖",
    });

    expect(resolveNotificationPostAccess({
      postId: "42",
      targetSubPostId: "7",
      unavailableReason: "sub-post-deleted",
    })).toEqual({
      postId: 42,
      targetLabel: "",
      openOptions: {},
      canOpenPost: true,
      unavailableText: "关联子帖已删除，将打开主帖",
    });
  });
});

describe("buildNotificationPageSyncStatus", () => {
  it("keeps notification syncing, empty-error, stale-error, and idle states distinct", () => {
    expect(buildNotificationPageSyncStatus({
      syncing: true,
      error: "通知加载失败，请稍后重试。",
      hasNotifications: true,
    })).toEqual({
      type: "syncing",
      message: "正在同步最新通知...",
    });

    expect(buildNotificationPageSyncStatus({
      syncing: false,
      error: "通知加载失败，请稍后重试。",
      hasNotifications: false,
    })).toEqual({
      type: "error",
      message: "通知加载失败，请稍后重试。",
      actionLabel: "重新同步",
    });

    expect(buildNotificationPageSyncStatus({
      syncing: false,
      error: "通知标记已读失败，请稍后重试。",
      hasNotifications: true,
    })).toEqual({
      type: "stale-error",
      message: "通知标记已读失败，请稍后重试。",
      actionLabel: "重新同步",
    });

    expect(buildNotificationPageSyncStatus({
      syncing: false,
      error: "",
      hasNotifications: false,
    })).toEqual({ type: "" });
  });
});

describe("buildNotificationAccessSummary", () => {
  it("keeps the summary empty when every notification target is directly openable", () => {
    expect(buildNotificationAccessSummary([
      { postId: "42" },
      { postId: "43", subPostId: "7" },
    ])).toEqual({
      unavailableCount: 0,
      fallbackToMainPostCount: 0,
      message: "",
    });
  });

  it("summarizes disabled and parent-fallback notification targets", () => {
    expect(buildNotificationAccessSummary([
      {
        postId: 41,
        unavailableReason: "post-deleted",
      },
      {
        postId: "42",
        subPostId: null,
        unavailableReason: "sub-post-deleted",
      },
      {
        postId: "",
      },
    ])).toEqual({
      unavailableCount: 2,
      fallbackToMainPostCount: 1,
      message: "2 条通知关联内容不可用，已禁用打开入口；1 条子帖通知将打开主帖。",
    });
  });

  it("treats malformed notification lists as empty", () => {
    expect(buildNotificationAccessSummary(null)).toEqual({
      unavailableCount: 0,
      fallbackToMainPostCount: 0,
      message: "",
    });
  });
});

describe("shouldShowNotificationGroups", () => {
  it("shows category tabs only when the page has notifications to group", () => {
    expect(shouldShowNotificationGroups([])).toBe(false);
    expect(shouldShowNotificationGroups(null)).toBe(false);
    expect(shouldShowNotificationGroups([{ id: 1, type: "POST_LIKE" }])).toBe(true);
  });
});

describe("notification tab accessibility", () => {
  const groups = [
    { key: "all", title: "全部", items: [{ id: 1 }] },
    { key: "liked", title: "点赞", items: [] },
    { key: "favorite", title: "收藏", items: [{ id: 2 }, { id: 3 }] },
  ];

  it("builds readable labels with category counts", () => {
    expect(notificationTabLabel(groups[2])).toBe("收藏通知，2 条");
  });

  it("maps arrow, home, and end keys to stable notification categories", () => {
    expect(resolveNotificationTabKeyAction({
      key: "ArrowRight",
      currentKey: "all",
      groups,
    })).toBe("liked");
    expect(resolveNotificationTabKeyAction({
      key: "ArrowLeft",
      currentKey: "all",
      groups,
    })).toBe("favorite");
    expect(resolveNotificationTabKeyAction({
      key: "Home",
      currentKey: "favorite",
      groups,
    })).toBe("all");
    expect(resolveNotificationTabKeyAction({
      key: "End",
      currentKey: "all",
      groups,
    })).toBe("favorite");
    expect(resolveNotificationTabKeyAction({
      key: "Enter",
      currentKey: "all",
      groups,
    })).toBe("");
  });

  it("renders notification groups as labeled tabs linked to a tabpanel", () => {
    const markup = renderNotificationPage({
      notifications: [
        {
          id: 1,
          type: "POST_LIKE",
          actorUsername: "alice",
          postId: 42,
          postTitle: "标题",
          createdAtText: "刚刚",
          read: false,
        },
      ],
    });

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('id="profile-notification-tab-all"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-controls="profile-notification-panel-all"');
    expect(markup).toContain('aria-label="全部通知，1 条"');
    expect(markup).toContain('id="profile-notification-panel-all"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain('aria-labelledby="profile-notification-tab-all"');
  });

  it("renders locally-read notifications without the unread row state", () => {
    const markup = renderNotificationPage({
      notifications: [
        {
          id: 1,
          type: "POST_LIKE",
          actorUsername: "alice",
          postId: 42,
          postTitle: "已处理通知",
          createdAtText: "刚刚",
          read: true,
        },
      ],
    });

    expect(markup).toContain("已处理通知");
    expect(markup).toContain("profile-notification-entry-liked");
    expect(markup).not.toContain("profile-notification-entry-liked unread");
  });
});

describe("notificationDetail", () => {
  it("cleans markdown artifacts from reply notification bodies", () => {
    expect(notificationDetail({
      type: "SUB_POST_CREATED",
      actorUsername: "alice",
      body: "alice 回复了《主帖标题》：正文包含 **Markdown** 和 ![图片](media:1)。",
      postTitle: "主帖标题",
    })).toBe("回复了《主帖标题》：正文包含 Markdown。");
  });

  it("cleans quoted sub-post previews before combining them with the post title", () => {
    expect(notificationDetail({
      type: "SUB_POST_LIKED",
      actorUsername: "bob",
      body: "bob 点赞了你的子帖《主帖标题》：子帖包含 **Markdown** and ![image](media:2).",
      postTitle: "主帖标题",
    })).toBe("子帖包含 Markdown. · 《主帖标题》");
  });

  it("keeps media-only sub-post notification previews visible", () => {
    expect(notificationDetail({
      type: "SUB_POST_LIKED",
      actorUsername: "bob",
      body: "bob 点赞了《主帖标题》下的子帖：图片子帖",
      postTitle: "主帖标题",
    })).toBe("图片子帖 · 《主帖标题》");
  });

  it("upgrades legacy no-content sub-post notifications to a media-only summary", () => {
    expect(notificationDetail({
      type: "SUB_POST_CREATED",
      actorUsername: "alice",
      body: "alice 在《主帖标题》下发布：无内容",
      postTitle: "主帖标题",
    })).toBe("在《主帖标题》下发布：图片子帖");

    expect(notificationDetail({
      type: "SUB_POST_FAVORITED",
      actorUsername: "bob",
      body: "bob 收藏了《主帖标题》下的子帖：无内容",
      postTitle: "主帖标题",
    })).toBe("图片子帖 · 《主帖标题》");
  });

  it("redacts historical title and body details for deleted notification targets", () => {
    expect(notificationDetail({
      type: "POST_LIKE",
      actorUsername: "alice",
      body: "alice 点赞了《已删除主帖标题》",
      postTitle: "已删除主帖标题",
      unavailableReason: "post-deleted",
    })).toBe("这条通知关联的主帖已删除。");

    expect(notificationDetail({
      type: "SUB_POST_REPLIED",
      actorUsername: "bob",
      body: "bob 回复了《主帖标题》下的子帖：已删除子帖正文",
      postTitle: "主帖标题",
      unavailableReason: "sub-post-deleted",
    })).toBe("这条通知关联的子帖已删除。");
  });
});
