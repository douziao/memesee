import { describe, expect, it } from "vitest";
import { buildMetadataLayoutInput } from "./appRuntimeLayoutInput";

describe("buildMetadataLayoutInput", () => {
  it("preserves post detail and target sub-post context for document metadata", () => {
    const route = {
      type: "post",
      mainPostId: 42,
      targetSubPostId: 8,
    };
    const selectedPost = {
      id: 42,
      contentLoaded: true,
      title: "主帖标题",
    };
    const subPosts = [
      {
        id: 7,
        content: "父级子帖",
        branchSubPosts: [
          {
            id: 8,
            content: "分支回复",
          },
        ],
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
    const navigationCommunities = [
      {
        slug: "lobby",
        name: "大厅",
      },
      ...orderedCommunities,
    ];

    expect(buildMetadataLayoutInput({
      view: "latest",
      appChrome: { route },
      queryRuntimes: {
        feedQueryRuntime: {
          selectedCommunitySlug: "daily",
        },
      },
      communityCatalogState: {
        navigationCommunities,
        orderedCommunities,
      },
      postDetailView: {
        selectedPost,
        subPosts,
      },
      subPostThreadState: {
        targetSubPostStatus,
      },
    })).toEqual({
      metadataContext: {
        route,
        view: "latest",
        selectedPost,
        subPosts,
        targetSubPostStatus,
        selectedCommunitySlug: "daily",
        navigationCommunities,
        orderedCommunities,
      },
    });
  });
});
