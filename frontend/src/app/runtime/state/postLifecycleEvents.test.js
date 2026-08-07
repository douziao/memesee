import { describe, expect, it, vi } from "vitest";
import { buildPostLifecycleEventHandlers } from "./postLifecycleEvents";

describe("buildPostLifecycleEventHandlers", () => {
  it("fans out loaded post snapshots to profile and notifications", () => {
    const postSnapshot = { id: 42, title: "新标题" };
    const syncProfilePostSnapshot = vi.fn();
    const syncNotificationPostSnapshot = vi.fn();
    const handlers = buildPostLifecycleEventHandlers({
      profileViewState: { syncProfilePostSnapshot },
      notificationsState: { syncNotificationPostSnapshot },
    });

    handlers.handleMainPostSnapshotSynced(postSnapshot);

    expect(syncProfilePostSnapshot).toHaveBeenCalledWith(postSnapshot);
    expect(syncNotificationPostSnapshot).toHaveBeenCalledWith(postSnapshot);
  });

  it("fans out saved main posts to profile upsert and notification snapshot sync", () => {
    const savedPost = { id: 42, title: "保存后的主帖" };
    const upsertProfilePost = vi.fn();
    const syncNotificationPostSnapshot = vi.fn();
    const handlers = buildPostLifecycleEventHandlers({
      profileViewState: { upsertProfilePost },
      notificationsState: { syncNotificationPostSnapshot },
    });

    handlers.handleMainPostSaved(savedPost);

    expect(upsertProfilePost).toHaveBeenCalledWith(savedPost);
    expect(syncNotificationPostSnapshot).toHaveBeenCalledWith(savedPost);
  });

  it("fans out deleted main posts to profile cleanup and notification unavailable marking", () => {
    const removeProfilePost = vi.fn();
    const markNotificationPostUnavailable = vi.fn();
    const handlers = buildPostLifecycleEventHandlers({
      profileViewState: { removeProfilePost },
      notificationsState: { markNotificationPostUnavailable },
    });

    handlers.handleMainPostDeleted(42);

    expect(removeProfilePost).toHaveBeenCalledWith(42);
    expect(markNotificationPostUnavailable).toHaveBeenCalledWith(42);
  });

  it("routes main post interaction changes to profile state and published post snapshots", () => {
    const interactionChange = {
      post: { id: 42, likedByMe: true, likeCount: 5 },
      action: "like",
      active: true,
    };
    const syncProfilePostSnapshot = vi.fn();
    const syncProfilePostInteraction = vi.fn();
    const handlers = buildPostLifecycleEventHandlers({
      profileViewState: {
        syncProfilePostSnapshot,
        syncProfilePostInteraction,
      },
    });

    handlers.handleMainPostInteractionSynced(interactionChange);

    expect(syncProfilePostSnapshot).toHaveBeenCalledWith(interactionChange.post);
    expect(syncProfilePostInteraction).toHaveBeenCalledWith(interactionChange);
  });

  it("routes sub-post interaction changes to profile state", () => {
    const interactionChange = {
      subPost: { id: 7, favoritedByMe: true, favoriteCount: 2 },
      mainPost: { id: 42, title: "主帖" },
      action: "favorite",
      active: true,
    };
    const syncProfileSubPostInteraction = vi.fn();
    const handlers = buildPostLifecycleEventHandlers({
      profileViewState: { syncProfileSubPostInteraction },
    });

    handlers.handleSubPostInteractionSynced(interactionChange);

    expect(syncProfileSubPostInteraction).toHaveBeenCalledWith(interactionChange);
  });

  it("fans out deleted sub-posts to profile cleanup and notification unavailable marking", () => {
    const removeProfileSubPost = vi.fn();
    const markNotificationSubPostUnavailable = vi.fn();
    const handlers = buildPostLifecycleEventHandlers({
      profileViewState: { removeProfileSubPost },
      notificationsState: { markNotificationSubPostUnavailable },
    });

    handlers.handleSubPostDeleted(7);

    expect(removeProfileSubPost).toHaveBeenCalledWith(7);
    expect(markNotificationSubPostUnavailable).toHaveBeenCalledWith(7);
  });

  it("keeps lifecycle events optional when a downstream runtime is missing", () => {
    const handlers = buildPostLifecycleEventHandlers();

    expect(() => {
      handlers.handleMainPostSnapshotSynced({ id: 42 });
      handlers.handleMainPostSaved({ id: 42 });
      handlers.handleMainPostDeleted(42);
      handlers.handleMainPostInteractionSynced({ post: { id: 42 } });
      handlers.handleSubPostInteractionSynced({ subPost: { id: 7 } });
      handlers.handleSubPostDeleted(7);
    }).not.toThrow();
  });

});
