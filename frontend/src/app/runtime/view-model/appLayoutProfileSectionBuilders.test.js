import { describe, expect, it, vi } from "vitest";
import {
  buildProfileCommunityPostsProps,
  buildProfileLibraryPageProps,
  buildProfileNotificationPageProps,
} from "./appLayoutProfileSectionBuilders";
import { navigateToPost } from "../../../shared/state/appHelpers";

vi.mock("../../../shared/state/appHelpers", () => ({
  navigateToPost: vi.fn(),
}));

describe("buildProfileNotificationPageProps", () => {
  it("passes notification post navigation options through to the app router", () => {
    const setRoute = vi.fn();
    const markNotificationReadLocally = vi.fn();
    const props = buildProfileNotificationPageProps({
      profile: {
        activeProfileNotificationPage: true,
      },
      actions: {
        backToProfileOverview: () => {},
        logout: () => {},
      },
      notifications: {
        notifications: [],
        notificationUnreadCount: 0,
        notificationTypeLabel: () => "",
        loadNotifications: () => {},
        markNotificationsRead: () => {},
        markNotificationReadLocally,
      },
      helpers: {
        formatTime: () => "",
      },
      shell: {
        setRoute,
      },
    });

    props.navigateToPost(42, { targetSubPostId: 7 });

    expect(navigateToPost).toHaveBeenCalledWith(42, setRoute, {
      targetSubPostId: 7,
    });
    expect(props.markNotificationReadLocally).toBe(markNotificationReadLocally);
  });
});

describe("buildProfileLibraryPageProps", () => {
  it("passes main-post share actions into profile library cards", () => {
    const sharePost = () => {};
    const isSharingPost = () => false;
    const props = buildProfileLibraryPageProps({
      profile: {
        activeProfileLibraryPage: "favorite",
        profilePosts: [],
        profileSubPosts: [],
        profileInteractions: {
          postInteractions: [],
          subPostInteractions: [],
        },
      },
      actions: {
        backToProfileOverview: () => {},
        logout: () => {},
        openPostDetail: () => {},
        sharePost,
        isSharingPost,
      },
      helpers: {
        formatTime: () => "",
        clampText: () => "",
        formatHeatScore: () => "",
      },
      shell: {
        setRoute: () => {},
      },
    });

    expect(props.sharePost).toBe(sharePost);
    expect(props.isSharingPost).toBe(isSharingPost);
  });
});

describe("buildProfileCommunityPostsProps", () => {
  it("passes main-post share actions into profile community published rows", () => {
    const sharePost = () => {};
    const isSharingPost = () => false;
    const props = buildProfileCommunityPostsProps({
      profile: {
        activeProfileCommunity: {
          name: "发布",
          posts: [],
        },
      },
      actions: {
        backToProfileOverview: () => {},
        logout: () => {},
        openPostDetail: () => {},
        sharePost,
        isSharingPost,
      },
      helpers: {
        formatTime: () => "",
      },
    });

    expect(props.sharePost).toBe(sharePost);
    expect(props.isSharingPost).toBe(isSharingPost);
  });
});
