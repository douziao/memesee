import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProfileLibraryPage, {
  buildLibraryPageSummary,
  buildLibraryUnavailableMessage,
  groupEntriesByMainPost,
  normalizeLibraryPostId,
  resolveLibraryEntryGroups,
  resolveLibraryOpenOptions,
  resolveLibrarySubEntryOpenOptions,
  resolveSubPostContent,
  resolveSubPostMainPost,
} from "./ProfileLibraryPage";

const profileLibraryPageSource = readFileSync(
  new URL("./ProfileLibraryPage.jsx", import.meta.url),
  "utf8",
);

function renderLibraryPage(props = {}) {
  return renderToStaticMarkup(
    createElement(ProfileLibraryPage, {
      activeProfileLibraryPage: "liked",
      profilePosts: [],
      profileSubPosts: [],
      postInteractions: [],
      subPostInteractions: [],
      openPostDetail: () => {},
      sharePost: () => {},
      isSharingPost: () => false,
      formatTime: (_value, text) => text || "刚刚",
      clampText: (value) => String(value || ""),
      formatHeatScore: (value) => String(value || 0),
      ...props,
    }),
  );
}

describe("profile library post id normalization", () => {
  it("describes hidden records as missing openable main-post information", () => {
    expect(buildLibraryUnavailableMessage(2)).toBe(
      "2 条记录缺少可打开的主帖信息，已从列表中隐藏。",
    );
    expect(buildLibraryUnavailableMessage(0)).toBe("");
    expect(buildLibraryUnavailableMessage("bad-count")).toBe("");
  });

  it("builds a stable page summary for visible library records", () => {
    expect(buildLibraryPageSummary({
      pageTitle: "收藏",
      defaultEmptyText: "暂无收藏。",
      entries: [{ type: "main" }, { type: "sub" }],
      groups: [{ key: "42" }],
      visibleEntryCount: 2,
      unavailableEntryCount: 0,
    })).toEqual({
      totalEntryCount: 2,
      groupCount: 1,
      visibleEntryCount: 2,
      unavailableEntryCount: 0,
      showGroups: true,
      showEmpty: false,
      showUnavailable: false,
      emptyText: "暂无收藏。",
      unavailableMessage: "",
    });
  });

  it("explains when library records exist but none can be opened", () => {
    expect(buildLibraryPageSummary({
      pageTitle: "点赞",
      defaultEmptyText: "暂无点赞。",
      entries: [{ type: "sub" }, { type: "sub" }],
      groups: [],
      visibleEntryCount: 0,
      unavailableEntryCount: 2,
    })).toEqual({
      totalEntryCount: 2,
      groupCount: 0,
      visibleEntryCount: 0,
      unavailableEntryCount: 2,
      showGroups: false,
      showEmpty: true,
      showUnavailable: true,
      emptyText: "暂无可打开的点赞记录。",
      unavailableMessage: "2 条记录缺少可打开的主帖信息，已从列表中隐藏。",
    });
  });

  it("keeps mixed visible and hidden library records countable from one summary", () => {
    expect(buildLibraryPageSummary({
      pageTitle: "发布",
      defaultEmptyText: "暂无发布。",
      entries: [{ type: "main" }, { type: "sub" }, { type: "sub" }],
      groups: [{ key: "42" }],
      visibleEntryCount: 2,
      unavailableEntryCount: 1,
    })).toMatchObject({
      totalEntryCount: 3,
      groupCount: 1,
      visibleEntryCount: 2,
      unavailableEntryCount: 1,
      showGroups: true,
      showEmpty: false,
      showUnavailable: true,
      unavailableMessage: "1 条记录缺少可打开的主帖信息，已从列表中隐藏。",
    });
  });

  it("hides unavailable library records without rendering stale content or share targets", () => {
    const markup = renderLibraryPage({
      activeProfileLibraryPage: "liked",
      postInteractions: [{
        action: "like",
        id: 42,
        postId: 42,
        title: "可打开主帖",
        preview: "这条记录可以打开。",
        author: "alice",
        communityName: "大厅",
        createdAtText: "刚刚",
      }],
      subPostInteractions: [{
        action: "like",
        subPostId: 7,
        mainPostId: "",
        postId: "",
        content: "已删除子帖旧正文不应出现在资料库。",
        subPostPreview: "已删除子帖旧摘要不应出现在资料库。",
      }],
    });

    expect(markup).toContain("共 1 条");
    expect(markup).toContain("1 条记录缺少可打开的主帖信息，已从列表中隐藏。");
    expect(markup).toContain("可打开主帖");
    expect(markup).toContain("post-card-share-btn");
    expect(markup.match(/post-card-share-btn/g)).toHaveLength(1);
    expect(markup).not.toContain("已删除子帖旧正文不应出现在资料库。");
    expect(markup).not.toContain("已删除子帖旧摘要不应出现在资料库。");
  });

  it("keeps malformed page summary inputs in an empty state", () => {
    expect(buildLibraryPageSummary({
      pageTitle: "收藏",
      defaultEmptyText: "暂无收藏。",
      entries: null,
      groups: null,
      visibleEntryCount: "bad-count",
      unavailableEntryCount: "bad-count",
    })).toEqual({
      totalEntryCount: 0,
      groupCount: 0,
      visibleEntryCount: 0,
      unavailableEntryCount: 0,
      showGroups: false,
      showEmpty: true,
      showUnavailable: false,
      emptyText: "暂无收藏。",
      unavailableMessage: "",
    });
  });

  it("accepts positive integer ids and rejects malformed ids", () => {
    expect(normalizeLibraryPostId(42)).toBe(42);
    expect(normalizeLibraryPostId("42")).toBe(42);
    expect(normalizeLibraryPostId("")).toBe(0);
    expect(normalizeLibraryPostId(0)).toBe(0);
    expect(normalizeLibraryPostId(-1)).toBe(0);
    expect(normalizeLibraryPostId(1.5)).toBe(0);
    expect(normalizeLibraryPostId("abc")).toBe(0);
  });

  it("builds a navigable main post fallback for sub post library entries", () => {
    expect(resolveSubPostMainPost({
      postId: "42",
      postTitle: "被回复的主帖",
    })).toMatchObject({
      id: 42,
      title: "被回复的主帖",
    });
  });

  it("shows media-only sub-post library previews instead of legacy no-content text", () => {
    expect(resolveSubPostContent({
      subPostPreview: "无内容",
      mediaAssets: [{ id: 1 }],
    })).toBe("1张图");
  });

  it("keeps embedded main-post preview fields when only the outer interaction has the post id", () => {
    expect(resolveSubPostMainPost({
      postId: "42",
      postTitle: "外层标题",
      mainPost: {
        title: "嵌套标题",
        preview: "嵌套摘要",
        mediaUrls: ["/new.webp"],
        mediaAssets: [{ id: 1, displayUrl: "/new.webp" }],
        previewImages: ["/thumb.webp"],
        tags: ["图文"],
      },
    })).toMatchObject({
      id: 42,
      postId: 42,
      title: "嵌套标题",
      preview: "嵌套摘要",
      mediaUrls: ["/new.webp"],
      mediaAssets: [{ id: 1, displayUrl: "/new.webp" }],
      previewImages: ["/thumb.webp"],
      tags: ["图文"],
    });
  });

  it("falls back to nested main-post aliases when embedded ids are malformed", () => {
    expect(resolveSubPostMainPost({
      mainPost: {
        id: "draft",
        postId: "42",
        title: "嵌套主帖",
      },
    })).toMatchObject({
      id: 42,
      title: "嵌套主帖",
    });
  });

  it("drops library groups that cannot resolve a valid main post id", () => {
    const result = resolveLibraryEntryGroups([
      {
        type: "main",
        item: {
          postId: "42",
          title: "收藏的主帖",
          author: "nya",
        },
        sortAt: 20,
      },
      {
        type: "sub",
        item: {
          postId: "not-a-number",
          content: "孤立的子帖记录",
        },
        sortAt: 30,
      },
    ]);

    const { groups } = result;
    expect(groups).toHaveLength(1);
    expect(groups[0].post.id).toBe(42);
    expect(groups[0].post.title).toBe("收藏的主帖");
    expect(result.unavailableEntryCount).toBe(1);
  });

  it("counts displayable library records separately from grouped main-post cards", () => {
    const result = resolveLibraryEntryGroups([
      {
        type: "sub",
        item: {
          subPostId: "7",
          postId: "42",
          content: "第一条子帖互动",
        },
        sortAt: 30,
      },
      {
        type: "sub",
        item: {
          subPostId: "8",
          postId: "42",
          content: "第二条子帖互动",
        },
        sortAt: 20,
      },
      {
        type: "main",
        item: {
          id: "42",
          title: "同一个主帖",
        },
        sortAt: 10,
      },
      {
        type: "sub",
        item: {
          subPostId: "9",
          postId: "",
          content: "不可打开的互动",
        },
        sortAt: 40,
      },
    ]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].subEntries).toHaveLength(2);
    expect(result.visibleEntryCount).toBe(3);
    expect(result.unavailableEntryCount).toBe(1);
  });

  it("uses a valid fallback post id when a preferred id field is malformed", () => {
    const groups = groupEntriesByMainPost([
      {
        type: "main",
        item: {
          id: "bad-id",
          postId: "42",
          title: "兼容旧载荷",
          author: "nya",
        },
        sortAt: 20,
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("42");
    expect(groups[0].post.id).toBe(42);
  });

  it("keeps the legacy group helper focused on displayable groups", () => {
    const groups = groupEntriesByMainPost([
      {
        type: "sub",
        item: {
          mainPostId: "",
          content: "缺少主帖的子帖记录",
        },
        sortAt: 10,
      },
    ]);

    expect(groups).toEqual([]);
  });

  it("targets a sub-post when a library group only comes from sub-post records", () => {
    expect(resolveLibraryOpenOptions({
      mainEntry: null,
      subEntries: [{
        item: {
          subPostId: "7",
        },
      }],
    }, "favorite")).toEqual({
      targetSubPostId: 7,
    });
  });

  it("falls back to usable sub-post ids when group target ids are malformed", () => {
    expect(resolveLibraryOpenOptions({
      mainEntry: null,
      subEntries: [{
        item: {
          subPostId: "draft",
          id: "7",
        },
      }],
    }, "favorite")).toEqual({
      targetSubPostId: 7,
    });
  });

  it("uses row targetSubPostId aliases when group sub-post ids are malformed", () => {
    expect(resolveLibraryOpenOptions({
      mainEntry: null,
      subEntries: [{
        item: {
          subPostId: "draft",
          targetSubPostId: "7",
          id: "7",
        },
      }],
    }, "favorite")).toEqual({
      targetSubPostId: 7,
    });
  });

  it("keeps main-post groups focused on the main post", () => {
    expect(resolveLibraryOpenOptions({
      mainEntry: {
        item: {
          id: 42,
        },
      },
      subEntries: [{
        item: {
          subPostId: "7",
        },
      }],
    }, "published")).toEqual({
      manageSource: "profile-published",
    });
  });

  it("targets the selected sub-post preview row", () => {
    expect(resolveLibrarySubEntryOpenOptions({
      item: {
        id: "8",
        subPostId: "7",
      },
    }, "favorite")).toEqual({
      targetSubPostId: 7,
    });
  });

  it("keeps published sub-post preview opens in the profile management source", () => {
    expect(resolveLibrarySubEntryOpenOptions({
      item: {
        id: "8",
      },
    }, "published")).toEqual({
      manageSource: "profile-published",
      targetSubPostId: 8,
    });
  });

  it("falls back to usable ids for selected sub-post preview rows", () => {
    expect(resolveLibrarySubEntryOpenOptions({
      item: {
        subPostId: "draft",
        id: "8",
      },
    }, "favorite")).toEqual({
      targetSubPostId: 8,
    });
  });

  it("uses targetSubPostId aliases for selected sub-post preview rows", () => {
    expect(resolveLibrarySubEntryOpenOptions({
      item: {
        subPostId: "draft",
        targetSubPostId: "8",
        id: "8",
      },
    }, "favorite")).toEqual({
      targetSubPostId: 8,
    });
  });
});

describe("profile library card share contract", () => {
  it("passes share actions through to grouped post cards", () => {
    expect(profileLibraryPageSource).toContain("sharePost,");
    expect(profileLibraryPageSource).toContain("isSharingPost,");
    expect(profileLibraryPageSource).toContain("sharePost={sharePost}");
    expect(profileLibraryPageSource).toContain("isSharingPost={isSharingPost}");
  });
});
