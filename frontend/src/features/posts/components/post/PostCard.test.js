import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPostCardShareButtonState } from "./PostCard";

const postCardSource = readFileSync(new URL("./PostCard.jsx", import.meta.url), "utf8");

describe("buildPostCardShareButtonState", () => {
  it("uses compact share copy for idle feed cards", () => {
    expect(buildPostCardShareButtonState({
      post: { id: 42 },
      isSharingPost: () => false,
    })).toEqual({
      sharing: false,
      label: "分享",
      title: "分享这条主帖",
      ariaLabel: "分享这条主帖",
    });
  });

  it("uses busy share copy while the feed card is sharing", () => {
    expect(buildPostCardShareButtonState({
      post: { id: 42 },
      isSharingPost: (post) => post?.id === 42,
    })).toEqual({
      sharing: true,
      label: "分享中",
      title: "正在准备分享",
      ariaLabel: "正在分享这条主帖",
    });
  });
});

describe("PostCard share action contract", () => {
  it("keeps the card share button from triggering the open-card cover", () => {
    expect(postCardSource).toContain("event.preventDefault();");
    expect(postCardSource).toContain("event.stopPropagation();");
    expect(postCardSource).toContain("sharePost?.(post);");
  });

  it("renders the share action only when a share handler is provided", () => {
    expect(postCardSource).toContain("{sharePost && (");
    expect(postCardSource).toContain("className=\"post-card-share-btn\"");
    expect(postCardSource).toContain("aria-busy={shareButtonState.sharing ? \"true\" : undefined}");
  });
});
