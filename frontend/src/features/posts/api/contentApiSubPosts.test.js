import { describe, expect, it, vi } from "vitest";
import { listMySubPosts } from "./contentApiSubPosts";

describe("contentApiSubPosts", () => {
  it("cleans profile sub-post previews from the personal sub-post list", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [{
          id: 7,
          mainPostId: 42,
          mainPostTitle: "主帖",
          mainPostContentPreview: "主帖包含 **Markdown** 和 ![图片](media:1)。",
          content: "子帖包含 **Markdown** and ![image](media:2).",
        }],
      }),
    };

    const [item] = await listMySubPosts(client, { token: "token" });

    expect(item.mainPost.preview).toBe("主帖包含 Markdown。");
    expect(item.subPostPreview).toBe("子帖包含 Markdown.");
  });

  it("uses media counts for media-only personal sub-post previews", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [{
          id: 7,
          mainPostId: 42,
          mainPostTitle: "主帖",
          content: "",
          subPostMediaAssetCount: 2,
        }],
      }),
    };

    const [item] = await listMySubPosts(client, { token: "token" });

    expect(item.subPostPreview).toBe("2张图");
  });

  it("accepts postId and postTitle aliases in the personal sub-post list", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [{
          id: 7,
          postId: 42,
          postTitle: "别名主帖",
          content: "子帖",
        }],
      }),
    };

    const [item] = await listMySubPosts(client, { token: "token" });

    expect(item).toMatchObject({
      postId: 42,
      mainPostId: 42,
      postTitle: "别名主帖",
      mainPostTitle: "别名主帖",
      mainPost: {
        id: 42,
        postId: 42,
        title: "别名主帖",
        postTitle: "别名主帖",
      },
    });
  });

  it("accepts targetSubPostId and parentId aliases in the personal sub-post list", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [{
          id: "draft",
          subPostId: "pending",
          targetSubPostId: 7,
          postId: 42,
          postTitle: "别名主帖",
          parentId: 3,
          content: "子帖",
        }],
      }),
    };

    const [item] = await listMySubPosts(client, { token: "token" });

    expect(item).toMatchObject({
      id: 7,
      subPostId: 7,
      targetSubPostId: 7,
      postId: 42,
      mainPostId: 42,
      parentId: 3,
      parentSubPostId: 3,
      postTitle: "别名主帖",
      mainPostTitle: "别名主帖",
    });
  });
});
