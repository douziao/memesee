import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { Window } from "happy-dom";

const DIST_ASSETS_DIR = fileURLToPath(new URL("../dist/assets/", import.meta.url));
const TEST_ORIGIN = "https://memesee.test";
const DEFAULT_SHARE_IMAGE_PATH = "/og-image.png";
const DEFAULT_SHARE_IMAGE_ALT = "MemeSee 社区论坛分享卡片";
const DEFAULT_SHARE_IMAGE_WIDTH = "1200";
const DEFAULT_SHARE_IMAGE_HEIGHT = "630";
const ROUTES = [
  {
    path: "/",
    label: "home",
    selectors: [".forum-app", ".post-card", ".post-title"],
    mobileAssertions: [
      {
        label: "home metadata updates",
        run: assertHomeMetadata,
      },
      {
        label: "home feed mobile controls are reachable",
        run: assertHomeMobileControls,
      },
    ],
    interactions: [
      {
        label: "feed share does not open the card",
        run: assertFeedShareDoesNotNavigate,
      },
      {
        label: "home floating actions load after scroll and return to top",
        run: assertHomeFloatingActionsAfterScroll,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "post detail",
    selectors: [".forum-app", ".post-detail-paper", ".detail-interact-wrap"],
    mobileAssertions: [
      {
        label: "post detail mobile actions are reachable",
        run: assertPostDetailMobileActions,
      },
      {
        label: "post detail metadata updates",
        run: assertPostDetailMetadata,
      },
      {
        label: "post detail more menu is reachable",
        run: assertPostDetailMoreMenu,
      },
    ],
    interactions: [
      {
        label: "guest like opens auth modal",
        run: assertGuestLikeOpensAuthModal,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "post detail signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".detail-interact-wrap"],
    mobileAssertions: [
      {
        label: "signed-in post detail mobile actions are reachable",
        run: (window) => assertPostDetailMobileActions(window, { expectGuestPrompt: false }),
      },
      {
        label: "signed-in post detail metadata updates",
        run: assertPostDetailMetadata,
      },
    ],
    interactions: [
      {
        label: "signed-in post floating actions load after scroll and return to top",
        run: assertPostDetailFloatingActionsAfterScroll,
      },
      {
        label: "signed-in sub-post media upload disables publishing until complete",
        run: assertSignedInSubPostComposerMediaUpload,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "post detail like failure signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".detail-interact-wrap"],
    mobileAssertions: [
      {
        label: "signed-in like failure detail actions are reachable",
        run: (window) => assertPostDetailMobileActions(window, { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in main-post like failure keeps detail unchanged",
        run: assertSignedInMainPostLikeFailure,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "post detail favorite failure signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".detail-interact-wrap"],
    mobileAssertions: [
      {
        label: "signed-in favorite failure detail actions are reachable",
        run: (window) => assertPostDetailMobileActions(window, { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in main-post favorite failure keeps detail unchanged",
        run: assertSignedInMainPostFavoriteFailure,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "sub-post like failure signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".main-sub-post"],
    mobileAssertions: [
      {
        label: "signed-in sub-post like failure floor is reachable",
        run: (window) => assertSubPostFloor(window, "signed-in sub-post like failure", { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in sub-post like failure keeps floor unchanged",
        run: assertSignedInSubPostLikeFailure,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "sub-post favorite failure signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".main-sub-post"],
    mobileAssertions: [
      {
        label: "signed-in sub-post favorite failure floor is reachable",
        run: (window) => assertSubPostFloor(window, "signed-in sub-post favorite failure", { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in sub-post favorite failure keeps floor unchanged",
        run: assertSignedInSubPostFavoriteFailure,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "sub-post like sync profile signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".main-sub-post"],
    mobileAssertions: [
      {
        label: "signed-in sub-post like sync floor is reachable",
        run: (window) => assertSubPostFloor(window, "signed-in sub-post like sync", { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in sub-post like syncs into profile library",
        run: assertSignedInSubPostLikeSyncsProfileLibrary,
      },
    ],
  },
  {
    path: "/posts/43",
    label: "rich post detail",
    selectors: [".forum-app", ".post-detail-paper", ".post-rich-gallery"],
    mobileAssertions: [
      {
        label: "rich post detail media is ready",
        run: assertRichPostDetailMediaReady,
      },
      {
        label: "rich post detail metadata updates",
        run: (window) => assertPostDetailMetadata(window, {
          expectedTitleText: sampleRichPost.title,
          expectedDescriptionText: sampleRichPost.content,
          expectedCanonicalPath: `/posts/${sampleRichPost.id}`,
          expectedImageUrl: `${TEST_ORIGIN}${sampleRichMediaAsset.displayUrl}`,
          expectedImageAlt: `${sampleRichPost.title} 分享图`,
          expectedImageWidth: "",
          expectedImageHeight: "",
          label: "rich post detail metadata",
        }),
      },
    ],
    interactions: [
      {
        label: "rich media image opens lightbox",
        run: assertRichPostGalleryLightbox,
      },
      {
        label: "rich post share copies readable context",
        run: assertRichPostShareCopiesReadableContext,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "post detail nested composer signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".main-sub-post"],
    mobileAssertions: [
      {
        label: "signed-in nested sub-post composer parent floor is reachable",
        run: (window) => assertSubPostFloor(window, "signed-in nested composer parent", { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in nested sub-post media upload publishes into the branch",
        run: assertSignedInNestedSubPostComposerMediaUpload,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "post detail sub-post delete signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".main-sub-post"],
    mobileAssertions: [
      {
        label: "signed-in deletable sub-post is reachable",
        run: (window) => assertSubPostFloor(window, "signed-in deletable sub-post", { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in sub-post delete removes the item",
        run: assertSignedInSubPostDelete,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "post detail processing media signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".detail-interact-wrap"],
    mobileAssertions: [
      {
        label: "signed-in processing media detail actions are reachable",
        run: (window) => assertPostDetailMobileActions(window, { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in sub-post processing media refreshes before publishing",
        run: assertSignedInProcessingSubPostMediaRefresh,
      },
    ],
  },
  {
    path: "/posts/42",
    label: "post detail retry media signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".post-detail-paper", ".detail-interact-wrap"],
    mobileAssertions: [
      {
        label: "signed-in retry media detail actions are reachable",
        run: (window) => assertPostDetailMobileActions(window, { expectGuestPrompt: false }),
      },
    ],
    interactions: [
      {
        label: "signed-in sub-post failed media upload retries before publishing",
        run: assertSignedInRetrySubPostMediaUpload,
      },
    ],
  },
  {
    path: "/posts/42?subPost=7",
    label: "sub-post deep link",
    selectors: [".forum-app", ".post-detail-paper"],
    mobileAssertions: [
      {
        label: "target sub-post deep link is located",
        run: assertTargetSubPostLocated,
      },
    ],
    interactions: [
      {
        label: "target sub-post share copies located permalink",
        run: assertTargetSubPostShareCopiesLocatedPermalink,
      },
    ],
  },
  {
    path: "/posts/42?subPost=8",
    label: "branch sub-post deep link",
    selectors: [".forum-app", ".post-detail-paper"],
    mobileAssertions: [
      {
        label: "target branch sub-post deep link is located",
        run: assertTargetBranchSubPostLocated,
      },
    ],
    interactions: [
      {
        label: "target branch sub-post share copies located permalink",
        run: assertTargetBranchSubPostShareCopiesLocatedPermalink,
      },
    ],
  },
  {
    path: "/posts/42?subPost=bad-id",
    label: "invalid sub-post deep link",
    selectors: [".forum-app", ".post-detail-paper"],
    mobileAssertions: [
      {
        label: "invalid target sub-post query opens plain post detail",
        run: assertInvalidTargetSubPostQueryIgnored,
      },
    ],
  },
  {
    path: "/posts/42?subPost=404",
    label: "missing sub-post deep link",
    selectors: [".forum-app", ".post-detail-paper"],
    mobileAssertions: [
      {
        label: "missing target sub-post opens readable parent detail",
        run: assertMissingTargetSubPostDeepLink,
      },
    ],
    interactions: [
      {
        label: "missing target sub-post share falls back to parent post",
        run: assertMissingTargetSubPostShareFallsBackToParentPost,
      },
    ],
  },
  {
    path: "/compose",
    label: "composer guest",
    selectors: [".forum-app", ".feed-status-card"],
    mobileAssertions: [
      {
        label: "composer guest metadata updates",
        run: assertComposerMetadata,
      },
      {
        label: "composer guest gate is readable",
        run: assertComposerGuestGate,
      },
    ],
  },
  {
    path: "/?compose=1",
    label: "legacy compose query",
    selectors: [".forum-app", ".feed-status-card"],
    mobileAssertions: [
      {
        label: "legacy compose metadata canonicalizes",
        run: assertComposerMetadata,
      },
      {
        label: "legacy compose query resolves composer gate",
        run: assertLegacyComposeQuery,
      },
    ],
  },
  {
    path: "/compose",
    label: "composer signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".composer-page", ".compose-title-input", ".compose-content-input"],
    mobileAssertions: [
      {
        label: "signed-in composer metadata updates",
        run: assertComposerMetadata,
      },
      {
        label: "signed-in composer controls are reachable",
        run: assertSignedInComposerControls,
      },
    ],
    interactions: [
      {
        label: "signed-in composer auxiliary controls work",
        run: assertSignedInComposerInteractions,
      },
    ],
  },
  {
    path: "/compose",
    label: "composer retry media signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".composer-page", ".compose-title-input", ".compose-content-input"],
    mobileAssertions: [
      {
        label: "signed-in retry composer controls are reachable",
        run: assertSignedInComposerControls,
      },
    ],
    interactions: [
      {
        label: "signed-in composer failed media upload retries before publishing",
        run: assertSignedInComposerRetryMediaUpload,
      },
    ],
  },
  {
    path: "/",
    label: "profile signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".top-profile-mini-btn", ".post-card"],
    mobileAssertions: [
      {
        label: "signed-in profile entry is reachable",
        run: assertSignedInProfileEntry,
      },
    ],
    interactions: [
      {
        label: "signed-in profile library opens post detail",
        run: assertSignedInProfileLibraryNavigation,
      },
    ],
  },
  {
    path: "/",
    label: "profile favorite signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".top-profile-mini-btn", ".post-card"],
    mobileAssertions: [
      {
        label: "signed-in favorite library entry is reachable",
        run: assertSignedInProfileEntry,
      },
    ],
    interactions: [
      {
        label: "signed-in favorite library share copies post context",
        run: assertSignedInFavoriteLibraryShare,
      },
    ],
  },
  {
    path: "/",
    label: "profile published management signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".top-profile-mini-btn", ".post-card"],
    mobileAssertions: [
      {
        label: "signed-in published library entry is reachable",
        run: assertSignedInProfileEntry,
      },
    ],
    interactions: [
      {
        label: "signed-in published library opens manageable post detail",
        run: assertSignedInPublishedLibraryManagement,
      },
    ],
  },
  {
    path: "/",
    label: "notifications signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".top-profile-mini-btn", ".post-card"],
    mobileAssertions: [
      {
        label: "signed-in notification entry is reachable",
        run: assertSignedInNotificationEntry,
      },
    ],
    interactions: [
      {
        label: "signed-in notification opens target sub-post detail",
        run: assertSignedInNotificationNavigation,
      },
    ],
  },
  {
    path: "/",
    label: "notification fallbacks signed-in",
    authSession: {
      token: "render-smoke-token",
      user: "smoke-author",
      userLevel: 3,
    },
    selectors: [".forum-app", ".top-profile-mini-btn", ".post-card"],
    mobileAssertions: [
      {
        label: "signed-in fallback notification entry is reachable",
        run: assertSignedInFallbackNotificationEntry,
      },
    ],
    interactions: [
      {
        label: "signed-in fallback notification degrades safely",
        run: assertSignedInFallbackNotificationNavigation,
      },
    ],
  },
  {
    path: "/?post=42",
    label: "legacy post query",
    selectors: [".forum-app", ".post-detail-paper"],
    mobileAssertions: [
      {
        label: "legacy query resolves post detail",
        run: assertLegacyQueryPostDetail,
      },
    ],
  },
  {
    path: "/?post=42&subPost=8",
    label: "legacy branch sub-post query",
    selectors: [".forum-app", ".post-detail-paper"],
    mobileAssertions: [
      {
        label: "legacy query resolves branch sub-post detail",
        run: assertLegacyBranchSubPostQuery,
      },
    ],
  },
];

const samplePost = {
  id: 42,
  communitySlug: "general",
  communityName: "综合讨论",
  title: "生产渲染冒烟帖子",
  content: "这条帖子用于验证生产 bundle 可以在浏览器环境正常挂载。",
  contentPreview: "这条帖子用于验证生产 bundle 可以在浏览器环境正常挂载。",
  postMode: "long",
  authorUsername: "smoke-user",
  createdAt: "2026-06-08T00:00:00Z",
  updatedAt: "2026-06-08T00:00:00Z",
  latestActivityAt: "2026-06-08T00:00:00Z",
  viewCount: 12,
  subPostCount: 2,
  likeCount: 2,
  favoriteCount: 1,
  tags: ["smoke"],
  mediaAssets: [],
};

const sampleSubPost = {
  id: 7,
  subPostId: 7,
  mainPostId: 42,
  authorUsername: "reply-user",
  content: "用于验证子帖定位深链的冒烟回复。",
  createdAt: "2026-06-08T00:01:00Z",
  updatedAt: "2026-06-08T00:01:00Z",
  likeCount: 1,
  favoriteCount: 0,
  childSubPostCount: 1,
};

const sampleBranchSubPost = {
  id: 8,
  subPostId: 8,
  mainPostId: 42,
  parentSubPostId: sampleSubPost.id,
  parentId: sampleSubPost.id,
  parentSubPostAuthorUsername: sampleSubPost.authorUsername,
  authorUsername: "branch-reply-user",
  content: "用于验证嵌套分支回复也能被深链精确定位。",
  createdAt: "2026-06-08T00:02:00Z",
  updatedAt: "2026-06-08T00:02:00Z",
  likeCount: 0,
  favoriteCount: 1,
  childSubPostCount: 0,
};

const sampleDeletableSubPostContent = "生产冒烟可删除子帖。";
const sampleDeletableSubPost = {
  id: 213,
  subPostId: 213,
  mainPostId: 42,
  parentSubPostId: null,
  parentId: null,
  authorUsername: "smoke-author",
  content: sampleDeletableSubPostContent,
  createdAt: "2026-06-08T00:13:00Z",
  updatedAt: "2026-06-08T00:13:00Z",
  likeCount: 0,
  favoriteCount: 0,
  childSubPostCount: 0,
  mediaAssets: [],
};

const sampleCreatedNestedSubPostContent = "生产冒烟嵌套回复发布成功。";
const sampleCreatedNestedSubPost = {
  id: 209,
  subPostId: 209,
  mainPostId: 42,
  parentSubPostId: sampleSubPost.id,
  parentId: sampleSubPost.id,
  parentSubPostAuthorUsername: sampleSubPost.authorUsername,
  authorUsername: "smoke-author",
  content: sampleCreatedNestedSubPostContent,
  createdAt: "2026-06-08T00:07:00Z",
  updatedAt: "2026-06-08T00:07:00Z",
  likeCount: 0,
  favoriteCount: 0,
  childSubPostCount: 0,
  mediaAssets: [],
};

const sampleCreatedProcessingSubPostContent = "生产冒烟处理后图片发布成功。";
const sampleCreatedProcessingSubPost = {
  id: 210,
  subPostId: 210,
  mainPostId: 42,
  parentSubPostId: null,
  parentId: null,
  authorUsername: "smoke-author",
  content: sampleCreatedProcessingSubPostContent,
  createdAt: "2026-06-08T00:08:00Z",
  updatedAt: "2026-06-08T00:08:00Z",
  likeCount: 0,
  favoriteCount: 0,
  childSubPostCount: 0,
  mediaAssets: [],
};

const sampleCreatedRetrySubPostContent = "生产冒烟失败重试图片发布成功。";
const sampleCreatedRetrySubPost = {
  id: 211,
  subPostId: 211,
  mainPostId: 42,
  parentSubPostId: null,
  parentId: null,
  authorUsername: "smoke-author",
  content: sampleCreatedRetrySubPostContent,
  createdAt: "2026-06-08T00:09:00Z",
  updatedAt: "2026-06-08T00:09:00Z",
  likeCount: 0,
  favoriteCount: 0,
  childSubPostCount: 0,
  mediaAssets: [],
};

const sampleCreatedRetryMainPostTitle = "生产冒烟主帖图片重试发布";
const sampleCreatedRetryMainPostContent = "生产冒烟主帖图片失败重试后发布成功。";
const sampleCreatedRetryMainPost = {
  id: 212,
  communitySlug: "daily",
  communityName: "日常闲聊",
  title: sampleCreatedRetryMainPostTitle,
  content: sampleCreatedRetryMainPostContent,
  contentPreview: sampleCreatedRetryMainPostContent,
  postMode: "long",
  authorUsername: "smoke-author",
  createdAt: "2026-06-08T00:10:00Z",
  updatedAt: "2026-06-08T00:10:00Z",
  latestActivityAt: "2026-06-08T00:10:00Z",
  viewCount: 0,
  subPostCount: 0,
  likeCount: 0,
  favoriteCount: 0,
  tags: [],
  mediaAssets: [],
};

const sampleAuthenticatedUser = {
  username: "smoke-author",
  uid: 1001,
  joinedAt: "2026-06-01T00:00:00Z",
  level: 3,
  progress: {
    currentLevel: 3,
    nextLevel: 4,
    completionPercent: 40,
    achievedCount: 2,
    totalCount: 5,
  },
};

const sampleUploadedMediaAsset = {
  id: 201,
  publicId: "render-smoke-media-201",
  processingStatus: "READY",
  displayUrl: "/media/render-smoke-201-display.webp",
  mediumUrl: "/media/render-smoke-201-medium.webp",
  thumbUrl: "/media/render-smoke-201-thumb.webp",
  originalUrl: "/media/render-smoke-201-original.webp",
};

const sampleProcessingMediaAsset = {
  id: 202,
  publicId: "render-smoke-media-202",
  processingStatus: "PROCESSING",
  displayUrl: "",
  mediumUrl: "",
  thumbUrl: "",
  originalUrl: "",
};

const sampleReadyProcessingMediaAsset = {
  ...sampleProcessingMediaAsset,
  processingStatus: "READY",
  displayUrl: "/media/render-smoke-202-display.webp",
  mediumUrl: "/media/render-smoke-202-medium.webp",
  thumbUrl: "/media/render-smoke-202-thumb.webp",
  originalUrl: "/media/render-smoke-202-original.webp",
};

const sampleRetryMediaAsset = {
  id: 203,
  publicId: "render-smoke-media-203",
  processingStatus: "READY",
  displayUrl: "/media/render-smoke-203-display.webp",
  mediumUrl: "/media/render-smoke-203-medium.webp",
  thumbUrl: "/media/render-smoke-203-thumb.webp",
  originalUrl: "/media/render-smoke-203-original.webp",
};

const sampleRichMediaAsset = {
  id: 204,
  publicId: "render-smoke-media-204",
  processingStatus: "READY",
  displayUrl: "/media/render-smoke-204-display.webp",
  mediumUrl: "/media/render-smoke-204-medium.webp",
  smallUrl: "/media/render-smoke-204-small.webp",
  thumbUrl: "/media/render-smoke-204-thumb.webp",
  originalUrl: "/media/render-smoke-204-original.webp",
  width: 1600,
  height: 900,
};

const sampleRichPost = {
  id: 43,
  communitySlug: "gallery",
  communityName: "图片分享",
  title: "生产渲染富媒体图文",
  content: "这条图文用于验证富媒体图片可以打开预览并查看原图。",
  contentPreview: "这条图文用于验证富媒体图片可以打开预览并查看原图。",
  postMode: "rich",
  authorUsername: "gallery-user",
  createdAt: "2026-06-08T00:11:00Z",
  updatedAt: "2026-06-08T00:11:00Z",
  latestActivityAt: "2026-06-08T00:11:00Z",
  viewCount: 8,
  subPostCount: 0,
  likeCount: 1,
  favoriteCount: 1,
  tags: ["gallery"],
  mediaAssets: [sampleRichMediaAsset],
};

function buildCreatedNestedSubPostResponse(payload = {}) {
  const mediaAssetIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : [];
  return {
    ...sampleCreatedNestedSubPost,
    parentSubPostId: Number(payload.parentSubPostId || 0) || sampleSubPost.id,
    parentId: Number(payload.parentSubPostId || 0) || sampleSubPost.id,
    content: String(payload.content || sampleCreatedNestedSubPostContent),
    mediaAssets: mediaAssetIds.includes(sampleUploadedMediaAsset.id)
      ? [sampleUploadedMediaAsset]
      : [],
  };
}

function buildCreatedProcessingSubPostResponse(payload = {}) {
  const mediaAssetIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : [];
  return {
    ...sampleCreatedProcessingSubPost,
    content: String(payload.content || sampleCreatedProcessingSubPostContent),
    mediaAssets: mediaAssetIds.includes(sampleReadyProcessingMediaAsset.id)
      ? [sampleReadyProcessingMediaAsset]
      : [],
  };
}

function buildCreatedRetrySubPostResponse(payload = {}) {
  const mediaAssetIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : [];
  return {
    ...sampleCreatedRetrySubPost,
    content: String(payload.content || sampleCreatedRetrySubPostContent),
    mediaAssets: mediaAssetIds.includes(sampleRetryMediaAsset.id)
      ? [sampleRetryMediaAsset]
      : [],
  };
}

function buildCreatedRetryMainPostResponse(payload = {}) {
  const mediaAssetIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : [];
  const content = String(payload.content || sampleCreatedRetryMainPostContent);
  return {
    ...sampleCreatedRetryMainPost,
    communitySlug: String(payload.communitySlug || sampleCreatedRetryMainPost.communitySlug),
    title: String(payload.title || sampleCreatedRetryMainPostTitle),
    content,
    contentPreview: content,
    postMode: payload.postMode === "rich" ? "rich" : "long",
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    mediaAssets: mediaAssetIds.includes(sampleRetryMediaAsset.id)
      ? [sampleRetryMediaAsset]
      : [],
  };
}

const sampleProfilePost = {
  ...samplePost,
  id: 42,
  communitySlug: "daily",
  communityName: "日常闲聊",
  title: "个人中心点赞主帖",
  contentPreview: "这条主帖用于验证个人中心资料库可以回到详情页。",
  content: "这条主帖用于验证个人中心资料库可以回到详情页。",
  authorUsername: "smoke-author",
  likedByMe: true,
  favoritedByMe: true,
};

const samplePublishedProfilePost = {
  ...samplePost,
  id: 44,
  communitySlug: "daily",
  communityName: "日常闲聊",
  title: "个人中心发布主帖",
  contentPreview: "这条主帖用于验证个人中心发布资料库可以进入管理态。",
  content: "这条主帖用于验证个人中心发布资料库可以进入管理态。",
  authorUsername: sampleAuthenticatedUser.username,
  author: sampleAuthenticatedUser.username,
  likedByMe: false,
  favoritedByMe: false,
};

const samplePublishedProfilePostUpdatedTitle = "个人中心发布主帖已保存";
const samplePublishedProfilePostUpdatedContent = "这条主帖已经通过生产冒烟保存修改。";

function buildUpdatedPublishedProfilePost(payload = {}) {
  const title = String(payload.title || samplePublishedProfilePostUpdatedTitle);
  const content = String(payload.content || samplePublishedProfilePostUpdatedContent);
  return {
    ...samplePublishedProfilePost,
    title,
    content,
    contentPreview: content,
    postMode: payload.postMode === "rich" ? "rich" : "long",
    tags: Array.isArray(payload.tags) ? payload.tags : samplePublishedProfilePost.tags,
    mediaAssets: [],
    updatedAt: "2026-06-08T00:12:00Z",
    latestActivityAt: "2026-06-08T00:12:00Z",
  };
}

const sampleNotification = {
  id: 99,
  type: "SUB_POST_REPLIED",
  mainPostId: samplePost.id,
  subPostId: sampleBranchSubPost.id,
  actorUsername: sampleBranchSubPost.authorUsername,
  mainPostTitle: samplePost.title,
  title: "子帖回复",
  body: `${sampleBranchSubPost.authorUsername} 回复了《${samplePost.title}》下的子帖：${sampleBranchSubPost.content}`,
  createdAt: "2026-06-08T00:04:00Z",
  read: false,
};

const sampleDeletedSubPostNotification = {
  id: 100,
  type: "SUB_POST_REPLIED",
  mainPostId: samplePost.id,
  subPostId: sampleSubPost.id,
  actorUsername: "reply-cleanup",
  mainPostTitle: samplePost.title,
  title: "子帖回复",
  body: `reply-cleanup 回复了《${samplePost.title}》下的子帖：这条子帖已经被删除。`,
  createdAt: "2026-06-08T00:05:00Z",
  read: false,
  unavailableReason: "sub-post-deleted",
};

const sampleDeletedPostNotification = {
  id: 101,
  type: "POST_LIKE",
  mainPostId: null,
  postId: null,
  subPostId: null,
  actorUsername: "missing-post-user",
  mainPostTitle: "已删除主帖",
  title: "主帖获赞",
  body: "missing-post-user 点赞了已删除的主帖。",
  createdAt: "2026-06-08T00:06:00Z",
  read: false,
  unavailableReason: "post-deleted",
};

function findEntryAsset() {
  const entry = readdirSync(DIST_ASSETS_DIR)
    .find((file) => /^index-[\w-]+\.js$/.test(file));
  if (!entry) {
    throw new Error("Missing built entry JS. Run npm run build first.");
  }
  return join(DIST_ASSETS_DIR, entry);
}

function parseJsonRequestBody(body) {
  if (typeof body !== "string" || !body.trim()) {
    return {};
  }
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function shouldFailApiRequest(url, { method = "GET" } = {}) {
  const parsed = new URL(url, TEST_ORIGIN);
  const path = parsed.pathname;
  const requestMethod = String(method || "GET").toUpperCase();
  const routeLabel = String(globalThis.__renderSmokeRoute?.label || "");
  if (
    routeLabel === "post detail like failure signed-in"
    && path === "/api/main-posts/42/likes"
    && requestMethod === "POST"
  ) {
    globalThis.__renderSmokeFailedMainPostLike = true;
    return true;
  }
  if (
    routeLabel === "post detail favorite failure signed-in"
    && path === "/api/main-posts/42/favorites"
    && requestMethod === "POST"
  ) {
    globalThis.__renderSmokeFailedMainPostFavorite = true;
    return true;
  }
  if (
    routeLabel === "sub-post like failure signed-in"
    && path === `/api/sub-posts/${sampleSubPost.id}/likes`
    && requestMethod === "POST"
  ) {
    globalThis.__renderSmokeFailedSubPostLike = true;
    return true;
  }
  if (
    routeLabel === "sub-post favorite failure signed-in"
    && path === `/api/sub-posts/${sampleSubPost.id}/favorites`
    && requestMethod === "POST"
  ) {
    globalThis.__renderSmokeFailedSubPostFavorite = true;
    return true;
  }
  if (
    (
      routeLabel === "post detail retry media signed-in"
      || routeLabel === "composer retry media signed-in"
    )
    && path === "/api/media-assets"
    && requestMethod === "POST"
  ) {
    globalThis.__renderSmokeRetryMediaUploadAttempts =
      Number(globalThis.__renderSmokeRetryMediaUploadAttempts || 0) + 1;
    return globalThis.__renderSmokeRetryMediaUploadAttempts === 1;
  }
  return false;
}

function failedResponseForApi(url, { method = "GET" } = {}) {
  const parsed = new URL(url, TEST_ORIGIN);
  const path = parsed.pathname;
  const requestMethod = String(method || "GET").toUpperCase();
  const routeLabel = String(globalThis.__renderSmokeRoute?.label || "");
  if (
    routeLabel === "post detail like failure signed-in"
    && path === "/api/main-posts/42/likes"
    && requestMethod === "POST"
  ) {
    return { message: "点赞失败，请稍后重试。" };
  }
  if (
    routeLabel === "post detail favorite failure signed-in"
    && path === "/api/main-posts/42/favorites"
    && requestMethod === "POST"
  ) {
    return { message: "收藏失败，请稍后重试。" };
  }
  if (
    routeLabel === "sub-post like failure signed-in"
    && path === `/api/sub-posts/${sampleSubPost.id}/likes`
    && requestMethod === "POST"
  ) {
    return { message: "子帖点赞失败，请稍后重试。" };
  }
  if (
    routeLabel === "sub-post favorite failure signed-in"
    && path === `/api/sub-posts/${sampleSubPost.id}/favorites`
    && requestMethod === "POST"
  ) {
    return { message: "子帖收藏失败，请稍后重试。" };
  }
  return { message: "render smoke upload failed once" };
}

function responseForApi(url, { method = "GET", body = "" } = {}) {
  const parsed = new URL(url, TEST_ORIGIN);
  const path = parsed.pathname;
  const requestMethod = String(method || "GET").toUpperCase();
  const routeLabel = String(globalThis.__renderSmokeRoute?.label || "");
  const shouldMockNotifications = routeLabel === "notifications signed-in";
  const shouldMockNotificationFallbacks = routeLabel === "notification fallbacks signed-in";
  const shouldMockProcessingMedia = routeLabel === "post detail processing media signed-in";
  const shouldMockRetryMedia = routeLabel === "post detail retry media signed-in"
    || routeLabel === "composer retry media signed-in";
  const shouldMockComposerRetryMedia = routeLabel === "composer retry media signed-in";
  const shouldMockPublishedManagement = routeLabel === "profile published management signed-in";
  const shouldMockSubPostDelete = routeLabel === "post detail sub-post delete signed-in";
  const shouldMockSubPostProfileSync = routeLabel === "sub-post like sync profile signed-in";

  if (path === "/api/communities") {
    return [
      {
        id: 1,
        slug: "daily",
        name: "日常闲聊",
        description: "日常讨论",
        sortOrder: 1,
      },
      {
        id: 2,
        slug: "article",
        name: "长文观点",
        description: "长文发布",
        sortOrder: 2,
      },
    ];
  }
  if (path === "/api/feed") {
    const createdMainPost = globalThis.__renderSmokeCreatedRetryMainPost;
    const updatedPublishedPost = shouldMockPublishedManagement
      ? globalThis.__renderSmokeUpdatedPublishedProfilePost
      : null;
    return {
      posts: [
        ...(updatedPublishedPost && !globalThis.__renderSmokeDeletedPublishedProfilePost
          ? [updatedPublishedPost]
          : []),
        ...(createdMainPost ? [createdMainPost] : []),
        samplePost,
      ],
      nextCursor: "",
      hasMore: false,
    };
  }
  if (path === "/api/main-posts/42") {
    return samplePost;
  }
  if (path === `/api/main-posts/${sampleRichPost.id}`) {
    return sampleRichPost;
  }
  if (
    path === `/api/main-posts/${samplePublishedProfilePost.id}` &&
    requestMethod === "PUT"
  ) {
    const payload = parseJsonRequestBody(body);
    const updatedPost = buildUpdatedPublishedProfilePost(payload);
    globalThis.__renderSmokeUpdatedPublishedProfilePost = updatedPost;
    globalThis.__renderSmokeUpdatedPublishedProfilePostPayload = payload;
    return updatedPost;
  }
  if (
    path === `/api/main-posts/${samplePublishedProfilePost.id}` &&
    requestMethod === "DELETE"
  ) {
    globalThis.__renderSmokeDeletedPublishedProfilePost = true;
    return {};
  }
  if (path === `/api/main-posts/${samplePublishedProfilePost.id}`) {
    return globalThis.__renderSmokeUpdatedPublishedProfilePost || samplePublishedProfilePost;
  }
  if (path === `/api/main-posts/${sampleCreatedRetryMainPost.id}`) {
    return globalThis.__renderSmokeCreatedRetryMainPost || sampleCreatedRetryMainPost;
  }
  if (path === "/api/main-posts" && requestMethod === "POST") {
    const createdMainPost = shouldMockComposerRetryMedia
      ? buildCreatedRetryMainPostResponse(parseJsonRequestBody(body))
      : samplePost;
    if (shouldMockComposerRetryMedia) {
      globalThis.__renderSmokeCreatedRetryMainPost = createdMainPost;
    }
    return createdMainPost;
  }
  if (path === "/api/main-posts/42/sub-posts" && requestMethod === "POST") {
    const payload = parseJsonRequestBody(body);
    const createdSubPost = shouldMockRetryMedia
      ? buildCreatedRetrySubPostResponse(payload)
      : shouldMockProcessingMedia
      ? buildCreatedProcessingSubPostResponse(payload)
      : buildCreatedNestedSubPostResponse(payload);
    if (shouldMockRetryMedia) {
      globalThis.__renderSmokeCreatedRetrySubPost = createdSubPost;
    } else if (shouldMockProcessingMedia) {
      globalThis.__renderSmokeCreatedProcessingSubPost = createdSubPost;
    } else {
      globalThis.__renderSmokeCreatedNestedSubPost = createdSubPost;
    }
    return createdSubPost;
  }
  if (path === "/api/main-posts/42/sub-posts/page") {
    const createdSubPost = globalThis.__renderSmokeCreatedNestedSubPost;
    const createdProcessingSubPost = globalThis.__renderSmokeCreatedProcessingSubPost;
    const createdRetrySubPost = globalThis.__renderSmokeCreatedRetrySubPost;
    return {
      subPosts: [
        sampleSubPost,
        sampleBranchSubPost,
        ...(shouldMockSubPostDelete && !globalThis.__renderSmokeDeletedSubPost
          ? [sampleDeletableSubPost]
          : []),
        ...(createdSubPost ? [createdSubPost] : []),
        ...(createdProcessingSubPost ? [createdProcessingSubPost] : []),
        ...(createdRetrySubPost ? [createdRetrySubPost] : []),
      ],
      nextCursor: "",
      hasMore: false,
    };
  }
  if (
    path === `/api/sub-posts/${sampleDeletableSubPost.id}` &&
    requestMethod === "DELETE"
  ) {
    globalThis.__renderSmokeDeletedSubPost = true;
    return {};
  }
  if (
    path === `/api/sub-posts/${sampleSubPost.id}/likes` &&
    requestMethod === "POST"
  ) {
    globalThis.__renderSmokeSyncedSubPostLike = true;
    return {
      likedByMe: true,
      likeCount: Number(sampleSubPost.likeCount || 0) + 1,
    };
  }
  if (path === `/api/main-posts/${sampleRichPost.id}/sub-posts/page`) {
    return {
      subPosts: [],
      nextCursor: "",
      hasMore: false,
    };
  }
  if (path === `/api/main-posts/${samplePublishedProfilePost.id}/sub-posts/page`) {
    return {
      subPosts: [],
      nextCursor: "",
      hasMore: false,
    };
  }
  if (path === "/api/media-assets") {
    if (shouldMockRetryMedia) {
      return sampleRetryMediaAsset;
    }
    if (shouldMockProcessingMedia) {
      return sampleProcessingMediaAsset;
    }
    return sampleUploadedMediaAsset;
  }
  if (path === `/api/media-assets/${sampleRetryMediaAsset.id}`) {
    return sampleRetryMediaAsset;
  }
  if (path === `/api/media-assets/${sampleProcessingMediaAsset.id}`) {
    return sampleReadyProcessingMediaAsset;
  }
  if (path === `/api/media-assets/${sampleUploadedMediaAsset.id}`) {
    return sampleUploadedMediaAsset;
  }
  if (path === "/api/me/main-posts") {
    const publishedPost = globalThis.__renderSmokeUpdatedPublishedProfilePost || samplePublishedProfilePost;
    return {
      posts: shouldMockPublishedManagement
        ? globalThis.__renderSmokeDeletedPublishedProfilePost
          ? []
          : [publishedPost]
        : [sampleProfilePost],
      nextCursor: "",
      hasMore: false,
    };
  }
  if (path === "/api/me/sub-posts") {
    if (shouldMockPublishedManagement) {
      return [];
    }
    return [
      {
        id: sampleSubPost.id,
        subPostId: sampleSubPost.id,
        mainPostId: sampleProfilePost.id,
        mainPostTitle: sampleProfilePost.title,
        mainPostCommunitySlug: sampleProfilePost.communitySlug,
        mainPostCommunityName: sampleProfilePost.communityName,
        mainPostContentPreview: sampleProfilePost.contentPreview,
        mainPostAuthorUsername: sampleProfilePost.authorUsername,
        mainPostCreatedAt: sampleProfilePost.createdAt,
        mainPostLatestActivityAt: sampleProfilePost.latestActivityAt,
        mainPostViewCount: sampleProfilePost.viewCount,
        mainPostSubPostCount: sampleProfilePost.subPostCount,
        mainPostLikeCount: sampleProfilePost.likeCount,
        mainPostFavoriteCount: sampleProfilePost.favoriteCount,
        authorUsername: sampleSubPost.authorUsername,
        content: sampleSubPost.content,
        createdAt: sampleSubPost.createdAt,
        likeCount: sampleSubPost.likeCount,
        favoriteCount: sampleSubPost.favoriteCount,
      },
    ];
  }
  if (path === "/api/me/interactions") {
    return {
      postInteractions: [
        {
          postId: sampleProfilePost.id,
          action: "like",
          postTitle: sampleProfilePost.title,
          communitySlug: sampleProfilePost.communitySlug,
          communityName: sampleProfilePost.communityName,
          contentPreview: sampleProfilePost.contentPreview,
          authorUsername: sampleProfilePost.authorUsername,
          createdAt: sampleProfilePost.createdAt,
          latestActivityAt: sampleProfilePost.latestActivityAt,
          viewCount: sampleProfilePost.viewCount,
          subPostCount: sampleProfilePost.subPostCount,
          likeCount: sampleProfilePost.likeCount,
          favoriteCount: sampleProfilePost.favoriteCount,
          interactedAt: "2026-06-08T00:02:00Z",
        },
        {
          postId: sampleProfilePost.id,
          action: "favorite",
          postTitle: sampleProfilePost.title,
          communitySlug: sampleProfilePost.communitySlug,
          communityName: sampleProfilePost.communityName,
          contentPreview: sampleProfilePost.contentPreview,
          authorUsername: sampleProfilePost.authorUsername,
          createdAt: sampleProfilePost.createdAt,
          latestActivityAt: sampleProfilePost.latestActivityAt,
          viewCount: sampleProfilePost.viewCount,
          subPostCount: sampleProfilePost.subPostCount,
          likeCount: sampleProfilePost.likeCount,
          favoriteCount: sampleProfilePost.favoriteCount,
          interactedAt: "2026-06-08T00:03:00Z",
        },
      ],
      subPostInteractions: shouldMockSubPostProfileSync
        ? []
        : [
          {
            id: sampleSubPost.id,
            subPostId: sampleSubPost.id,
            mainPostId: sampleProfilePost.id,
            action: "like",
            mainPostTitle: sampleProfilePost.title,
            mainPostCommunitySlug: sampleProfilePost.communitySlug,
            mainPostCommunityName: sampleProfilePost.communityName,
            mainPostContentPreview: sampleProfilePost.contentPreview,
            mainPostAuthorUsername: sampleProfilePost.authorUsername,
            mainPostCreatedAt: sampleProfilePost.createdAt,
            mainPostLatestActivityAt: sampleProfilePost.latestActivityAt,
            mainPostViewCount: sampleProfilePost.viewCount,
            mainPostSubPostCount: sampleProfilePost.subPostCount,
            mainPostLikeCount: sampleProfilePost.likeCount,
            mainPostFavoriteCount: sampleProfilePost.favoriteCount,
            subPostAuthorUsername: sampleSubPost.authorUsername,
            subPostPreview: sampleSubPost.content,
            createdAt: sampleSubPost.createdAt,
            likeCount: sampleSubPost.likeCount,
            favoriteCount: sampleSubPost.favoriteCount,
            interactedAt: "2026-06-08T00:04:00Z",
          },
        ],
    };
  }
  if (path === "/api/notifications") {
    if (!shouldMockNotifications && !shouldMockNotificationFallbacks) {
      return {
        items: [],
        unreadCount: 0,
        nextCursor: "",
        hasMore: false,
      };
    }
    if (shouldMockNotificationFallbacks) {
      return {
        items: [sampleDeletedSubPostNotification, sampleDeletedPostNotification],
        unreadCount: 2,
        nextCursor: "",
        hasMore: false,
      };
    }
    return {
      items: [sampleNotification],
      unreadCount: 1,
      nextCursor: "",
      hasMore: false,
    };
  }
  if (path === "/api/notifications/read-state") {
    return {
      unreadCount: 0,
    };
  }
  if (path === "/api/users/me") {
    return sampleAuthenticatedUser;
  }
  return {};
}

function seedAuthSession(window, authSession = null) {
  if (!authSession) {
    return;
  }
  window.localStorage.setItem("memesee_token", authSession.token || "");
  window.localStorage.setItem("memesee_user", authSession.user || "");
  window.localStorage.setItem("memesee_user_level", String(authSession.userLevel || 0));
}

function getBodyText(window, maxLength = 160) {
  return window.document.body.textContent.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isRenderSmokeMediaImageUrl(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return false;
  }
  try {
    const parsed = new URL(rawValue, TEST_ORIGIN);
    return parsed.pathname.startsWith("/media/render-smoke-");
  } catch {
    return rawValue.includes("/media/render-smoke-");
  }
}

function assertElement(window, selector, label) {
  const element = window.document.querySelector(selector);
  if (!element) {
    throw new Error(`${label}: missing ${selector}; body="${getBodyText(window)}"`);
  }
  return element;
}

function assertButtonReady(window, selector, label) {
  const button = assertElement(window, selector, label);
  const tagName = String(button.tagName || "").toUpperCase();
  if (tagName !== "BUTTON") {
    throw new Error(`${label}: ${selector} is not a button`);
  }
  if (button.disabled) {
    throw new Error(`${label}: ${selector} is disabled`);
  }
  if (button.getAttribute("aria-busy") === "true") {
    throw new Error(`${label}: ${selector} is busy`);
  }
  return button;
}

function assertTextIncludes(window, selector, expectedText, label) {
  const element = assertElement(window, selector, label);
  const actualText = element.textContent.replace(/\s+/g, " ").trim();
  if (!actualText.includes(expectedText)) {
    throw new Error(`${label}: expected "${expectedText}" in ${selector}; actual="${actualText}"`);
  }
  return element;
}

function assertReadyMediaDidNotFail(container, label) {
  if (!container) {
    throw new Error(`${label}: missing media container`);
  }
  const failedItem = container.querySelector(
    ".is-image-failed, .responsive-image-shell.is-failed, [data-image-state='failed']",
  );
  if (failedItem) {
    throw new Error(`${label}: ready media rendered in a failed image state`);
  }
  const failedStatus = Array.from(container.querySelectorAll(".post-media-status, .sub-post-media-status"))
    .find((element) => element.textContent.includes("加载失败"));
  if (failedStatus) {
    throw new Error(`${label}: ready media exposed loading failure copy`);
  }
}

function readHeadAttribute(window, selector, attributeName) {
  return window.document.head.querySelector(selector)?.getAttribute(attributeName) || "";
}

function hasHeadElement(window, selector) {
  return Boolean(window.document.head.querySelector(selector));
}

function assertHeadAttributeIncludes(window, selector, attributeName, expectedText, label) {
  const actualText = readHeadAttribute(window, selector, attributeName);
  if (!actualText.includes(expectedText)) {
    throw new Error(`${label}: expected "${expectedText}" in ${selector}[${attributeName}]; actual="${actualText}"`);
  }
  return actualText;
}

function assertHeadAttributeEquals(window, selector, attributeName, expectedText, label) {
  const actualText = readHeadAttribute(window, selector, attributeName);
  if (actualText !== expectedText) {
    throw new Error(`${label}: expected ${selector}[${attributeName}]="${expectedText}"; actual="${actualText}"`);
  }
  return actualText;
}

function assertHeadElementAbsent(window, selector, label) {
  if (hasHeadElement(window, selector)) {
    throw new Error(`${label}: expected ${selector} to be absent`);
  }
}

function hasExpectedShareImageMetadata(window, {
  expectedImageUrl,
  expectedImageAlt,
  expectedImageWidth,
  expectedImageHeight,
}) {
  const hasExpectedWidth = expectedImageWidth
    ? readHeadAttribute(window, 'meta[property="og:image:width"]', "content") === expectedImageWidth
    : !hasHeadElement(window, 'meta[property="og:image:width"]');
  const hasExpectedHeight = expectedImageHeight
    ? readHeadAttribute(window, 'meta[property="og:image:height"]', "content") === expectedImageHeight
    : !hasHeadElement(window, 'meta[property="og:image:height"]');
  return readHeadAttribute(window, 'meta[property="og:image"]', "content") === expectedImageUrl
    && readHeadAttribute(window, 'meta[name="twitter:image"]', "content") === expectedImageUrl
    && readHeadAttribute(window, 'meta[property="og:image:alt"]', "content") === expectedImageAlt
    && readHeadAttribute(window, 'meta[name="twitter:image:alt"]', "content") === expectedImageAlt
    && hasExpectedWidth
    && hasExpectedHeight;
}

function assertShareImageMetadata(window, {
  expectedImageUrl,
  expectedImageAlt,
  expectedImageWidth,
  expectedImageHeight,
  label,
}) {
  assertHeadAttributeEquals(
    window,
    'meta[property="og:image"]',
    "content",
    expectedImageUrl,
    `${label}: og image`,
  );
  assertHeadAttributeEquals(
    window,
    'meta[name="twitter:image"]',
    "content",
    expectedImageUrl,
    `${label}: twitter image`,
  );
  assertHeadAttributeEquals(
    window,
    'meta[property="og:image:alt"]',
    "content",
    expectedImageAlt,
    `${label}: og image alt`,
  );
  assertHeadAttributeEquals(
    window,
    'meta[name="twitter:image:alt"]',
    "content",
    expectedImageAlt,
    `${label}: twitter image alt`,
  );
  if (expectedImageWidth) {
    assertHeadAttributeEquals(
      window,
      'meta[property="og:image:width"]',
      "content",
      expectedImageWidth,
      `${label}: og image width`,
    );
  } else {
    assertHeadElementAbsent(window, 'meta[property="og:image:width"]', `${label}: og image width`);
  }
  if (expectedImageHeight) {
    assertHeadAttributeEquals(
      window,
      'meta[property="og:image:height"]',
      "content",
      expectedImageHeight,
      `${label}: og image height`,
    );
  } else {
    assertHeadElementAbsent(window, 'meta[property="og:image:height"]', `${label}: og image height`);
  }
}

function hasExpectedPageMetadata(window, {
  expectedTitleText,
  expectedDescriptionText,
  expectedCanonicalPath,
  expectedImageUrl,
  expectedImageAlt,
  expectedImageWidth,
  expectedImageHeight,
}) {
  const canonicalHref = readHeadAttribute(window, 'link[rel="canonical"]', "href");
  return window.document.title.includes(expectedTitleText)
    && readHeadAttribute(window, 'meta[property="og:title"]', "content").includes(expectedTitleText)
    && readHeadAttribute(window, 'meta[name="twitter:title"]', "content").includes(expectedTitleText)
    && readHeadAttribute(window, 'meta[property="og:description"]', "content").includes(expectedDescriptionText)
    && readHeadAttribute(window, 'meta[name="description"]', "content").includes(expectedDescriptionText)
    && canonicalHref === `${TEST_ORIGIN}${expectedCanonicalPath}`
    && readHeadAttribute(window, 'meta[property="og:url"]', "content") === canonicalHref
    && hasExpectedShareImageMetadata(window, {
      expectedImageUrl,
      expectedImageAlt,
      expectedImageWidth,
      expectedImageHeight,
    });
}

function describePageMetadata(window) {
  return JSON.stringify({
    title: window.document.title,
    description: readHeadAttribute(window, 'meta[name="description"]', "content"),
    canonical: readHeadAttribute(window, 'link[rel="canonical"]', "href"),
    ogTitle: readHeadAttribute(window, 'meta[property="og:title"]', "content"),
    ogDescription: readHeadAttribute(window, 'meta[property="og:description"]', "content"),
    ogUrl: readHeadAttribute(window, 'meta[property="og:url"]', "content"),
    ogImage: readHeadAttribute(window, 'meta[property="og:image"]', "content"),
    ogImageAlt: readHeadAttribute(window, 'meta[property="og:image:alt"]', "content"),
    ogImageWidth: readHeadAttribute(window, 'meta[property="og:image:width"]', "content"),
    ogImageHeight: readHeadAttribute(window, 'meta[property="og:image:height"]', "content"),
    twitterTitle: readHeadAttribute(window, 'meta[name="twitter:title"]', "content"),
    twitterImage: readHeadAttribute(window, 'meta[name="twitter:image"]', "content"),
    twitterImageAlt: readHeadAttribute(window, 'meta[name="twitter:image:alt"]', "content"),
  });
}

function findElementByText(window, selector, expectedText) {
  return [...window.document.querySelectorAll(selector)]
    .find((element) => element.textContent.replace(/\s+/g, " ").trim().includes(expectedText));
}

function assertElementByText(window, selector, expectedText, label) {
  const element = findElementByText(window, selector, expectedText);
  if (!element) {
    throw new Error(`${label}: missing ${selector} containing "${expectedText}"; body="${getBodyText(window)}"`);
  }
  return element;
}

function assertMobileViewport(window, label) {
  if (window.innerWidth > 480) {
    throw new Error(`${label}: expected mobile viewport, got ${window.innerWidth}x${window.innerHeight}`);
  }
  if (!window.matchMedia("(max-width: 640px)").matches) {
    throw new Error(`${label}: mobile media query did not match at ${window.innerWidth}px`);
  }
}

function assertAppShell(window, label) {
  assertMobileViewport(window, label);

  const roots = window.document.querySelectorAll("#root");
  if (roots.length !== 1) {
    throw new Error(`${label}: expected one #root, found ${roots.length}`);
  }

  const apps = window.document.querySelectorAll(".forum-app");
  if (apps.length !== 1) {
    throw new Error(`${label}: expected one .forum-app, found ${apps.length}`);
  }

  if (window.document.body.textContent.trim().length < 10) {
    throw new Error(`${label}: rendered body is unexpectedly sparse`);
  }
}

class MockXMLHttpRequest {
  static UNSENT = 0;
  static OPENED = 1;
  static HEADERS_RECEIVED = 2;
  static LOADING = 3;
  static DONE = 4;

  constructor() {
    this.window = globalThis.window;
    this.pendingRequest = null;
    this.readyState = MockXMLHttpRequest.UNSENT;
    this.status = 0;
    this.statusText = "";
    this.responseText = "";
    this.response = "";
    this.responseURL = "";
    this.timeout = 0;
    this.withCredentials = false;
    this.requestHeaders = {};
    this.responseHeaders = {
      "content-type": "application/json; charset=utf-8",
    };
    this.listeners = new Map();
  }

  open(method, url) {
    this.method = method;
    this.url = url;
    this.readyState = MockXMLHttpRequest.OPENED;
    this.dispatch("readystatechange");
  }

  setRequestHeader(name, value) {
    this.requestHeaders[name] = value;
  }

  getAllResponseHeaders() {
    return Object.entries(this.responseHeaders)
      .map(([name, value]) => `${name}: ${value}`)
      .join("\r\n");
  }

  getResponseHeader(name) {
    return this.responseHeaders[String(name || "").toLowerCase()] || null;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    const event = { type, target: this, currentTarget: this };
    this[`on${type}`]?.(event);
    this.listeners.get(type)?.forEach((listener) => listener.call(this, event));
  }

  send(body = "") {
    this.requestBody = body;
    this.pendingRequest = this.window.setTimeout(() => {
      this.pendingRequest = null;
      const shouldFail = shouldFailApiRequest(this.url, { method: this.method });
      this.status = shouldFail ? 500 : 200;
      this.statusText = shouldFail ? "Internal Server Error" : "OK";
      this.readyState = MockXMLHttpRequest.DONE;
      this.responseURL = new URL(this.url, TEST_ORIGIN).href;
      this.responseText = JSON.stringify(
        shouldFail
          ? failedResponseForApi(this.url, { method: this.method })
          : responseForApi(this.url, {
            method: this.method,
            body: this.requestBody,
          }),
      );
      this.response = this.responseText;
      this.dispatch("readystatechange");
      this.dispatch("load");
      this.dispatch("loadend");
    }, responseDelayForApi(this.url));
  }

  abort() {
    if (this.pendingRequest !== null) {
      this.window.clearTimeout(this.pendingRequest);
      this.pendingRequest = null;
    }
    this.readyState = MockXMLHttpRequest.DONE;
    this.dispatch("abort");
    this.dispatch("loadend");
  }
}

function responseDelayForApi(url) {
  const parsed = new URL(url, TEST_ORIGIN);
  if (parsed.pathname === "/api/media-assets") {
    return 160;
  }
  return 0;
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function installWindowGlobals(window) {
  const globals = [
    "window",
    "document",
    "navigator",
    "location",
    "history",
    "HTMLElement",
    "Element",
    "Node",
    "MutationObserver",
    "CustomEvent",
    "Event",
    "KeyboardEvent",
    "MouseEvent",
    "FormData",
    "File",
    "Blob",
    "localStorage",
    "sessionStorage",
  ];

  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      value: window[key],
      configurable: true,
      writable: true,
    });
  }

  window.fetch = async () => new Response("", { status: 200 });
  globalThis.fetch = window.fetch;
  if (window.HTMLImageElement?.prototype) {
    Object.defineProperty(window.HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() {
        return isRenderSmokeMediaImageUrl(this.currentSrc || this.src || this.getAttribute?.("src"));
      },
    });
    Object.defineProperty(window.HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return isRenderSmokeMediaImageUrl(this.currentSrc || this.src || this.getAttribute?.("src")) ? 640 : 0;
      },
    });
    Object.defineProperty(window.HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get() {
        return isRenderSmokeMediaImageUrl(this.currentSrc || this.src || this.getAttribute?.("src")) ? 360 : 0;
      },
    });
  }
  window.__copiedText = [];
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: async (text) => {
        window.__copiedText.push(String(text || ""));
      },
    },
    configurable: true,
  });
  window.document.execCommand = (command) => String(command || "").toLowerCase() === "copy";
  window.XMLHttpRequest = MockXMLHttpRequest;
  globalThis.XMLHttpRequest = MockXMLHttpRequest;
  window.IntersectionObserver = NoopObserver;
  globalThis.IntersectionObserver = NoopObserver;
  window.ResizeObserver = NoopObserver;
  globalThis.ResizeObserver = NoopObserver;
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  globalThis.requestAnimationFrame = window.requestAnimationFrame;
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
  window.__scrollToCalls = [];
  window.scrollTo = (options = {}) => {
    const top = typeof options === "number" ? options : options?.top;
    const nextTop = Number.isFinite(Number(top)) ? Number(top) : 0;
    window.__scrollToCalls.push(options);
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: nextTop,
    });
    Object.defineProperty(window, "pageYOffset", {
      configurable: true,
      value: nextTop,
    });
  };
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) => ({
    matches: nativeMatchMedia(query).matches,
    media: String(query || ""),
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
  const nativeGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function getRenderSmokeRect() {
    const classList = this.classList;
    if (classList?.contains("post-rich-gallery-frame")) {
      return buildClientRect({ width: 340, height: 240 });
    }
    if (classList?.contains("post-rich-gallery-image-shell")) {
      return buildClientRect({ width: 340, height: 191 });
    }
    if (classList?.contains("image-lightbox-stage")) {
      return buildClientRect({ width: 390, height: 844 });
    }
    if (classList?.contains("image-lightbox-media")) {
      return buildClientRect({ left: 16, top: 160, width: 358, height: 202 });
    }
    return nativeGetBoundingClientRect.call(this);
  };

  const originalHeadAppendChild = window.document.head.appendChild.bind(window.document.head);
  window.document.head.appendChild = (node) => {
    if (
      String(node?.tagName || "").toUpperCase() === "LINK" &&
      /\.(?:css)(?:\?|$)/i.test(String(node.href || node.getAttribute?.("href") || ""))
    ) {
      window.setTimeout(() => {
        node.dispatchEvent(new window.Event("load"));
      }, 0);
      return node;
    }
    return originalHeadAppendChild(node);
  };
}

function buildClientRect({
  left = 0,
  top = 0,
  width = 0,
  height = 0,
}) {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this;
    },
  };
}

async function waitForRouteReady(window, route) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const missing = route.selectors.filter((selector) => !window.document.querySelector(selector));
    if (missing.length === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const missing = route.selectors.filter((selector) => !window.document.querySelector(selector));
  const bodyText = getBodyText(window);
  throw new Error(`${route.label}: missing rendered selectors ${missing.join(", ")}; body="${bodyText}"`);
}

async function waitForCondition(label, condition, window, timeoutMs = 1200) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`${label}; body="${getBodyText(window)}"`);
}

function clickSelector(window, selector, label) {
  const target = assertElement(window, selector, label);
  clickElement(window, target);
}

function clickElement(window, target) {
  target.dispatchEvent(new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
}

function setFormControlValue(window, element, value, label) {
  if (!element) {
    throw new Error(`${label}: missing form control`);
  }
  const tagName = String(element.tagName || "").toUpperCase();
  const prototype = tagName === "TEXTAREA"
    ? window.HTMLTextAreaElement?.prototype
    : window.HTMLInputElement?.prototype;
  const descriptor = prototype
    ? Object.getOwnPropertyDescriptor(prototype, "value")
    : null;
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function assertAuthModalControls(window, label) {
  assertTextIncludes(window, ".auth-modal-card", "账号登录", label);
  assertButtonReady(window, ".auth-close-button", `${label}: close button`);
  assertButtonReady(window, ".auth-tabs button:nth-of-type(1)", `${label}: login tab`);
  assertButtonReady(window, ".auth-tabs button:nth-of-type(2)", `${label}: register tab`);
  assertElement(window, ".auth-modal-form input[autocomplete='username']", `${label}: username field`);
  assertElement(window, ".auth-modal-form input[autocomplete='current-password']", `${label}: password field`);
  assertButtonReady(window, ".auth-submit-button", `${label}: submit button`);
}

function assertHomeMobileControls(window) {
  assertTextIncludes(window, ".post-title", samplePost.title, "home mobile post title");
  assertButtonReady(window, ".post-open-cover", "home mobile open post target");
  assertButtonReady(window, ".post-card-share-btn", "home mobile share button");
  assertTextIncludes(window, ".post-card-share-btn", "分享", "home mobile share label");
}

function assertPostDetailMobileActions(window, options = {}) {
  const expectGuestPrompt = options.expectGuestPrompt !== false;
  assertTextIncludes(window, ".post-detail-paper", samplePost.title, "post detail mobile title");
  assertElement(window, ".detail-interact-bar-post", "post detail mobile action bar");
  assertButtonReady(window, ".detail-interact-btn-like", "post detail mobile like button");
  assertButtonReady(window, ".detail-interact-btn-share", "post detail mobile share button");
  assertButtonReady(window, ".detail-interact-btn-more", "post detail mobile more button");
  assertButtonReady(window, ".detail-interact-btn-sub-post", "post detail mobile sub-post button");
  if (expectGuestPrompt) {
    assertTextIncludes(window, ".detail-guest-engagement", "登录后可以点赞", "post detail guest engagement copy");
    assertButtonReady(window, ".detail-guest-engagement-login", "post detail guest engagement login");
  }
}

async function assertRichPostDetailMediaReady(window) {
  assertTextIncludes(window, ".post-detail-paper", sampleRichPost.title, "rich post detail mobile title");
  const gallery = assertElement(window, ".post-rich-gallery", "rich post gallery");
  await waitForCondition(
    "rich post gallery: image shell did not become clickable",
    () => {
      const button = window.document.querySelector(".post-rich-gallery-image-shell");
      return Boolean(
        button
          && !button.disabled
          && !button.classList.contains("is-sizing")
          && !button.classList.contains("is-not-viewable")
          && !button.classList.contains("is-image-failed"),
      );
    },
    window,
  );
  const imageShell = assertButtonReady(window, ".post-rich-gallery-image-shell", "rich post gallery image");
  if (imageShell.classList.contains("is-image-failed")) {
    throw new Error("rich post gallery: ready media rendered failed before lightbox open");
  }
  const image = assertElement(window, ".post-rich-gallery-image", "rich post gallery img");
  const imageUrl = image.getAttribute("src") || image.src || "";
  if (!imageUrl.includes("/media/render-smoke-204-medium.webp")) {
    throw new Error(`rich post gallery: expected medium image source, actual="${imageUrl}"`);
  }
  if (gallery.querySelector(".post-rich-gallery-image-fallback")) {
    throw new Error("rich post gallery: unexpected image failure fallback");
  }
}

async function assertRichPostGalleryLightbox(window) {
  await assertRichPostDetailMediaReady(window);
  clickSelector(window, ".post-rich-gallery-image-shell", "rich post gallery image open");
  await waitForCondition(
    "rich post gallery lightbox: overlay did not open",
    () => Boolean(window.document.querySelector(".image-lightbox-overlay")),
    window,
  );

  assertTextIncludes(window, ".image-lightbox-counter", "1 / 1", "rich post gallery lightbox counter");
  const media = assertElement(window, ".image-lightbox-media", "rich post gallery lightbox media");
  const displayUrl = media.getAttribute("src") || media.src || "";
  if (!displayUrl.includes("/media/render-smoke-204-medium.webp")) {
    throw new Error(`rich post gallery lightbox: expected display image source, actual="${displayUrl}"`);
  }
  if (window.document.querySelector(".image-lightbox-failure")) {
    throw new Error("rich post gallery lightbox: unexpected image failure state");
  }

  clickSelector(window, ".image-lightbox-tool.original", "rich post gallery lightbox original toggle");
  await waitForCondition(
    "rich post gallery lightbox: original image did not render",
    () => {
      const currentMedia = window.document.querySelector(".image-lightbox-media");
      const currentUrl = currentMedia?.getAttribute("src") || currentMedia?.src || "";
      return currentUrl.includes("/media/render-smoke-204-original.webp");
    },
    window,
  );
  if (window.document.querySelector(".image-lightbox-failure")) {
    throw new Error("rich post gallery lightbox: original image exposed failure state");
  }

  clickSelector(window, ".image-lightbox-close", "rich post gallery lightbox close");
  await waitForCondition(
    "rich post gallery lightbox: overlay did not close",
    () => !window.document.querySelector(".image-lightbox-overlay"),
    window,
  );
}

async function assertPostDetailMetadata(window, {
  expectedTitleText = samplePost.title,
  expectedDescriptionText = samplePost.content,
  expectedCanonicalPath = `/posts/${samplePost.id}`,
  expectedImageUrl = `${TEST_ORIGIN}${DEFAULT_SHARE_IMAGE_PATH}`,
  expectedImageAlt = `${expectedTitleText} 分享图`,
  expectedImageWidth = DEFAULT_SHARE_IMAGE_WIDTH,
  expectedImageHeight = DEFAULT_SHARE_IMAGE_HEIGHT,
  label = "post detail metadata",
} = {}) {
  try {
    await waitForCondition(
      `${label}: metadata did not update`,
      () => hasExpectedPageMetadata(window, {
        expectedTitleText,
        expectedDescriptionText,
        expectedCanonicalPath,
        expectedImageUrl,
        expectedImageAlt,
        expectedImageWidth,
        expectedImageHeight,
      }),
      window,
      10000,
    );
  } catch (error) {
    throw new Error(`${error.message}; metadata=${describePageMetadata(window)}`);
  }
  if (!window.document.title.includes(expectedTitleText)) {
    throw new Error(`${label}: document title is stale; actual="${window.document.title}"`);
  }
  assertHeadAttributeIncludes(
    window,
    'meta[property="og:title"]',
    "content",
    expectedTitleText,
    `${label}: og title`,
  );
  assertHeadAttributeIncludes(
    window,
    'meta[name="twitter:title"]',
    "content",
    expectedTitleText,
    `${label}: twitter title`,
  );
  assertHeadAttributeIncludes(
    window,
    'meta[property="og:description"]',
    "content",
    expectedDescriptionText,
    `${label}: og description`,
  );
  const canonicalHref = readHeadAttribute(window, 'link[rel="canonical"]', "href");
  if (canonicalHref !== `${TEST_ORIGIN}${expectedCanonicalPath}`) {
    throw new Error(`${label}: expected canonical "${TEST_ORIGIN}${expectedCanonicalPath}", actual="${canonicalHref}"`);
  }
  const ogUrl = readHeadAttribute(window, 'meta[property="og:url"]', "content");
  if (ogUrl !== canonicalHref) {
    throw new Error(`${label}: og:url "${ogUrl}" does not match canonical "${canonicalHref}"`);
  }
  assertShareImageMetadata(window, {
    expectedImageUrl,
    expectedImageAlt,
    expectedImageWidth,
    expectedImageHeight,
    label,
  });
}

async function assertPageMetadata(window, {
  expectedTitleText,
  expectedDescriptionText,
  expectedCanonicalPath,
  expectedImageUrl = `${TEST_ORIGIN}${DEFAULT_SHARE_IMAGE_PATH}`,
  expectedImageAlt = DEFAULT_SHARE_IMAGE_ALT,
  expectedImageWidth = DEFAULT_SHARE_IMAGE_WIDTH,
  expectedImageHeight = DEFAULT_SHARE_IMAGE_HEIGHT,
  label,
}) {
  await waitForCondition(
    `${label}: metadata did not update`,
    () => hasExpectedPageMetadata(window, {
      expectedTitleText,
      expectedDescriptionText,
      expectedCanonicalPath,
      expectedImageUrl,
      expectedImageAlt,
      expectedImageWidth,
      expectedImageHeight,
    }),
    window,
    3000,
  );
  assertHeadAttributeIncludes(
    window,
    'meta[property="og:title"]',
    "content",
    expectedTitleText,
    `${label}: og title`,
  );
  assertHeadAttributeIncludes(
    window,
    'meta[name="twitter:title"]',
    "content",
    expectedTitleText,
    `${label}: twitter title`,
  );
  assertHeadAttributeIncludes(
    window,
    'meta[property="og:description"]',
    "content",
    expectedDescriptionText,
    `${label}: og description`,
  );
  assertHeadAttributeIncludes(
    window,
    'meta[name="twitter:description"]',
    "content",
    expectedDescriptionText,
    `${label}: twitter description`,
  );
  const canonicalHref = readHeadAttribute(window, 'link[rel="canonical"]', "href");
  if (canonicalHref !== `${TEST_ORIGIN}${expectedCanonicalPath}`) {
    throw new Error(`${label}: expected canonical "${TEST_ORIGIN}${expectedCanonicalPath}", actual="${canonicalHref}"`);
  }
  const ogUrl = readHeadAttribute(window, 'meta[property="og:url"]', "content");
  if (ogUrl !== canonicalHref) {
    throw new Error(`${label}: og:url "${ogUrl}" does not match canonical "${canonicalHref}"`);
  }
  assertShareImageMetadata(window, {
    expectedImageUrl,
    expectedImageAlt,
    expectedImageWidth,
    expectedImageHeight,
    label,
  });
}

async function assertComposerMetadata(window) {
  await assertPageMetadata(window, {
    expectedTitleText: "发布主帖",
    expectedDescriptionText: "选择社区",
    expectedCanonicalPath: "/compose",
    label: "composer metadata",
  });
}

async function assertHomeMetadata(window, label = "home metadata") {
  await assertPageMetadata(window, {
    expectedTitleText: "大厅",
    expectedDescriptionText: "浏览 MemeSee 的 大厅",
    expectedCanonicalPath: "/",
    label,
  });
}

function assertSubPostFloor(window, label, options = {}) {
  const expectGuestPrompt = options.expectGuestPrompt !== false;
  assertElement(window, `#sub-post-floor-${sampleSubPost.id}`, `${label}: target floor`);
  assertTextIncludes(window, ".sub-post-author-name", sampleSubPost.authorUsername, `${label}: author`);
  assertTextIncludes(window, ".sub-post-text", sampleSubPost.content, `${label}: content`);
  assertButtonReady(window, ".main-sub-post .sub-post-action-btn[title='点赞']", `${label}: like button`);
  assertButtonReady(window, ".main-sub-post .more-btn", `${label}: more button`);
  assertButtonReady(window, ".main-sub-post .sub-post-launch-btn", `${label}: reply button`);
  if (expectGuestPrompt) {
    assertTextIncludes(window, ".sub-post-guest-discussion", "登录后可以回复", `${label}: guest discussion prompt`);
    assertButtonReady(window, ".sub-post-guest-discussion-login", `${label}: guest discussion login`);
  }
}

async function assertTargetSubPostLocated(window, options = {}) {
  assertPostDetailMobileActions(window, options);
  await assertPostDetailMetadata(window, {
    expectedTitleText: `${samplePost.title} · @${sampleSubPost.authorUsername} 的子帖`,
    expectedDescriptionText: sampleSubPost.content,
    expectedCanonicalPath: `/posts/${samplePost.id}?subPost=${sampleSubPost.id}`,
    label: "target sub-post metadata",
  });
  assertSubPostFloor(window, "target sub-post deep link", options);
  assertTextIncludes(window, ".detail-interact-btn-share", "分享定位", "target sub-post share label");

  await waitForCondition(
    "target sub-post deep link: target floor was not marked as current location",
    () => {
      const targetFloor = window.document.querySelector(`#sub-post-floor-${sampleSubPost.id}`);
      return targetFloor?.classList.contains("is-target-location")
        && targetFloor.getAttribute("aria-current") === "location";
    },
    window,
  );

  const targetFloor = assertElement(
    window,
    `#sub-post-floor-${sampleSubPost.id}`,
    "target sub-post located floor",
  );
  if (!targetFloor.classList.contains("is-target-location")) {
    throw new Error("target sub-post deep link: target floor is not visually marked");
  }
  if (targetFloor.getAttribute("aria-current") !== "location") {
    throw new Error("target sub-post deep link: target floor is not marked as current location");
  }
  assertTextIncludes(
    window,
    `#sub-post-floor-${sampleSubPost.id} .sub-post-target-floor-badge`,
    "定位",
    "target sub-post located floor marker",
  );
}

async function assertTargetBranchSubPostLocated(window, options = {}) {
  assertPostDetailMobileActions(window, options);
  await assertPostDetailMetadata(window, {
    expectedTitleText: `${samplePost.title} · @${sampleBranchSubPost.authorUsername} 的子帖`,
    expectedDescriptionText: sampleBranchSubPost.content,
    expectedCanonicalPath: `/posts/${samplePost.id}?subPost=${sampleBranchSubPost.id}`,
    label: "target branch sub-post metadata",
  });
  assertSubPostFloor(window, "target branch sub-post deep link parent", options);

  await waitForCondition(
    "target branch sub-post deep link: branch floor was not marked as current location",
    () => {
      const branchFloor = window.document.querySelector(`#sub-post-floor-${sampleBranchSubPost.id}`);
      return branchFloor?.classList.contains("sub-post-branch-item")
        && branchFloor.classList.contains("is-target-location")
        && branchFloor.getAttribute("aria-current") === "location";
    },
    window,
  );

  const branchFloor = assertElement(
    window,
    `#sub-post-floor-${sampleBranchSubPost.id}`,
    "target branch sub-post located floor",
  );
  if (!branchFloor.classList.contains("sub-post-branch-item")) {
    throw new Error("target branch sub-post deep link: target floor is not a branch reply");
  }
  if (!branchFloor.classList.contains("is-target-location")) {
    throw new Error("target branch sub-post deep link: branch target floor is not visually marked");
  }
  if (branchFloor.getAttribute("aria-current") !== "location") {
    throw new Error("target branch sub-post deep link: branch target floor is not marked as current location");
  }
  assertTextIncludes(
    window,
    `#sub-post-floor-${sampleBranchSubPost.id} .sub-post-target-floor-badge`,
    "定位",
    "target branch sub-post located floor marker",
  );
  assertTextIncludes(
    window,
    `#sub-post-floor-${sampleBranchSubPost.id}`,
    sampleBranchSubPost.content,
    "target branch sub-post content",
  );
}

async function assertLegacyQueryPostDetail(window) {
  assertPostDetailMobileActions(window);
  await assertPostDetailMetadata(window, {
    label: "legacy query post detail metadata",
  });
  assertSubPostFloor(window, "legacy query post detail");
  assertTextIncludes(window, ".detail-interact-btn-share", "分享", "legacy query share label");
  if (window.document.querySelector(".detail-interact-btn-share.is-target-share")) {
    throw new Error("legacy query post detail: share button unexpectedly targets a sub-post");
  }
  await assertParentPostShareCopiesParentPermalink(
    window,
    "legacy query post detail share interaction",
  );
}

async function assertLegacyBranchSubPostQuery(window) {
  await assertTargetBranchSubPostLocated(window);
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const expectedLegacyPath = `/?post=${samplePost.id}&subPost=${sampleBranchSubPost.id}`;
  if (currentPath !== expectedLegacyPath) {
    throw new Error(`legacy branch sub-post query: expected browser URL "${expectedLegacyPath}", actual="${currentPath}"`);
  }
  const canonicalHref = readHeadAttribute(window, 'link[rel="canonical"]', "href");
  const expectedCanonical = `${TEST_ORIGIN}/posts/${samplePost.id}?subPost=${sampleBranchSubPost.id}`;
  if (canonicalHref !== expectedCanonical) {
    throw new Error(`legacy branch sub-post query: expected canonical "${expectedCanonical}", actual="${canonicalHref}"`);
  }
}

async function assertInvalidTargetSubPostQueryIgnored(window) {
  assertPostDetailMobileActions(window);
  await assertPostDetailMetadata(window, {
    label: "invalid target sub-post query metadata",
  });
  assertSubPostFloor(window, "invalid target sub-post query post detail");
  assertTextIncludes(window, ".detail-interact-btn-share", "分享", "invalid target sub-post query share label");
  if (window.document.querySelector(".detail-interact-btn-share")?.textContent.includes("定位")) {
    throw new Error("invalid target sub-post query: share action unexpectedly targets a sub-post");
  }
  if (window.document.querySelector(".sub-post-target-state")) {
    throw new Error("invalid target sub-post query: target status should not be shown");
  }
  if (window.document.querySelector(".is-target-location")) {
    throw new Error("invalid target sub-post query: no floor should be marked as target location");
  }
}

async function assertMissingTargetSubPostDeepLink(window) {
  assertPostDetailMobileActions(window);
  await assertPostDetailMetadata(window, {
    expectedTitleText: samplePost.title,
    expectedDescriptionText: samplePost.content,
    expectedCanonicalPath: `/posts/${samplePost.id}`,
    label: "missing target sub-post metadata",
  });
  assertSubPostFloor(window, "missing target sub-post parent detail");
  assertTextIncludes(
    window,
    ".sub-post-target-state",
    "未找到这条子帖",
    "missing target sub-post status",
  );
  assertTextIncludes(
    window,
    ".sub-post-target-state",
    "主帖内容仍可继续阅读",
    "missing target sub-post fallback copy",
  );
  assertTextIncludes(window, ".detail-interact-btn-share", "分享", "missing target sub-post share label");
  if (window.document.querySelector(".detail-interact-btn-share")?.textContent.includes("定位")) {
    throw new Error("missing target sub-post: share action unexpectedly targets the missing sub-post");
  }
  if (window.document.querySelector(".is-target-location")) {
    throw new Error("missing target sub-post: no floor should be marked as target location");
  }
}

async function assertPostDetailMoreMenu(window) {
  clickSelector(window, ".detail-interact-btn-more", "post detail more menu");
  await waitForCondition(
    "post detail more menu: menu did not open",
    () => Boolean(window.document.querySelector(".detail-post-more-menu")),
    window,
  );
  assertButtonReady(window, ".detail-interact-btn-favorite", "post detail more favorite action");
  assertButtonReady(window, ".detail-interact-btn-report", "post detail more report action");
}

function assertComposerGuestGate(window) {
  assertTextIncludes(window, ".feed-status-card", "请先登录后发布主帖", "composer guest gate title");
  assertTextIncludes(window, ".feed-status-card", "上传图片", "composer guest gate description");
}

function assertLegacyComposeQuery(window) {
  assertComposerGuestGate(window);
  if (window.location.pathname !== "/" || window.location.search !== "?compose=1") {
    throw new Error(
      `legacy compose query: expected original browser URL to remain "/?compose=1", actual="${window.location.pathname}${window.location.search}"`,
    );
  }
  const canonicalHref = readHeadAttribute(window, 'link[rel="canonical"]', "href");
  if (canonicalHref !== `${TEST_ORIGIN}/compose`) {
    throw new Error(`legacy compose query: expected canonical "${TEST_ORIGIN}/compose", actual="${canonicalHref}"`);
  }
}

function assertSignedInComposerControls(window) {
  assertTextIncludes(window, ".composer-page", sampleAuthenticatedUser.username, "signed-in composer author");
  assertElement(window, ".compose-title-input", "signed-in composer title input");
  assertTextIncludes(window, ".compose-taxonomy-community", "选择社区", "signed-in composer community selector");
  assertElement(window, ".compose-content-input", "signed-in composer content input");
  assertTextIncludes(window, ".compose-mode-switch", "长文", "signed-in composer mode switch");
  assertTextIncludes(window, ".compose-mode-switch", "图文", "signed-in composer mode switch");
  assertTextIncludes(window, ".compose-markdown-guide-toggle", "Markdown", "signed-in composer markdown guide");
  assertTextIncludes(window, ".composer-submit", "确认发布", "signed-in composer submit button");
  assertButtonReady(window, ".composer-submit", "signed-in composer submit button");
}

async function assertSignedInComposerInteractions(window) {
  clickSelector(window, ".compose-taxonomy-community", "signed-in composer community selector");
  await waitForCondition(
    "signed-in composer community selector: menu did not open",
    () => Boolean(window.document.querySelector(".compose-community-menu.open")),
    window,
  );
  clickSelector(window, ".compose-community-option", "signed-in composer community option");
  await waitForCondition(
    "signed-in composer community selector: community was not selected",
    () => window.document.querySelector(".compose-taxonomy-community")?.textContent.includes("日常闲聊"),
    window,
  );
  const uploadInput = assertElement(
    window,
    ".compose-upload-btn input[type='file']",
    "signed-in composer upload input",
  );
  if (uploadInput.disabled) {
    throw new Error("signed-in composer upload input stayed disabled after selecting a community");
  }

  clickSelector(window, ".compose-markdown-guide-toggle", "signed-in composer markdown guide");
  await waitForCondition(
    "signed-in composer markdown guide: guide did not open",
    () => Boolean(window.document.querySelector(".compose-markdown-guide")),
    window,
  );
  assertTextIncludes(window, ".compose-markdown-guide", "标题", "signed-in composer markdown guide contents");

  clickSelector(window, ".compose-content-tab:nth-of-type(2)", "signed-in composer preview tab");
  await waitForCondition(
    "signed-in composer preview tab: preview did not open",
    () => Boolean(window.document.querySelector(".compose-markdown-preview")),
    window,
  );
  assertTextIncludes(window, ".compose-markdown-preview", "暂无预览内容", "signed-in composer empty preview");

  const uploadFile = new window.File(["render-smoke-image"], "render-smoke.png", { type: "image/png" });
  Object.defineProperty(uploadInput, "files", {
    value: [uploadFile],
    configurable: true,
  });
  uploadInput.dispatchEvent(new window.Event("change", { bubbles: true }));
  await waitForCondition(
    "signed-in composer upload: submit disabled reason did not appear",
    () => window.document.querySelector(".composer-submit-disabled-reason")?.textContent.includes("图片仍在上传"),
    window,
  );
  const disabledSubmit = assertElement(
    window,
    ".composer-submit",
    "signed-in composer upload disabled submit",
  );
  if (!disabledSubmit.disabled) {
    throw new Error("signed-in composer upload: submit stayed enabled while upload was running");
  }
  if (disabledSubmit.getAttribute("aria-describedby") !== "composer-submit-disabled-reason") {
    throw new Error("signed-in composer upload: submit disabled reason was not linked by aria-describedby");
  }
  await waitForCondition(
    "signed-in composer upload: upload status did not render",
    () => window.document.querySelector(".composer-upload-status")?.textContent.includes("上传中"),
    window,
  );

  await waitForCondition(
    "signed-in composer upload: upload success did not render",
    () => window.document.querySelector(".composer-upload-status")?.textContent.includes("上传 1 张图片"),
    window,
  );
  await waitForCondition(
    "signed-in composer upload: submit did not recover after upload",
    () => {
      const submit = window.document.querySelector(".composer-submit");
      return submit && !submit.disabled && !window.document.querySelector(".composer-submit-disabled-reason");
    },
    window,
  );
}

async function assertSignedInComposerRetryMediaUpload(window) {
  clickSelector(window, ".compose-taxonomy-community", "signed-in composer retry community selector");
  await waitForCondition(
    "signed-in composer retry community selector: menu did not open",
    () => Boolean(window.document.querySelector(".compose-community-menu.open")),
    window,
  );
  clickSelector(window, ".compose-community-option", "signed-in composer retry community option");
  await waitForCondition(
    "signed-in composer retry community selector: community was not selected",
    () => window.document.querySelector(".compose-taxonomy-community")?.textContent.includes("日常闲聊"),
    window,
  );

  const titleInput = assertElement(
    window,
    ".compose-title-input",
    "signed-in composer retry title input",
  );
  const contentInput = assertElement(
    window,
    ".compose-content-input",
    "signed-in composer retry content input",
  );
  setFormControlValue(
    window,
    titleInput,
    sampleCreatedRetryMainPostTitle,
    "signed-in composer retry title input",
  );
  setFormControlValue(
    window,
    contentInput,
    sampleCreatedRetryMainPostContent,
    "signed-in composer retry content input",
  );

  const uploadInput = assertElement(
    window,
    ".compose-upload-btn input[type='file']",
    "signed-in composer retry upload input",
  );
  const uploadFile = new window.File(["render-smoke-composer-retry-image"], "composer-retry-smoke.png", {
    type: "image/png",
  });
  Object.defineProperty(uploadInput, "files", {
    value: [uploadFile],
    configurable: true,
  });
  uploadInput.dispatchEvent(new window.Event("change", { bubbles: true }));

  await waitForCondition(
    "signed-in composer retry upload: failed status did not render",
    () => window.document.querySelector(".composer-upload-status")?.textContent.includes("失败 1 张"),
    window,
  );
  if (titleInput.value !== sampleCreatedRetryMainPostTitle) {
    throw new Error("signed-in composer retry upload: title draft was not preserved after upload failure");
  }
  if (contentInput.value !== sampleCreatedRetryMainPostContent) {
    throw new Error("signed-in composer retry upload: content draft was not preserved after upload failure");
  }
  assertButtonReady(
    window,
    ".composer-upload-retry-btn",
    "signed-in composer retry upload retry button",
  );
  if (contentInput.value.includes(sampleRetryMediaAsset.publicId)) {
    throw new Error("signed-in composer retry upload: failed upload unexpectedly inserted markdown media");
  }

  clickSelector(window, ".composer-upload-retry-btn", "signed-in composer retry upload retry action");
  await waitForCondition(
    "signed-in composer retry upload: retry success status did not render",
    () => window.document.querySelector(".composer-upload-status")?.textContent.includes("上传 1 张图片"),
    window,
  );
  await waitForCondition(
    "signed-in composer retry upload: markdown media was not inserted",
    () => window.document.querySelector(".compose-content-input")?.value.includes(sampleRetryMediaAsset.publicId),
    window,
  );
  if (window.document.querySelector(".composer-upload-retry-btn")) {
    throw new Error("signed-in composer retry upload: retry button stayed visible after retry success");
  }

  const composerForm = assertElement(window, "#composer-form", "signed-in composer retry submit form");
  composerForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await waitForCondition(
    "signed-in composer retry submit: composer did not navigate home",
    () => window.location.pathname === "/" && !window.document.querySelector(".composer-page"),
    window,
  );
  await assertHomeMetadata(window, "signed-in composer retry submit home metadata");
  await waitForCondition(
    "signed-in composer retry submit: created post did not render in feed",
    () => window.document.querySelector(".post-card")?.textContent.includes(sampleCreatedRetryMainPostTitle),
    window,
  );
  const createdPostCard = assertElementByText(
    window,
    ".post-card",
    sampleCreatedRetryMainPostTitle,
    "signed-in composer retry created post card",
  );
  if (!createdPostCard.textContent.includes(sampleAuthenticatedUser.username)) {
    throw new Error("signed-in composer retry submit: created post author did not render");
  }
  if (!createdPostCard.querySelector(".post-media-grid")) {
    throw new Error("signed-in composer retry submit: created post media grid did not render");
  }
  if (!createdPostCard.querySelector(".post-media-image")) {
    throw new Error("signed-in composer retry submit: created post media image did not render");
  }
  assertReadyMediaDidNotFail(createdPostCard, "signed-in composer retry submit created post media");
}

async function assertSignedInSubPostComposerMediaUpload(window) {
  clickSelector(window, ".detail-interact-btn-sub-post", "signed-in sub-post composer open");
  await waitForCondition(
    "signed-in sub-post composer: form did not open",
    () => Boolean(window.document.querySelector(".sub-post-pop-form")),
    window,
  );
  const uploadInput = assertElement(
    window,
    ".sub-post-pop-form .sub-post-media-upload input[type='file']",
    "signed-in sub-post media upload input",
  );
  if (uploadInput.disabled) {
    throw new Error("signed-in sub-post media upload input is disabled");
  }

  const uploadFile = new window.File(["render-smoke-sub-post-image"], "sub-post-smoke.png", {
    type: "image/png",
  });
  Object.defineProperty(uploadInput, "files", {
    value: [uploadFile],
    configurable: true,
  });
  uploadInput.dispatchEvent(new window.Event("change", { bubbles: true }));

  await waitForCondition(
    "signed-in sub-post upload: uploading status did not render",
    () => window.document.querySelector(".sub-post-pop-form .sub-post-media-upload-status")
      ?.textContent.includes("图片上传中"),
    window,
  );
  const submitButton = assertElement(
    window,
    ".sub-post-pop-form button[type='submit']",
    "signed-in sub-post submit while upload is running",
  );
  if (!submitButton.disabled) {
    throw new Error("signed-in sub-post submit stayed enabled while media upload was running");
  }
  if (!submitButton.textContent.includes("上传中")) {
    throw new Error("signed-in sub-post submit did not expose uploading copy");
  }
  if (submitButton.getAttribute("aria-describedby") !== "top-sub-post-media-upload-status") {
    throw new Error("signed-in sub-post submit was not linked to the upload status");
  }

  await waitForCondition(
    "signed-in sub-post upload: success status did not render",
    () => window.document.querySelector(".sub-post-pop-form .sub-post-media-upload-status")
      ?.textContent.includes("上传 1 张图片"),
    window,
  );
  await waitForCondition(
    "signed-in sub-post upload: submit did not recover",
    () => {
      const recoveredSubmit = window.document.querySelector(".sub-post-pop-form button[type='submit']");
      return recoveredSubmit && !recoveredSubmit.disabled && recoveredSubmit.textContent.includes("发布子帖");
    },
    window,
  );
}

async function assertSignedInProcessingSubPostMediaRefresh(window) {
  clickSelector(window, ".detail-interact-btn-sub-post", "signed-in processing media sub-post composer open");
  await waitForCondition(
    "signed-in processing media sub-post composer: form did not open",
    () => Boolean(window.document.querySelector(".sub-post-pop-form")),
    window,
  );
  const uploadInput = assertElement(
    window,
    ".sub-post-pop-form .sub-post-media-upload input[type='file']",
    "signed-in processing media upload input",
  );
  const uploadFile = new window.File(["render-smoke-processing-image"], "processing-smoke.png", {
    type: "image/png",
  });
  Object.defineProperty(uploadInput, "files", {
    value: [uploadFile],
    configurable: true,
  });
  uploadInput.dispatchEvent(new window.Event("change", { bubbles: true }));

  await waitForCondition(
    "signed-in processing media upload: processing placeholder did not render",
    () => window.document.querySelector(".sub-post-pop-form .sub-post-media-placeholder")
      ?.textContent.includes("图片处理中"),
    window,
  );
  assertButtonReady(
    window,
    ".sub-post-pop-form .sub-post-media-refresh",
    "signed-in processing media refresh button",
  );
  assertTextIncludes(
    window,
    ".sub-post-pop-form .sub-post-media-upload-status",
    "上传 1 张图片",
    "signed-in processing media upload status",
  );

  clickSelector(
    window,
    ".sub-post-pop-form .sub-post-media-refresh",
    "signed-in processing media refresh",
  );
  await waitForCondition(
    "signed-in processing media refresh: ready image did not render",
    () => Boolean(window.document.querySelector(".sub-post-pop-form .sub-post-media-image")),
    window,
  );
  if (window.document.querySelector(".sub-post-pop-form .sub-post-media-refresh")) {
    throw new Error("signed-in processing media refresh: refresh button stayed visible after media became ready");
  }

  const topForm = assertElement(window, ".sub-post-pop-form", "signed-in processing media submit form");
  setFormControlValue(
    window,
    assertElement(
      window,
      ".sub-post-pop-form textarea",
      "signed-in processing media textarea",
    ),
    sampleCreatedProcessingSubPostContent,
    "signed-in processing media textarea",
  );
  topForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

  await waitForCondition(
    "signed-in processing media submit: composer did not close",
    () => !window.document.querySelector(".sub-post-pop-form"),
    window,
  );
  await waitForCondition(
    "signed-in processing media submit: created floor did not render",
    () => window.document.querySelector(`#sub-post-floor-${sampleCreatedProcessingSubPost.id}`)
      ?.textContent.includes(sampleCreatedProcessingSubPostContent),
    window,
  );
  const createdFloor = assertElement(
    window,
    `#sub-post-floor-${sampleCreatedProcessingSubPost.id}`,
    "signed-in processing media created floor",
  );
  if (createdFloor.classList.contains("sub-post-branch-item")) {
    throw new Error("signed-in processing media submit: created reply was unexpectedly rendered as a branch");
  }
  assertElement(
    window,
    `#sub-post-floor-${sampleCreatedProcessingSubPost.id} .sub-post-media-grid`,
    "signed-in processing media created floor media",
  );
  assertReadyMediaDidNotFail(createdFloor, "signed-in processing media created floor media");
  assertTextIncludes(
    window,
    `#sub-post-floor-${sampleCreatedProcessingSubPost.id}`,
    sampleAuthenticatedUser.username,
    "signed-in processing media created floor author",
  );
}

async function assertSignedInRetrySubPostMediaUpload(window) {
  clickSelector(window, ".detail-interact-btn-sub-post", "signed-in retry media sub-post composer open");
  await waitForCondition(
    "signed-in retry media sub-post composer: form did not open",
    () => Boolean(window.document.querySelector(".sub-post-pop-form")),
    window,
  );
  const topForm = assertElement(window, ".sub-post-pop-form", "signed-in retry media submit form");
  const textarea = assertElement(
    window,
    ".sub-post-pop-form textarea",
    "signed-in retry media textarea",
  );
  setFormControlValue(
    window,
    textarea,
    sampleCreatedRetrySubPostContent,
    "signed-in retry media textarea",
  );
  const uploadInput = assertElement(
    window,
    ".sub-post-pop-form .sub-post-media-upload input[type='file']",
    "signed-in retry media upload input",
  );
  const uploadFile = new window.File(["render-smoke-retry-image"], "retry-smoke.png", {
    type: "image/png",
  });
  Object.defineProperty(uploadInput, "files", {
    value: [uploadFile],
    configurable: true,
  });
  uploadInput.dispatchEvent(new window.Event("change", { bubbles: true }));

  await waitForCondition(
    "signed-in retry media upload: failed status did not render",
    () => window.document.querySelector(".sub-post-pop-form .sub-post-media-upload-status")
      ?.textContent.includes("失败 1 张"),
    window,
  );
  if (textarea.value !== sampleCreatedRetrySubPostContent) {
    throw new Error("signed-in retry media upload: text draft was not preserved after upload failure");
  }
  assertButtonReady(
    window,
    ".sub-post-pop-form .sub-post-media-upload-retry",
    "signed-in retry media retry button",
  );
  if (window.document.querySelector(".sub-post-pop-form .sub-post-media-draft-grid")) {
    throw new Error("signed-in retry media upload: failed upload unexpectedly added a draft media grid");
  }

  clickSelector(
    window,
    ".sub-post-pop-form .sub-post-media-upload-retry",
    "signed-in retry media retry upload",
  );
  await waitForCondition(
    "signed-in retry media upload: retry success status did not render",
    () => window.document.querySelector(".sub-post-pop-form .sub-post-media-upload-status")
      ?.textContent.includes("上传 1 张图片"),
    window,
  );
  await waitForCondition(
    "signed-in retry media upload: ready image did not render",
    () => Boolean(window.document.querySelector(".sub-post-pop-form .sub-post-media-image")),
    window,
  );
  if (window.document.querySelector(".sub-post-pop-form .sub-post-media-upload-retry")) {
    throw new Error("signed-in retry media upload: retry button stayed visible after retry success");
  }

  topForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await waitForCondition(
    "signed-in retry media submit: composer did not close",
    () => !window.document.querySelector(".sub-post-pop-form"),
    window,
  );
  await waitForCondition(
    "signed-in retry media submit: created floor did not render",
    () => window.document.querySelector(`#sub-post-floor-${sampleCreatedRetrySubPost.id}`)
      ?.textContent.includes(sampleCreatedRetrySubPostContent),
    window,
  );
  const createdFloor = assertElement(
    window,
    `#sub-post-floor-${sampleCreatedRetrySubPost.id}`,
    "signed-in retry media created floor",
  );
  if (createdFloor.classList.contains("sub-post-branch-item")) {
    throw new Error("signed-in retry media submit: created reply was unexpectedly rendered as a branch");
  }
  assertElement(
    window,
    `#sub-post-floor-${sampleCreatedRetrySubPost.id} .sub-post-media-grid`,
    "signed-in retry media created floor media",
  );
  assertReadyMediaDidNotFail(createdFloor, "signed-in retry media created floor media");
  assertTextIncludes(
    window,
    `#sub-post-floor-${sampleCreatedRetrySubPost.id}`,
    sampleAuthenticatedUser.username,
    "signed-in retry media created floor author",
  );
}

async function assertSignedInNestedSubPostComposerMediaUpload(window) {
  clickSelector(
    window,
    ".main-sub-post .sub-post-launch-btn",
    "signed-in nested sub-post composer open",
  );
  await waitForCondition(
    "signed-in nested sub-post composer: inline form did not open",
    () => Boolean(window.document.querySelector(".main-sub-post .inline-sub-post-form")),
    window,
  );
  const uploadInput = assertElement(
    window,
    ".main-sub-post .inline-sub-post-form .sub-post-media-upload input[type='file']",
    "signed-in nested sub-post media upload input",
  );
  if (uploadInput.disabled) {
    throw new Error("signed-in nested sub-post media upload input is disabled");
  }

  const uploadFile = new window.File(
    ["render-smoke-nested-sub-post-image"],
    "nested-sub-post-smoke.png",
    { type: "image/png" },
  );
  Object.defineProperty(uploadInput, "files", {
    value: [uploadFile],
    configurable: true,
  });
  uploadInput.dispatchEvent(new window.Event("change", { bubbles: true }));

  await waitForCondition(
    "signed-in nested sub-post upload: uploading status did not render",
    () => window.document.querySelector(".main-sub-post .inline-sub-post-form .sub-post-media-upload-status")
      ?.textContent.includes("图片上传中"),
    window,
  );
  const submitButton = assertElement(
    window,
    ".main-sub-post .inline-sub-post-form button[type='submit']",
    "signed-in nested sub-post submit while upload is running",
  );
  if (!submitButton.disabled) {
    throw new Error("signed-in nested sub-post submit stayed enabled while media upload was running");
  }
  if (!submitButton.textContent.includes("上传中")) {
    throw new Error("signed-in nested sub-post submit did not expose uploading copy");
  }
  if (submitButton.getAttribute("aria-describedby") !== "inline-sub-post-media-upload-status") {
    throw new Error("signed-in nested sub-post submit was not linked to the upload status");
  }

  await waitForCondition(
    "signed-in nested sub-post upload: success status did not render",
    () => window.document.querySelector(".main-sub-post .inline-sub-post-form .sub-post-media-upload-status")
      ?.textContent.includes("上传 1 张图片"),
    window,
  );
  await waitForCondition(
    "signed-in nested sub-post upload: submit did not recover",
    () => {
      const recoveredSubmit = window.document.querySelector(
        ".main-sub-post .inline-sub-post-form button[type='submit']",
      );
      return recoveredSubmit && !recoveredSubmit.disabled && recoveredSubmit.textContent.includes("发布子帖");
    },
    window,
  );

  const inlineForm = assertElement(
    window,
    ".main-sub-post .inline-sub-post-form",
    "signed-in nested sub-post submit form",
  );
  setFormControlValue(
    window,
    assertElement(
      window,
      ".main-sub-post .inline-sub-post-form textarea",
      "signed-in nested sub-post textarea",
    ),
    sampleCreatedNestedSubPostContent,
    "signed-in nested sub-post textarea",
  );
  inlineForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

  await waitForCondition(
    "signed-in nested sub-post submit: composer did not close",
    () => !window.document.querySelector(".main-sub-post .inline-sub-post-form"),
    window,
  );
  await waitForCondition(
    "signed-in nested sub-post submit: created branch did not render",
    () => window.document.querySelector(`#sub-post-floor-${sampleCreatedNestedSubPost.id}`)
      ?.textContent.includes(sampleCreatedNestedSubPostContent),
    window,
  );
  const createdBranch = assertElement(
    window,
    `#sub-post-floor-${sampleCreatedNestedSubPost.id}`,
    "signed-in nested sub-post created branch",
  );
  if (!createdBranch.classList.contains("sub-post-branch-item")) {
    throw new Error("signed-in nested sub-post submit: created reply was not rendered as a branch");
  }
  assertTextIncludes(
    window,
    `#sub-post-floor-${sampleCreatedNestedSubPost.id}`,
    sampleAuthenticatedUser.username,
    "signed-in nested sub-post created branch author",
  );
  assertElement(
    window,
    `#sub-post-floor-${sampleCreatedNestedSubPost.id} .sub-post-media-grid`,
    "signed-in nested sub-post created branch media",
  );
  assertReadyMediaDidNotFail(createdBranch, "signed-in nested sub-post created branch media");
}

async function assertSignedInSubPostDelete(window) {
  await waitForCondition(
    "signed-in sub-post delete: deletable sub-post did not render",
    () => window.document.querySelector(`#sub-post-floor-${sampleDeletableSubPost.id}`)
      ?.textContent.includes(sampleDeletableSubPostContent),
    window,
  );

  clickSelector(
    window,
    `#sub-post-floor-${sampleDeletableSubPost.id} .sub-post-action-btn.more-btn`,
    "signed-in sub-post delete more menu open",
  );
  await waitForCondition(
    "signed-in sub-post delete: delete menu item did not render",
    () => Boolean(window.document.querySelector(".sub-post-more-menu [aria-label='删除子帖']")),
    window,
  );
  clickSelector(
    window,
    ".sub-post-more-menu [aria-label='删除子帖']",
    "signed-in sub-post delete cancel dialog open",
  );
  await waitForCondition(
    "signed-in sub-post delete: confirmation dialog did not open",
    () => window.document.querySelector(".confirm-dialog-card")?.textContent.includes("删除子帖"),
    window,
  );
  clickElement(
    window,
    assertElementByText(window, ".confirm-dialog-btn", "取消", "signed-in sub-post delete cancel"),
  );
  await waitForCondition(
    "signed-in sub-post delete: cancel did not close confirmation dialog",
    () => !window.document.querySelector(".confirm-dialog-card"),
    window,
  );
  if (globalThis.__renderSmokeDeletedSubPost) {
    throw new Error("signed-in sub-post delete: cancel unexpectedly sent delete request");
  }
  assertTextIncludes(
    window,
    `#sub-post-floor-${sampleDeletableSubPost.id}`,
    sampleDeletableSubPostContent,
    "signed-in sub-post delete cancel kept sub-post",
  );

  clickSelector(
    window,
    `#sub-post-floor-${sampleDeletableSubPost.id} .sub-post-action-btn.more-btn`,
    "signed-in sub-post delete confirm menu open",
  );
  await waitForCondition(
    "signed-in sub-post delete confirm: delete menu item did not render",
    () => Boolean(window.document.querySelector(".sub-post-more-menu [aria-label='删除子帖']")),
    window,
  );
  clickSelector(
    window,
    ".sub-post-more-menu [aria-label='删除子帖']",
    "signed-in sub-post delete confirm dialog open",
  );
  await waitForCondition(
    "signed-in sub-post delete confirm: confirmation dialog did not open",
    () => window.document.querySelector(".confirm-dialog-card")?.textContent.includes("删除子帖"),
    window,
  );
  clickElement(
    window,
    assertElementByText(window, ".confirm-dialog-btn.primary", "删除", "signed-in sub-post delete confirm"),
  );
  await waitForCondition(
    "signed-in sub-post delete confirm: delete request was not sent",
    () => Boolean(globalThis.__renderSmokeDeletedSubPost),
    window,
    3000,
  );
  await waitForCondition(
    "signed-in sub-post delete confirm: deleted sub-post still rendered",
    () => !window.document.querySelector(`#sub-post-floor-${sampleDeletableSubPost.id}`),
    window,
    3000,
  );
  if (window.document.querySelector(".sub-post-list")?.textContent.includes(sampleDeletableSubPostContent)) {
    throw new Error("signed-in sub-post delete confirm: deleted sub-post content still appears in the list");
  }
  assertTextIncludes(
    window,
    ".forum-app",
    "子帖已删除",
    "signed-in sub-post delete success message",
  );
}

function assertSignedInProfileEntry(window) {
  assertButtonReady(window, ".top-profile-mini-btn", "signed-in profile entry");
  assertTextIncludes(window, ".top-create-btn", "发布主帖", "signed-in create entry");
}

async function assertSignedInNotificationEntry(window) {
  assertSignedInProfileEntry(window);
  await waitForCondition(
    "signed-in notification entry: unread badge did not appear",
    () => window.document.querySelector(".top-profile-mini-badge")?.textContent.includes("1"),
    window,
  );
}

async function assertSignedInFallbackNotificationEntry(window) {
  assertSignedInProfileEntry(window);
  await waitForCondition(
    "signed-in fallback notification entry: unread badge did not appear",
    () => window.document.querySelector(".top-profile-mini-badge")?.textContent.includes("2"),
    window,
  );
}

async function assertSignedInProfileLibraryNavigation(window) {
  clickSelector(window, ".top-profile-mini-btn", "signed-in profile entry");
  await waitForCondition(
    "signed-in profile entry: profile center did not open",
    () => Boolean(window.document.querySelector(".profile-center-card")),
    window,
  );
  assertTextIncludes(window, ".profile-overview-header", sampleAuthenticatedUser.username, "signed-in profile identity");
  assertTextIncludes(window, ".profile-library-grid", "点赞", "signed-in profile library entries");
  assertTextIncludes(window, ".profile-library-grid", "收藏", "signed-in profile library entries");
  assertTextIncludes(window, ".profile-library-grid", "发布", "signed-in profile library entries");

  clickSelector(window, ".profile-library-entry", "signed-in profile liked library entry");
  await waitForCondition(
    "signed-in profile liked library: page did not open",
    () => window.document.querySelector(".profile-library-page-head")?.textContent.includes("点赞"),
    window,
  );
  assertTextIncludes(window, ".profile-library-page-head", "共 2 条", "signed-in liked library count");
  assertTextIncludes(window, ".profile-library-post-flow", sampleProfilePost.title, "signed-in liked library post");
  assertButtonReady(window, ".profile-library-post-flow .post-card-share-btn", "signed-in liked library share button");
  assertTextIncludes(window, ".profile-sub-post-preview", "相关子帖", "signed-in liked library related sub-posts");
  assertTextIncludes(window, ".profile-sub-post-preview", sampleSubPost.content, "signed-in liked library sub-post preview");
  await assertProfileLibraryPostShareDoesNotNavigate(window);

  clickSelector(window, ".profile-sub-post-preview-row", "signed-in liked library sub-post preview open");
  await waitForCondition(
    "signed-in profile liked library: target sub-post detail did not open",
    () => window.location.pathname === `/posts/${sampleProfilePost.id}`
      && window.location.search.includes(`subPost=${sampleSubPost.id}`)
      && Boolean(window.document.querySelector(".post-detail-paper")),
    window,
  );
  await waitForCondition(
    "signed-in profile liked library: target sub-post detail content did not load",
    () => window.document.querySelector(".post-detail-paper")?.textContent.includes(samplePost.title),
    window,
  );
  await assertTargetSubPostLocated(window, { expectGuestPrompt: false });
  await assertTargetSubPostShareCopiesPermalink({
    window,
    subPost: sampleSubPost,
    label: "signed-in liked library sub-post share interaction",
  });

  window.history.back();
  await waitForCondition(
    "signed-in profile liked library: did not return to library page after target sub-post",
    () => window.document.querySelector(".profile-library-page-head")?.textContent.includes("点赞"),
    window,
  );

  clickSelector(window, ".profile-library-post-flow .post-open-cover", "signed-in liked library post open");
  await waitForCondition(
    "signed-in profile liked library: post detail did not open",
    () => window.location.pathname === `/posts/${sampleProfilePost.id}`
      && window.document.querySelector(".post-detail-paper")?.textContent.includes(samplePost.title),
    window,
  );
  assertTextIncludes(window, ".post-detail-paper", samplePost.title, "signed-in profile detail route");
  await assertPostDetailMetadata(window, {
    label: "signed-in profile library detail metadata",
  });
  await assertParentPostShareCopiesParentPermalink(
    window,
    "signed-in profile library detail share interaction",
  );
}

async function assertSignedInFavoriteLibraryShare(window) {
  clickSelector(window, ".top-profile-mini-btn", "signed-in favorite profile entry");
  await waitForCondition(
    "signed-in favorite profile entry: profile center did not open",
    () => Boolean(window.document.querySelector(".profile-center-card")),
    window,
  );
  const favoriteEntry = assertElementByText(
    window,
    ".profile-library-entry",
    "收藏",
    "signed-in favorite library entry",
  );
  clickElement(window, favoriteEntry);
  await waitForCondition(
    "signed-in favorite library: page did not open",
    () => window.document.querySelector(".profile-library-page-head")?.textContent.includes("收藏"),
    window,
  );
  assertTextIncludes(window, ".profile-library-page-head", "共 1 条", "signed-in favorite library count");
  assertTextIncludes(window, ".profile-library-post-flow", sampleProfilePost.title, "signed-in favorite library post");
  assertButtonReady(window, ".profile-library-post-flow .post-card-share-btn", "signed-in favorite library share button");
  await assertProfileLibraryPostShareDoesNotNavigate(
    window,
    "signed-in favorite library share interaction",
  );
}

async function assertSignedInPublishedLibraryManagement(window) {
  clickSelector(window, ".top-profile-mini-btn", "signed-in published profile entry");
  await waitForCondition(
    "signed-in published profile entry: profile center did not open",
    () => Boolean(window.document.querySelector(".profile-center-card")),
    window,
  );
  const publishedEntry = assertElementByText(
    window,
    ".profile-library-entry",
    "发布",
    "signed-in published library entry",
  );
  clickElement(window, publishedEntry);
  await waitForCondition(
    "signed-in published library: page did not open",
    () => window.document.querySelector(".profile-library-page-head")?.textContent.includes("发布"),
    window,
  );
  assertTextIncludes(window, ".profile-library-page-head", "共 1 条", "signed-in published library count");
  assertTextIncludes(
    window,
    ".profile-library-post-flow",
    samplePublishedProfilePost.title,
    "signed-in published library post",
  );

  clickSelector(window, ".profile-library-post-flow .post-open-cover", "signed-in published library post open");
  await waitForCondition(
    "signed-in published library: manageable post detail did not open",
    () => window.location.pathname === `/posts/${samplePublishedProfilePost.id}`
      && !window.location.search.includes("subPost=")
      && window.document.querySelector(".post-detail-paper")?.textContent.includes(samplePublishedProfilePost.title),
    window,
  );
  assertTextIncludes(
    window,
    ".post-detail-paper",
    samplePublishedProfilePost.content,
    "signed-in published library detail content",
  );
  assertTextIncludes(
    window,
    ".post-detail-manage-btn",
    "编辑",
    "signed-in published library edit action",
  );
  assertTextIncludes(
    window,
    ".post-detail-manage-btn.danger",
    "删除",
    "signed-in published library delete action",
  );

  clickSelector(window, ".post-detail-manage-btn", "signed-in published library edit action open");
  await waitForCondition(
    "signed-in published library: edit composer did not open",
    () => window.location.pathname === "/compose"
      && Boolean(window.document.querySelector(".composer-page"))
      && window.document.querySelector(".composer-submit")?.textContent.includes("保存修改"),
    window,
  );
  const titleInput = assertElement(
    window,
    ".compose-title-input",
    "signed-in published library edit title input",
  );
  const contentInput = assertElement(
    window,
    ".compose-content-input",
    "signed-in published library edit content input",
  );
  if (titleInput.value !== samplePublishedProfilePost.title) {
    throw new Error(
      `signed-in published library edit: expected title "${samplePublishedProfilePost.title}", actual="${titleInput.value}"`,
    );
  }
  if (contentInput.value !== samplePublishedProfilePost.content) {
    throw new Error(
      `signed-in published library edit: expected content "${samplePublishedProfilePost.content}", actual="${contentInput.value}"`,
    );
  }
  assertTextIncludes(
    window,
    ".compose-taxonomy-community",
    samplePublishedProfilePost.communityName,
    "signed-in published library edit community",
  );
  assertButtonReady(window, ".composer-submit", "signed-in published library edit submit button");

  setFormControlValue(
    window,
    titleInput,
    samplePublishedProfilePostUpdatedTitle,
    "signed-in published library edit updated title",
  );
  setFormControlValue(
    window,
    contentInput,
    samplePublishedProfilePostUpdatedContent,
    "signed-in published library edit updated content",
  );
  const composerForm = assertElement(window, "#composer-form", "signed-in published library edit submit form");
  composerForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await waitForCondition(
    "signed-in published library edit: composer did not navigate home after save",
    () => window.location.pathname === "/" && !window.document.querySelector(".composer-page"),
    window,
  );
  await waitForCondition(
    "signed-in published library edit: saved post did not render in feed",
    () => window.document.querySelector(".post-card")?.textContent.includes(samplePublishedProfilePostUpdatedTitle)
      && window.document.querySelector(".post-card")?.textContent.includes(samplePublishedProfilePostUpdatedContent),
    window,
  );
  const updatePayload = globalThis.__renderSmokeUpdatedPublishedProfilePostPayload;
  if (
    updatePayload?.title !== samplePublishedProfilePostUpdatedTitle ||
    updatePayload?.content !== samplePublishedProfilePostUpdatedContent ||
    updatePayload?.postMode !== "long"
  ) {
    throw new Error("signed-in published library edit: update request payload did not match edited fields");
  }

  clickSelector(window, ".top-profile-mini-btn", "signed-in published library delete profile entry");
  await waitForCondition(
    "signed-in published library delete: profile center did not open",
    () => Boolean(window.document.querySelector(".profile-center-card")),
    window,
  );
  const updatedPublishedEntry = assertElementByText(
    window,
    ".profile-library-entry",
    "发布",
    "signed-in published library delete entry",
  );
  clickElement(window, updatedPublishedEntry);
  await waitForCondition(
    "signed-in published library delete: page did not open",
    () => window.document.querySelector(".profile-library-page-head")?.textContent.includes("发布"),
    window,
  );
  assertTextIncludes(
    window,
    ".profile-library-post-flow",
    samplePublishedProfilePostUpdatedTitle,
    "signed-in published library updated post",
  );
  clickSelector(window, ".profile-library-post-flow .post-open-cover", "signed-in published library updated post open");
  await waitForCondition(
    "signed-in published library delete: updated post detail did not open",
    () => window.location.pathname === `/posts/${samplePublishedProfilePost.id}`
      && window.document.querySelector(".post-detail-paper")?.textContent.includes(samplePublishedProfilePostUpdatedTitle),
    window,
  );

  clickSelector(window, ".post-detail-manage-btn.danger", "signed-in published library delete action cancel open");
  await waitForCondition(
    "signed-in published library delete: confirmation dialog did not open",
    () => window.document.querySelector(".confirm-dialog-card")?.textContent.includes("删除主帖"),
    window,
  );
  assertTextIncludes(
    window,
    ".confirm-dialog-card",
    samplePublishedProfilePostUpdatedTitle,
    "signed-in published library delete confirmation title",
  );
  clickElement(
    window,
    assertElementByText(window, ".confirm-dialog-btn", "取消", "signed-in published library delete cancel"),
  );
  await waitForCondition(
    "signed-in published library delete: cancel did not close confirmation dialog",
    () => !window.document.querySelector(".confirm-dialog-card"),
    window,
  );
  if (globalThis.__renderSmokeDeletedPublishedProfilePost) {
    throw new Error("signed-in published library delete: cancel unexpectedly sent delete request");
  }
  assertTextIncludes(
    window,
    ".post-detail-paper",
    samplePublishedProfilePostUpdatedTitle,
    "signed-in published library delete cancel kept detail",
  );

  clickSelector(window, ".post-detail-manage-btn.danger", "signed-in published library delete action confirm open");
  await waitForCondition(
    "signed-in published library delete confirm: confirmation dialog did not open",
    () => window.document.querySelector(".confirm-dialog-card")?.textContent.includes("删除主帖"),
    window,
  );
  clickElement(
    window,
    assertElementByText(window, ".confirm-dialog-btn.primary", "删除", "signed-in published library delete confirm"),
  );
  await waitForCondition(
    "signed-in published library delete confirm: did not navigate home",
    () => window.location.pathname === "/" && !window.document.querySelector(".post-detail-paper"),
    window,
  );
  if (!globalThis.__renderSmokeDeletedPublishedProfilePost) {
    throw new Error("signed-in published library delete confirm: delete request was not sent");
  }
  if (window.document.body.textContent.includes(samplePublishedProfilePostUpdatedTitle)) {
    throw new Error("signed-in published library delete confirm: deleted post still appears on home");
  }

  clickSelector(window, ".top-profile-mini-btn", "signed-in published library after delete profile entry");
  await waitForCondition(
    "signed-in published library after delete: profile area did not open",
    () => Boolean(window.document.querySelector(".profile-center-card"))
      || Boolean(window.document.querySelector(".profile-library-page-head")),
    window,
  );
  if (!window.document.querySelector(".profile-library-page-head")?.textContent.includes("发布")) {
    const emptyPublishedEntry = assertElementByText(
      window,
      ".profile-library-entry",
      "发布",
      "signed-in published library after delete entry",
    );
    clickElement(window, emptyPublishedEntry);
    await waitForCondition(
      "signed-in published library after delete: published page did not open",
      () => window.document.querySelector(".profile-library-page-head")?.textContent.includes("发布"),
      window,
    );
  }
  assertTextIncludes(window, ".profile-library-page-head", "共 0 条", "signed-in published library after delete count");
  if (window.document.body.textContent.includes(samplePublishedProfilePostUpdatedTitle)) {
    throw new Error("signed-in published library after delete: deleted post still appears in profile");
  }
}

async function assertSignedInNotificationNavigation(window) {
  clickSelector(window, ".top-profile-mini-btn", "signed-in notification entry");
  await waitForCondition(
    "signed-in notification entry: notification page did not open",
    () => Boolean(window.document.querySelector(".profile-notification-page-head")),
    window,
  );
  assertTextIncludes(window, ".profile-notification-page-head", "通知", "signed-in notification page title");
  assertElement(window, ".profile-notification-tabs", "signed-in notification tabs");
  assertElement(window, ".profile-notification-grid", "signed-in notification grid");
  assertTextIncludes(window, ".profile-notification-entry", sampleNotification.actorUsername, "signed-in notification actor");
  assertTextIncludes(window, ".profile-notification-entry", "定位子帖", "signed-in notification target label");
  assertTextIncludes(window, ".profile-notification-entry", sampleBranchSubPost.content, "signed-in notification detail");

  clickSelector(window, ".profile-notification-entry", "signed-in notification row");
  await waitForCondition(
    "signed-in notification row: target post detail did not open",
    () => window.location.pathname === `/posts/${samplePost.id}`
      && window.location.search.includes(`subPost=${sampleBranchSubPost.id}`)
      && Boolean(window.document.querySelector(".post-detail-paper")),
    window,
  );
  await waitForCondition(
    "signed-in notification row: target post detail content did not load",
    () => window.document.querySelector(".post-detail-paper")?.textContent.includes(samplePost.title),
    window,
  );
  await assertTargetBranchSubPostLocated(window, { expectGuestPrompt: false });
  await assertTargetSubPostShareCopiesPermalink({
    window,
    subPost: sampleBranchSubPost,
    label: "signed-in notification target share interaction",
  });
}

async function assertSignedInFallbackNotificationNavigation(window) {
  clickSelector(window, ".top-profile-mini-btn", "signed-in fallback notification entry");
  await waitForCondition(
    "signed-in fallback notification entry: notification page did not open",
    () => Boolean(window.document.querySelector(".profile-notification-page-head")),
    window,
  );
  assertTextIncludes(window, ".profile-notification-page-head", "通知", "signed-in fallback notification page title");
  assertTextIncludes(
    window,
    ".profile-unavailable-inline",
    "1 条通知关联内容不可用，已禁用打开入口；1 条子帖通知将打开主帖。",
    "signed-in fallback notification access summary",
  );
  assertTextIncludes(
    window,
    ".profile-notification-grid",
    "这条通知关联的子帖已删除。",
    "signed-in fallback deleted sub-post redacted detail",
  );
  assertTextIncludes(
    window,
    ".profile-notification-grid",
    "这条通知关联的主帖已删除。",
    "signed-in fallback deleted post redacted detail",
  );
  if (window.document.querySelector(".profile-notification-grid")?.textContent.includes("这条子帖已经被删除。")) {
    throw new Error("signed-in fallback notification leaked deleted sub-post body text");
  }
  if (window.document.querySelector(".profile-notification-grid")?.textContent.includes("已删除主帖")) {
    throw new Error("signed-in fallback notification leaked deleted post title");
  }

  const deletedSubPostRow = assertElementByText(
    window,
    ".profile-notification-entry",
    "关联子帖已删除，将打开主帖",
    "signed-in fallback deleted sub-post row",
  );
  if (deletedSubPostRow.disabled) {
    throw new Error("signed-in fallback deleted sub-post row: row should remain openable");
  }
  if (deletedSubPostRow.textContent.includes("定位子帖")) {
    throw new Error("signed-in fallback deleted sub-post row: row still exposes target sub-post action");
  }

  const deletedPostRow = assertElementByText(
    window,
    ".profile-notification-entry",
    "关联主帖已删除",
    "signed-in fallback deleted post row",
  );
  if (!deletedPostRow.disabled) {
    throw new Error("signed-in fallback deleted post row: row should be disabled");
  }
  if (deletedPostRow.getAttribute("title") !== "关联主帖已删除") {
    throw new Error("signed-in fallback deleted post row: disabled reason is missing from title");
  }

  clickElement(window, deletedSubPostRow);
  await waitForCondition(
    "signed-in fallback deleted sub-post row: parent post detail did not open",
    () => window.location.pathname === `/posts/${samplePost.id}`
      && !window.location.search.includes("subPost=")
      && Boolean(window.document.querySelector(".post-detail-paper")),
    window,
  );
  await waitForCondition(
    "signed-in fallback deleted sub-post row: parent post detail content did not load",
    () => window.document.querySelector(".post-detail-paper")?.textContent.includes(samplePost.title),
    window,
  );
  await assertPostDetailMetadata(window, {
    label: "signed-in fallback parent post detail metadata",
  });
  assertPostDetailMobileActions(window, { expectGuestPrompt: false });
  assertSubPostFloor(window, "signed-in fallback parent post detail", { expectGuestPrompt: false });
  assertTextIncludes(window, ".detail-interact-btn-share", "分享", "signed-in fallback parent post share label");
  if (window.document.querySelector(".detail-interact-btn-share")?.textContent.includes("定位")) {
    throw new Error("signed-in fallback parent post detail: share action unexpectedly targets a deleted sub-post");
  }
  await assertParentPostShareCopiesParentPermalink(
    window,
    "signed-in fallback notification parent share interaction",
  );
}

async function assertGuestLikeOpensAuthModal(window) {
  clickSelector(window, ".detail-interact-btn-like", "guest like interaction");
  await waitForCondition(
    "guest like interaction: auth modal did not open",
    () => Boolean(window.document.querySelector(".auth-modal-card")),
    window,
  );
  assertAuthModalControls(window, "guest like interaction auth modal");
}

async function assertSignedInMainPostLikeFailure(window) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  const likeButton = assertButtonReady(
    window,
    ".detail-interact-btn-like",
    "signed-in main-post like failure button",
  );
  const likeBadge = assertTextIncludes(
    window,
    ".detail-interact-badge.like",
    String(samplePost.likeCount),
    "signed-in main-post like failure initial count",
  );
  const beforeBadgeText = likeBadge.textContent.replace(/\s+/g, " ").trim();

  if (likeButton.classList.contains("active")) {
    throw new Error("signed-in main-post like failure: like button unexpectedly starts active");
  }
  if (likeButton.getAttribute("aria-label") !== "点赞") {
    throw new Error("signed-in main-post like failure: like button aria-label should start as 点赞");
  }

  clickElement(window, likeButton);
  await waitForCondition(
    "signed-in main-post like failure: like request did not fail",
    () => globalThis.__renderSmokeFailedMainPostLike === true,
    window,
  );
  await waitForCondition(
    "signed-in main-post like failure: failure toast did not render",
    () => window.document.querySelector(".toast-message")?.textContent.includes("点赞失败，请稍后重试。"),
    window,
  );

  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`signed-in main-post like failure changed route from ${beforePath} to ${afterPath}`);
  }
  if (window.document.querySelector(".auth-modal-card")) {
    throw new Error("signed-in main-post like failure opened auth modal for an authenticated user");
  }

  const afterButton = assertButtonReady(
    window,
    ".detail-interact-btn-like",
    "signed-in main-post like failure button after error",
  );
  const afterBadgeText = assertElement(
    window,
    ".detail-interact-badge.like",
    "signed-in main-post like failure count after error",
  ).textContent.replace(/\s+/g, " ").trim();
  if (afterButton.classList.contains("active")) {
    throw new Error("signed-in main-post like failure: failed request marked the post as liked");
  }
  if (afterButton.getAttribute("aria-label") !== "点赞") {
    throw new Error("signed-in main-post like failure: failed request changed like aria-label");
  }
  if (afterBadgeText !== beforeBadgeText) {
    throw new Error(`signed-in main-post like failure changed like count from ${beforeBadgeText} to ${afterBadgeText}`);
  }
}

async function assertSignedInMainPostFavoriteFailure(window) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  const favoriteBadge = assertTextIncludes(
    window,
    ".detail-interact-badge.favorite",
    String(samplePost.favoriteCount),
    "signed-in main-post favorite failure initial count",
  );
  const beforeBadgeText = favoriteBadge.textContent.replace(/\s+/g, " ").trim();

  clickSelector(window, ".detail-interact-btn-more", "signed-in main-post favorite failure more menu");
  await waitForCondition(
    "signed-in main-post favorite failure: more menu did not open",
    () => Boolean(window.document.querySelector(".detail-post-more-menu")),
    window,
  );

  const favoriteButton = assertButtonReady(
    window,
    ".detail-interact-btn-favorite",
    "signed-in main-post favorite failure button",
  );
  if (favoriteButton.classList.contains("active")) {
    throw new Error("signed-in main-post favorite failure: favorite button unexpectedly starts active");
  }
  if (favoriteButton.getAttribute("aria-label") !== "收藏") {
    throw new Error("signed-in main-post favorite failure: favorite button aria-label should start as 收藏");
  }

  clickElement(window, favoriteButton);
  await waitForCondition(
    "signed-in main-post favorite failure: favorite request did not fail",
    () => globalThis.__renderSmokeFailedMainPostFavorite === true,
    window,
  );
  await waitForCondition(
    "signed-in main-post favorite failure: failure toast did not render",
    () => window.document.querySelector(".toast-message")?.textContent.includes("收藏失败，请稍后重试。"),
    window,
  );

  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`signed-in main-post favorite failure changed route from ${beforePath} to ${afterPath}`);
  }
  if (window.document.querySelector(".auth-modal-card")) {
    throw new Error("signed-in main-post favorite failure opened auth modal for an authenticated user");
  }
  if (window.document.querySelector(".detail-post-more-menu")) {
    throw new Error("signed-in main-post favorite failure left the more menu open after action");
  }

  clickSelector(window, ".detail-interact-btn-more", "signed-in main-post favorite failure reopen more menu");
  await waitForCondition(
    "signed-in main-post favorite failure: more menu did not reopen",
    () => Boolean(window.document.querySelector(".detail-post-more-menu")),
    window,
  );

  const afterButton = assertButtonReady(
    window,
    ".detail-interact-btn-favorite",
    "signed-in main-post favorite failure button after error",
  );
  const afterBadgeText = assertElement(
    window,
    ".detail-interact-badge.favorite",
    "signed-in main-post favorite failure count after error",
  ).textContent.replace(/\s+/g, " ").trim();
  if (afterButton.classList.contains("active")) {
    throw new Error("signed-in main-post favorite failure: failed request marked the post as favorited");
  }
  if (afterButton.getAttribute("aria-label") !== "收藏") {
    throw new Error("signed-in main-post favorite failure: failed request changed favorite aria-label");
  }
  if (afterBadgeText !== beforeBadgeText) {
    throw new Error(`signed-in main-post favorite failure changed favorite count from ${beforeBadgeText} to ${afterBadgeText}`);
  }
}

async function assertSignedInSubPostLikeFailure(window) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  const floorSelector = `#sub-post-floor-${sampleSubPost.id}`;
  const floor = assertElement(window, floorSelector, "signed-in sub-post like failure floor");
  const likeButton = assertButtonReady(
    window,
    `${floorSelector} .main-sub-post .sub-post-actions-right > button.sub-post-action-btn[title='点赞']`,
    "signed-in sub-post like failure button",
  );
  const likeBadge = assertTextIncludes(
    window,
    `${floorSelector} .main-sub-post .sub-post-left-badge.like`,
    String(sampleSubPost.likeCount),
    "signed-in sub-post like failure initial count",
  );
  const beforeBadgeText = likeBadge.textContent.replace(/\s+/g, " ").trim();

  if (likeButton.classList.contains("is-active")) {
    throw new Error("signed-in sub-post like failure: like button unexpectedly starts active");
  }
  if (!floor.textContent.includes(sampleSubPost.content)) {
    throw new Error("signed-in sub-post like failure: target floor content is missing");
  }

  clickElement(window, likeButton);
  await waitForCondition(
    "signed-in sub-post like failure: like request did not fail",
    () => globalThis.__renderSmokeFailedSubPostLike === true,
    window,
  );
  await waitForCondition(
    "signed-in sub-post like failure: failure toast did not render",
    () => window.document.querySelector(".toast-message")?.textContent.includes("子帖点赞失败，请稍后重试。"),
    window,
  );

  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`signed-in sub-post like failure changed route from ${beforePath} to ${afterPath}`);
  }
  if (window.document.querySelector(".auth-modal-card")) {
    throw new Error("signed-in sub-post like failure opened auth modal for an authenticated user");
  }

  const afterButton = assertButtonReady(
    window,
    `${floorSelector} .main-sub-post .sub-post-actions-right > button.sub-post-action-btn[title='点赞']`,
    "signed-in sub-post like failure button after error",
  );
  const afterBadgeText = assertElement(
    window,
    `${floorSelector} .main-sub-post .sub-post-left-badge.like`,
    "signed-in sub-post like failure count after error",
  ).textContent.replace(/\s+/g, " ").trim();
  if (afterButton.classList.contains("is-active")) {
    throw new Error("signed-in sub-post like failure: failed request marked the sub-post as liked");
  }
  if (afterButton.getAttribute("title") !== "点赞") {
    throw new Error("signed-in sub-post like failure: failed request changed like title");
  }
  if (afterBadgeText !== beforeBadgeText) {
    throw new Error(`signed-in sub-post like failure changed like count from ${beforeBadgeText} to ${afterBadgeText}`);
  }
}

async function assertSignedInSubPostFavoriteFailure(window) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  const floorSelector = `#sub-post-floor-${sampleSubPost.id}`;
  const floor = assertElement(window, floorSelector, "signed-in sub-post favorite failure floor");
  if (floor.querySelector(".main-sub-post .sub-post-left-badge.favorite")) {
    throw new Error("signed-in sub-post favorite failure: favorite badge unexpectedly starts visible");
  }

  clickSelector(
    window,
    `${floorSelector} .main-sub-post .sub-post-action-btn.more-btn`,
    "signed-in sub-post favorite failure more menu",
  );
  await waitForCondition(
    "signed-in sub-post favorite failure: more menu did not open",
    () => Boolean(window.document.querySelector(".sub-post-more-menu [aria-label='收藏']")),
    window,
  );

  const favoriteButton = assertButtonReady(
    window,
    ".sub-post-more-menu [aria-label='收藏']",
    "signed-in sub-post favorite failure button",
  );
  if (favoriteButton.classList.contains("is-active")) {
    throw new Error("signed-in sub-post favorite failure: favorite button unexpectedly starts active");
  }

  clickElement(window, favoriteButton);
  await waitForCondition(
    "signed-in sub-post favorite failure: favorite request did not fail",
    () => globalThis.__renderSmokeFailedSubPostFavorite === true,
    window,
  );
  await waitForCondition(
    "signed-in sub-post favorite failure: failure toast did not render",
    () => window.document.querySelector(".toast-message")?.textContent.includes("子帖收藏失败，请稍后重试。"),
    window,
  );

  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`signed-in sub-post favorite failure changed route from ${beforePath} to ${afterPath}`);
  }
  if (window.document.querySelector(".auth-modal-card")) {
    throw new Error("signed-in sub-post favorite failure opened auth modal for an authenticated user");
  }
  if (window.document.querySelector(".sub-post-more-menu")) {
    throw new Error("signed-in sub-post favorite failure left the more menu open after action");
  }
  if (floor.querySelector(".main-sub-post .sub-post-left-badge.favorite")) {
    throw new Error("signed-in sub-post favorite failure: failed request created a favorite badge");
  }

  clickSelector(
    window,
    `${floorSelector} .main-sub-post .sub-post-action-btn.more-btn`,
    "signed-in sub-post favorite failure reopen more menu",
  );
  await waitForCondition(
    "signed-in sub-post favorite failure: more menu did not reopen",
    () => Boolean(window.document.querySelector(".sub-post-more-menu [aria-label='收藏']")),
    window,
  );

  const afterButton = assertButtonReady(
    window,
    ".sub-post-more-menu [aria-label='收藏']",
    "signed-in sub-post favorite failure button after error",
  );
  if (afterButton.classList.contains("is-active")) {
    throw new Error("signed-in sub-post favorite failure: failed request marked the sub-post as favorited");
  }
  if (afterButton.getAttribute("aria-label") !== "收藏") {
    throw new Error("signed-in sub-post favorite failure: failed request changed favorite aria-label");
  }
}

async function assertSignedInSubPostLikeSyncsProfileLibrary(window) {
  const floorSelector = `#sub-post-floor-${sampleSubPost.id}`;
  const likeButton = assertButtonReady(
    window,
    `${floorSelector} .main-sub-post .sub-post-actions-right > button.sub-post-action-btn[title='点赞']`,
    "signed-in sub-post like sync button",
  );
  clickElement(window, likeButton);
  await waitForCondition(
    "signed-in sub-post like sync: like request was not sent",
    () => globalThis.__renderSmokeSyncedSubPostLike === true,
    window,
  );
  await waitForCondition(
    "signed-in sub-post like sync: floor did not show liked state",
    () => {
      const activeButton = window.document.querySelector(
        `${floorSelector} .main-sub-post .sub-post-actions-right > button.sub-post-action-btn[title='取消点赞']`,
      );
      const badgeText = window.document.querySelector(`${floorSelector} .main-sub-post .sub-post-left-badge.like`)
        ?.textContent.replace(/\s+/g, " ").trim() || "";
      return activeButton?.classList.contains("is-active") && badgeText.includes("2");
    },
    window,
  );

  clickSelector(window, ".top-profile-mini-btn", "signed-in sub-post like sync profile entry");
  await waitForCondition(
    "signed-in sub-post like sync: profile center did not open",
    () => Boolean(window.document.querySelector(".profile-center-card")),
    window,
  );
  const likedEntry = assertElementByText(
    window,
    ".profile-library-entry",
    "点赞",
    "signed-in sub-post like sync liked library entry",
  );
  clickElement(window, likedEntry);
  await waitForCondition(
    "signed-in sub-post like sync: liked library did not open",
    () => window.document.querySelector(".profile-library-page-head")?.textContent.includes("点赞"),
    window,
  );
  assertTextIncludes(
    window,
    ".profile-library-page-head",
    "共 2 条",
    "signed-in sub-post like sync liked library count",
  );
  assertTextIncludes(
    window,
    ".profile-sub-post-preview",
    sampleSubPost.content,
    "signed-in sub-post like sync profile sub-post preview",
  );

  clickSelector(
    window,
    ".profile-sub-post-preview-row",
    "signed-in sub-post like sync profile sub-post open",
  );
  await waitForCondition(
    "signed-in sub-post like sync: synced sub-post detail did not open",
    () => window.location.pathname === `/posts/${samplePost.id}`
      && window.location.search.includes(`subPost=${sampleSubPost.id}`)
      && Boolean(window.document.querySelector(".post-detail-paper")),
    window,
  );
  await assertTargetSubPostLocated(window, { expectGuestPrompt: false });
}

async function assertFeedShareDoesNotNavigate(window) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  clickSelector(window, ".post-card-share-btn", "feed share interaction");
  await waitForCondition(
    "feed share interaction: clipboard copy did not run",
    () => window.__copiedText.some((text) => text.includes(samplePost.title)),
    window,
  );
  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`feed share interaction changed route from ${beforePath} to ${afterPath}`);
  }
}

async function assertHomeFloatingActionsAfterScroll(window) {
  await assertFloatingActionsAfterScroll(window, {
    label: "home floating actions",
    settledSelector: ".post-card",
    expectedRefreshAriaLabel: "刷新帖子",
  });
}

async function assertPostDetailFloatingActionsAfterScroll(window) {
  await assertFloatingActionsAfterScroll(window, {
    label: "post detail floating actions",
    settledSelector: ".post-detail-paper",
    expectedRefreshAriaLabel: "刷新内容",
  });
}

async function assertFloatingActionsAfterScroll(
  window,
  {
    label,
    settledSelector,
    expectedRefreshAriaLabel,
  },
) {
  if (window.document.querySelector(".floating-actions")) {
    throw new Error(`${label} rendered before scroll threshold`);
  }

  await waitForCondition(
    `${label}: feed controls did not settle before scroll`,
    () => Boolean(window.document.querySelector(settledSelector)),
    window,
  );
  for (let attempt = 0; attempt < 8 && !window.document.querySelector(".floating-actions"); attempt += 1) {
    window.scrollTo({ top: 480, behavior: "auto" });
    window.dispatchEvent(new window.Event("scroll"));
    window.document.dispatchEvent(new window.Event("scroll"));
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

  await waitForCondition(
    `${label}: lazy actions did not appear after scroll`,
    () => Boolean(window.document.querySelector(".floating-actions")),
    window,
  );

  const refreshButton = assertButtonReady(
    window,
    ".floating-action-btn.refresh",
    `${label} refresh button`,
  );
  if (refreshButton.getAttribute("aria-label") !== expectedRefreshAriaLabel) {
    throw new Error(
      `${label}: expected refresh aria-label "${expectedRefreshAriaLabel}", got "${refreshButton.getAttribute("aria-label")}"`,
    );
  }
  const backToTopButton = assertButtonReady(
    window,
    ".floating-action-btn.arrow",
    `${label} back-to-top button`,
  );
  clickElement(window, backToTopButton);

  await waitForCondition(
    `${label}: back-to-top did not call scrollTo`,
    () => window.__scrollToCalls.some((call) => call?.top === 0 && call?.behavior === "smooth"),
    window,
  );
  if (window.scrollY !== 0 || window.pageYOffset !== 0) {
    throw new Error(
      `${label}: expected scroll position to reset to 0, got scrollY=${window.scrollY}, pageYOffset=${window.pageYOffset}`,
    );
  }
}

async function assertProfileLibraryPostShareDoesNotNavigate(
  window,
  label = "signed-in liked library share interaction",
) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  clickSelector(
    window,
    ".profile-library-post-flow .post-card-share-btn",
    label,
  );
  await waitForCondition(
    `${label}: clipboard text did not include profile post context`,
    () => Boolean(findCopiedTextEntry(window, [
      sampleProfilePost.title,
      sampleProfilePost.content,
      `来自 MemeSee · ${sampleProfilePost.communityName} · @${sampleProfilePost.authorUsername}`,
      `${TEST_ORIGIN}/posts/${sampleProfilePost.id}`,
    ])),
    window,
  );
  assertCopiedTextContains(window, [
    sampleProfilePost.title,
    sampleProfilePost.content,
    `来自 MemeSee · ${sampleProfilePost.communityName} · @${sampleProfilePost.authorUsername}`,
    `${TEST_ORIGIN}/posts/${sampleProfilePost.id}`,
  ], label);
  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`${label} changed route from ${beforePath} to ${afterPath}`);
  }
  assertElement(window, ".profile-library-page-head", `${label} stayed on library page`);
}

function findCopiedTextEntry(window, expectedParts) {
  const parts = expectedParts.map((part) => String(part || "").trim()).filter(Boolean);
  return (Array.isArray(window.__copiedText) ? window.__copiedText : [])
    .find((text) => parts.every((part) => String(text || "").includes(part)))
    || "";
}

function assertCopiedTextContains(window, expectedParts, label) {
  const copiedText = findCopiedTextEntry(window, expectedParts);
  if (!copiedText) {
    throw new Error(
      `${label}: copied text missed expected parts ${JSON.stringify(expectedParts)}; copied=${JSON.stringify(window.__copiedText || [])}`,
    );
  }
  return copiedText;
}

function assertCopiedTextIncludesCanonical(window, copiedText, label) {
  const canonicalHref = readHeadAttribute(window, 'link[rel="canonical"]', "href");
  if (!canonicalHref) {
    throw new Error(`${label}: canonical URL is missing while verifying copied share text`);
  }
  if (!String(copiedText || "").includes(canonicalHref)) {
    throw new Error(`${label}: copied text did not include canonical "${canonicalHref}"; copied="${copiedText}"`);
  }
  const currentHref = `${TEST_ORIGIN}${window.location.pathname}${window.location.search}`;
  if (currentHref !== canonicalHref && String(copiedText || "").includes(currentHref)) {
    throw new Error(`${label}: copied text used non-canonical current URL "${currentHref}"`);
  }
}

async function assertRichPostShareCopiesReadableContext(window) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  clickSelector(window, ".detail-interact-btn-share", "rich post share interaction");
  await waitForCondition(
    "rich post share interaction: clipboard text did not include rich context",
    () => Boolean(findCopiedTextEntry(window, [
      sampleRichPost.title,
      `${sampleRichPost.content}·1张图`,
      `来自 MemeSee · ${sampleRichPost.communityName} · @${sampleRichPost.authorUsername}`,
      `${TEST_ORIGIN}/posts/${sampleRichPost.id}`,
    ])),
    window,
  );
  const copiedText = assertCopiedTextContains(window, [
    sampleRichPost.title,
    `${sampleRichPost.content}·1张图`,
    `来自 MemeSee · ${sampleRichPost.communityName} · @${sampleRichPost.authorUsername}`,
    `${TEST_ORIGIN}/posts/${sampleRichPost.id}`,
  ], "rich post share interaction");
  assertCopiedTextIncludesCanonical(window, copiedText, "rich post share interaction");
  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`rich post share interaction changed route from ${beforePath} to ${afterPath}`);
  }
}

async function assertTargetSubPostShareCopiesLocatedPermalink(window) {
  await assertTargetSubPostShareCopiesPermalink({
    window,
    subPost: sampleSubPost,
    label: "target sub-post share interaction",
  });
}

async function assertTargetBranchSubPostShareCopiesLocatedPermalink(window) {
  await assertTargetSubPostShareCopiesPermalink({
    window,
    subPost: sampleBranchSubPost,
    label: "target branch sub-post share interaction",
  });
}

async function assertTargetSubPostShareCopiesPermalink({ window, subPost, label }) {
  const subPostId = subPost.id;
  const targetAuthor = String(subPost.author || subPost.authorUsername || "").replace(/^@+/, "");
  const beforePath = `${window.location.pathname}${window.location.search}`;
  clickSelector(window, ".detail-interact-btn-share", label);
  await waitForCondition(
    `${label}: clipboard text did not include target permalink context`,
    () => Boolean(findCopiedTextEntry(window, [
      `${samplePost.title} · @${targetAuthor} 的子帖`,
      `定位到 @${targetAuthor} 的子帖 #${subPostId}`,
      subPost.content,
      `来自 MemeSee · ${samplePost.communityName} · @${samplePost.authorUsername}`,
      `${TEST_ORIGIN}/posts/${samplePost.id}?subPost=${subPostId}`,
    ])),
    window,
  );
  const copiedText = assertCopiedTextContains(window, [
    `${samplePost.title} · @${targetAuthor} 的子帖`,
    `定位到 @${targetAuthor} 的子帖 #${subPostId}`,
    subPost.content,
    `来自 MemeSee · ${samplePost.communityName} · @${samplePost.authorUsername}`,
    `${TEST_ORIGIN}/posts/${samplePost.id}?subPost=${subPostId}`,
  ], label);
  assertCopiedTextIncludesCanonical(window, copiedText, label);
  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`${label} changed route from ${beforePath} to ${afterPath}`);
  }
}

async function assertParentPostShareCopiesParentPermalink(window, label) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  clickSelector(window, ".detail-interact-btn-share", label);
  await waitForCondition(
    `${label}: clipboard text did not include parent post context`,
    () => Boolean(findCopiedTextEntry(window, [
      samplePost.title,
      samplePost.content,
      `来自 MemeSee · ${samplePost.communityName} · @${samplePost.authorUsername}`,
      `${TEST_ORIGIN}/posts/${samplePost.id}`,
    ])),
    window,
  );
  const copiedText = assertCopiedTextContains(window, [
    samplePost.title,
    samplePost.content,
    `来自 MemeSee · ${samplePost.communityName} · @${samplePost.authorUsername}`,
    `${TEST_ORIGIN}/posts/${samplePost.id}`,
  ], label);
  if (copiedText.includes("定位到子帖") || copiedText.includes("?subPost=")) {
    throw new Error(`${label}: copied parent share included stale sub-post context`);
  }
  assertCopiedTextIncludesCanonical(window, copiedText, label);
  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`${label} changed route from ${beforePath} to ${afterPath}`);
  }
}

