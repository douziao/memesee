import { describe, expect, it, vi } from "vitest";
import { buildDocumentMetadata } from "../appDocumentMetadata";
import { buildAppLayoutProps } from "./appLayoutProps";

vi.mock("./appLayoutChromePropsBuilders", () => ({
  buildAppChromeProps: vi.fn(() => ({ topbarProps: {}, forumGridProps: {} })),
}));

vi.mock("./appLayoutOverlayPropsBuilders", () => ({
  buildAppOverlayProps: vi.fn(() => ({
    authModalProps: {},
    floatingProps: {
      homeFloatingProps: {},
      postFloatingProps: {},
    },
    toastProps: {},
    lightboxProps: null,
  })),
}));

vi.mock("../appDocumentMetadata", () => ({
  buildDocumentMetadata: vi.fn(() => ({
    title: "metadata",
    description: "",
    canonicalUrl: "/",
    imageUrl: "",
    type: "website",
  })),
}));

describe("buildAppLayoutProps", () => {
  it("passes loaded sub-posts into document metadata for shared sub-post deep links", () => {
    const subPosts = [{ subPostId: "7", content: "目标子帖" }];

    const props = buildAppLayoutProps({
      appChrome: {
        route: {
          type: "post",
          mainPostId: 42,
          targetSubPostId: 7,
        },
      },
      view: "latest",
      postDetailView: {
        selectedPost: {
          id: 42,
          contentLoaded: true,
          title: "主帖",
        },
        subPosts,
      },
      subPostThread: {
        targetSubPostStatus: {
          kind: "located",
        },
      },
      queryRuntimes: {
        feedQueryRuntime: {
          selectedCommunitySlug: "",
        },
      },
      communityCatalogState: {
        orderedCommunities: [],
      },
    });

    expect(buildDocumentMetadata).toHaveBeenCalledWith(expect.objectContaining({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: 7,
      },
      selectedPost: {
        id: 42,
        contentLoaded: true,
        title: "主帖",
      },
      subPosts,
      targetSubPostStatus: {
        kind: "located",
      },
    }));
    expect(props.metadataProps.title).toBe("metadata");
  });

  it("uses runtime metadata context after layout input has been sectionized", () => {
    const selectedPost = {
      id: 42,
      contentLoaded: true,
      title: "运行时详情",
    };
    const subPosts = [
      {
        id: 8,
        content: "分支回复",
      },
    ];
    const targetSubPostStatus = {
      kind: "located",
      targetSubPostId: 8,
    };
    const orderedCommunities = [
      {
        slug: "daily",
        name: "日常闲聊",
      },
    ];

    buildAppLayoutProps({
      shell: {
        route: {
          type: "post",
          mainPostId: 42,
          targetSubPostId: 8,
        },
        view: "latest",
      },
      detail: {
        selectedPost: null,
        subPosts: [],
      },
      metadataContext: {
        route: {
          type: "post",
          mainPostId: 42,
          targetSubPostId: 8,
        },
        view: "latest",
        selectedPost,
        subPosts,
        targetSubPostStatus,
        selectedCommunitySlug: "daily",
        orderedCommunities,
      },
    });

    expect(buildDocumentMetadata).toHaveBeenCalledWith(expect.objectContaining({
      route: {
        type: "post",
        mainPostId: 42,
        targetSubPostId: 8,
      },
      view: "latest",
      selectedPost,
      subPosts,
      targetSubPostStatus,
      selectedCommunity: {
        slug: "daily",
        name: "日常闲聊",
      },
    }));
  });

  it("resolves lobby metadata from navigation communities instead of exposing the slug", () => {
    buildAppLayoutProps({
      metadataContext: {
        route: {
          type: "home",
        },
        view: "latest",
        selectedCommunitySlug: "lobby",
        navigationCommunities: [
          {
            slug: "lobby",
            name: "大厅",
          },
        ],
        orderedCommunities: [],
      },
    });

    expect(buildDocumentMetadata).toHaveBeenCalledWith(expect.objectContaining({
      selectedCommunity: {
        slug: "lobby",
        name: "大厅",
      },
    }));
  });
});
