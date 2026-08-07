import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProfilePostShareButtonState } from "./ProfileCommunityPosts";

const profileCommunityPostsSource = readFileSync(
  new URL("./ProfileCommunityPosts.jsx", import.meta.url),
  "utf8",
);

describe("buildProfilePostShareButtonState", () => {
  it("uses compact share copy while idle", () => {
    expect(buildProfilePostShareButtonState({
      post: { id: 42 },
      isSharingPost: () => false,
    })).toEqual({
      sharing: false,
      label: "分享",
      title: "分享这条主帖",
      ariaLabel: "分享这条主帖",
    });
  });

  it("uses busy share copy while preparing the share", () => {
    expect(buildProfilePostShareButtonState({
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

describe("ProfileCommunityPosts share action contract", () => {
  it("keeps row sharing from opening the post detail row", () => {
    expect(profileCommunityPostsSource).toContain("event.preventDefault();");
    expect(profileCommunityPostsSource).toContain("event.stopPropagation();");
    expect(profileCommunityPostsSource).toContain("sharePost?.(post);");
  });

  it("renders the share action only when a share handler is provided", () => {
    expect(profileCommunityPostsSource).toContain("{sharePost && (");
    expect(profileCommunityPostsSource).toContain("className=\"profile-post-share\"");
    expect(profileCommunityPostsSource).toContain(
      "aria-busy={shareButtonState.sharing ? \"true\" : undefined}",
    );
  });
});