async function assertMissingTargetSubPostShareFallsBackToParentPost(window) {
  const beforePath = `${window.location.pathname}${window.location.search}`;
  const missingSubPostId = 404;
  clickSelector(window, ".detail-interact-btn-share", "missing target sub-post share interaction");
  await waitForCondition(
    "missing target sub-post share interaction: clipboard text did not include parent post context",
    () => Boolean(findCopiedTextEntry(window, [
      samplePost.title,
      samplePost.content,
      `来自 MemeSee · ${samplePost.communityName} · @${samplePost.authorUsername}`,
      `${TEST_ORIGIN}/posts/${samplePost.id}`,
    ])),
    window,
  );
  const copiedText = assertCopiedTextContains(window, [
    samplePost.title,
    samplePost.content,
    `来自 MemeSee · ${samplePost.communityName} · @${samplePost.authorUsername}`,
    `${TEST_ORIGIN}/posts/${samplePost.id}`,
  ], "missing target sub-post share interaction");
  if (copiedText.includes(`定位到子帖 #${missingSubPostId}`)) {
    throw new Error("missing target sub-post share interaction copied missing target context");
  }
  if (copiedText.includes(`?subPost=${missingSubPostId}`)) {
    throw new Error("missing target sub-post share interaction copied missing target permalink");
  }
  assertCopiedTextIncludesCanonical(window, copiedText, "missing target sub-post share interaction");
  const afterPath = `${window.location.pathname}${window.location.search}`;
  if (afterPath !== beforePath) {
    throw new Error(`missing target sub-post share interaction changed route from ${beforePath} to ${afterPath}`);
  }
}

async function smokeRoute(entryAsset, route, index) {
  const window = new Window({
    url: `${TEST_ORIGIN}${route.path}`,
    width: 390,
    height: 844,
  });
  window.document.body.innerHTML = '<div id="root"></div>';
  installWindowGlobals(window);
  seedAuthSession(window, route.authSession);
  globalThis.__renderSmokeRoute = route;
  globalThis.__renderSmokeCreatedNestedSubPost = null;
  globalThis.__renderSmokeCreatedProcessingSubPost = null;
  globalThis.__renderSmokeCreatedRetrySubPost = null;
  globalThis.__renderSmokeCreatedRetryMainPost = null;
  globalThis.__renderSmokeUpdatedPublishedProfilePost = null;
  globalThis.__renderSmokeUpdatedPublishedProfilePostPayload = null;
  globalThis.__renderSmokeDeletedPublishedProfilePost = false;
  globalThis.__renderSmokeDeletedSubPost = false;
  globalThis.__renderSmokeFailedMainPostLike = false;
  globalThis.__renderSmokeFailedMainPostFavorite = false;
  globalThis.__renderSmokeFailedSubPostLike = false;
  globalThis.__renderSmokeFailedSubPostFavorite = false;
  globalThis.__renderSmokeSyncedSubPostLike = false;
  globalThis.__renderSmokeRetryMediaUploadAttempts = 0;

  const errors = [];
  window.addEventListener("error", (event) => {
    errors.push(event.error?.message || event.message || "window error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    errors.push(event.reason?.message || String(event.reason || "unhandled rejection"));
  });

  try {
    await import(`${pathToFileURL(entryAsset).href}?render-smoke=${index}`);
    await waitForRouteReady(window, route);
    await new Promise((resolve) => setTimeout(resolve, 50));

    assertAppShell(window, route.label);

    for (const assertion of route.mobileAssertions || []) {
      try {
        await assertion.run(window);
      } catch (error) {
        throw new Error(`${route.label} ${assertion.label}: ${error.message}`);
      }
    }

    for (const interaction of route.interactions || []) {
      try {
        await interaction.run(window);
      } catch (error) {
        throw new Error(`${route.label} ${interaction.label}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`${route.label}: ${errors.join("; ")}`);
    }

    return {
      label: route.label,
      path: route.path,
      title: window.document.title,
      mobileAssertionCount: (route.mobileAssertions || []).length,
      interactionCount: (route.interactions || []).length,
      bodyTextSample: getBodyText(window, 120),
    };
  } finally {
    window.__memeseeRoot?.unmount?.();
    window.__memeseeRoot = null;
    window.close?.();
    globalThis.__renderSmokeRoute = null;
    globalThis.__renderSmokeCreatedNestedSubPost = null;
    globalThis.__renderSmokeCreatedProcessingSubPost = null;
    globalThis.__renderSmokeCreatedRetrySubPost = null;
    globalThis.__renderSmokeCreatedRetryMainPost = null;
    globalThis.__renderSmokeUpdatedPublishedProfilePost = null;
    globalThis.__renderSmokeUpdatedPublishedProfilePostPayload = null;
    globalThis.__renderSmokeDeletedPublishedProfilePost = false;
    globalThis.__renderSmokeDeletedSubPost = false;
    globalThis.__renderSmokeFailedMainPostLike = false;
    globalThis.__renderSmokeFailedMainPostFavorite = false;
    globalThis.__renderSmokeFailedSubPostLike = false;
    globalThis.__renderSmokeFailedSubPostFavorite = false;
    globalThis.__renderSmokeSyncedSubPostLike = false;
    globalThis.__renderSmokeRetryMediaUploadAttempts = 0;
  }
}

async function main() {
  const entryAsset = findEntryAsset();
  const reports = [];
  const failures = [];

  for (let index = 0; index < ROUTES.length; index += 1) {
    const route = ROUTES[index];
    try {
      reports.push(await smokeRoute(entryAsset, route, index));
    } catch (error) {
      failures.push(error.message);
    }
  }

  console.log("Production render smoke report");
  console.log(JSON.stringify({ entryAsset, routes: reports }, null, 2));

  if (failures.length > 0) {
    console.error("\nProduction render smoke failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
