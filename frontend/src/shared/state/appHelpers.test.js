import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRoutePath,
  compareSubPostsBySort,
  navigateToCompose,
  navigateToHome,
  navigateToPost,
  parseRouteFromUrl,
  sortSubPostNodes,
} from "./appHelpers";

function installWindowLocation(initialUrl) {
  const currentUrl = new URL(initialUrl);
  const location = {
    href: currentUrl.toString(),
    pathname: currentUrl.pathname,
    search: currentUrl.search,
  };
  const updateLocation = (nextPath) => {
    const nextUrl = new URL(nextPath, currentUrl.origin);
    location.href = nextUrl.toString();
    location.pathname = nextUrl.pathname;
    location.search = nextUrl.search;
  };
  const windowObject = {
    location,
    history: {
      pushState: vi.fn((_state, _title, nextPath) => updateLocation(nextPath)),
    },
    scrollTo: vi.fn(),
  };
  vi.stubGlobal("window", windowObject);
  return windowObject;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("route parsing", () => {
  it("opens clean shared post URLs as post detail routes", () => {
    expect(parseRouteFromUrl("https://memesee.world/posts/42")).toEqual({
      type: "post",
      mainPostId: 42,
      manageSource: "",
    });
  });

  it("keeps target sub-post ids on post detail routes", () => {
    expect(parseRouteFromUrl("https://memesee.world/posts/42?subPost=7")).toEqual({
      type: "post",
      mainPostId: 42,
      manageSource: "",
      targetSubPostId: 7,
    });
    expect(parseRouteFromUrl("https://memesee.world/?post=42&subPost=7")).toEqual({
      type: "post",
      mainPostId: 42,
      manageSource: "",
      targetSubPostId: 7,
    });
  });

  it("keeps legacy branch sub-post query links compatible", () => {
    expect(parseRouteFromUrl("https://memesee.world/?post=42&subPost=8")).toEqual({
      type: "post",
      mainPostId: 42,
      manageSource: "",
      targetSubPostId: 8,
    });
  });

  it("ignores malformed target sub-post ids on otherwise valid post routes", () => {
    expect(parseRouteFromUrl("https://memesee.world/posts/42?subPost=bad-id")).toEqual({
      type: "post",
      mainPostId: 42,
      manageSource: "",
    });
    expect(parseRouteFromUrl("https://memesee.world/?post=42&subPost=-1")).toEqual({
      type: "post",
      mainPostId: 42,
      manageSource: "",
    });
  });

  it("keeps legacy query post URLs compatible", () => {
    expect(parseRouteFromUrl("https://memesee.world/?post=42&manage=published")).toEqual({
      type: "post",
      mainPostId: 42,
      manageSource: "profile-published",
    });
  });

  it("opens clean compose URLs and legacy compose query URLs", () => {
    expect(parseRouteFromUrl("https://memesee.world/compose")).toEqual({ type: "compose" });
    expect(parseRouteFromUrl("https://memesee.world/?compose=1")).toEqual({ type: "compose" });
    expect(parseRouteFromUrl("https://memesee.world/?compose=true")).toEqual({ type: "compose" });
  });

  it("lets legacy compose query links win over stale post query parameters", () => {
    expect(parseRouteFromUrl("https://memesee.world/?post=42&compose=1")).toEqual({
      type: "compose",
    });
  });

  it("falls back to home for malformed post routes", () => {
    expect(parseRouteFromUrl("https://memesee.world/posts/not-a-number")).toEqual({
      type: "home",
    });
    expect(parseRouteFromUrl("https://memesee.world/?post=-1")).toEqual({
      type: "home",
    });
  });

  it("cleans detail URLs and scrolls to the top when navigating home", () => {
    const windowObject = installWindowLocation(
      "https://memesee.world/posts/42?manage=published&subPost=7&utm_source=share",
    );
    const setRoute = vi.fn();

    navigateToHome(setRoute);

    expect(windowObject.history.pushState).toHaveBeenCalledWith({}, "", "/");
    expect(setRoute).toHaveBeenCalledWith({ type: "home" });
    expect(windowObject.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    expect(windowObject.location.pathname).toBe("/");
    expect(windowObject.location.search).toBe("");
  });

  it("keeps home navigation idempotent on an already clean home URL", () => {
    const windowObject = installWindowLocation("https://memesee.world/");
    const setRoute = vi.fn();

    navigateToHome(setRoute);

    expect(windowObject.history.pushState).not.toHaveBeenCalled();
    expect(setRoute).toHaveBeenCalledWith({ type: "home" });
    expect(windowObject.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("navigates to a clean compose URL without carrying stale query parameters", () => {
    const windowObject = installWindowLocation(
      "https://memesee.world/posts/42?subPost=7&manage=published&utm_source=share",
    );
    const setRoute = vi.fn();

    navigateToCompose(setRoute);

    expect(windowObject.history.pushState).toHaveBeenCalledWith({}, "", "/compose");
    expect(setRoute).toHaveBeenCalledWith({ type: "compose" });
    expect(windowObject.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    expect(windowObject.location.pathname).toBe("/compose");
    expect(windowObject.location.search).toBe("");
  });

  it("navigates to clean post URLs and preserves profile manage and sub-post context when requested", () => {
    const windowObject = installWindowLocation("https://memesee.world/?post=7&compose=1");
    const setRoute = vi.fn();

    navigateToPost("42", setRoute, {
      manageSource: "profile-published",
      targetSubPostId: 9,
    });

    expect(windowObject.history.pushState).toHaveBeenCalledWith({}, "", "/posts/42?subPost=9&manage=published");
    expect(setRoute).toHaveBeenCalledWith({
      type: "post",
      mainPostId: 42,
      manageSource: "profile-published",
      targetSubPostId: 9,
    });
    expect(windowObject.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    expect(windowObject.location.pathname).toBe("/posts/42");
    expect(windowObject.location.search).toBe("?subPost=9&manage=published");
  });

  it("does not carry stale query parameters into clean post navigation", () => {
    const windowObject = installWindowLocation(
      "https://memesee.world/?post=7&compose=1&utm_source=share&subPost=3&manage=published",
    );
    const setRoute = vi.fn();

    navigateToPost(42, setRoute, { targetSubPostId: 9 });

    expect(windowObject.history.pushState).toHaveBeenCalledWith({}, "", "/posts/42?subPost=9");
    expect(setRoute).toHaveBeenCalledWith({
      type: "post",
      mainPostId: 42,
      manageSource: "",
      targetSubPostId: 9,
    });
    expect(windowObject.location.pathname).toBe("/posts/42");
    expect(windowObject.location.search).toBe("?subPost=9");
  });

  it("does not push malformed post IDs into browser history", () => {
    const windowObject = installWindowLocation("https://memesee.world/");
    const setRoute = vi.fn();

    navigateToPost("not-a-number", setRoute);
    navigateToPost(-1, setRoute);

    expect(windowObject.history.pushState).not.toHaveBeenCalled();
    expect(setRoute).not.toHaveBeenCalled();
    expect(windowObject.scrollTo).not.toHaveBeenCalled();
    expect(windowObject.location.pathname).toBe("/");
  });
});

describe("buildRoutePath", () => {
  it("builds stable paths for home, compose, and post routes", () => {
    expect(buildRoutePath({ type: "home" })).toBe("/");
    expect(buildRoutePath({ type: "compose" })).toBe("/compose");
    expect(buildRoutePath({ type: "post", mainPostId: 42 })).toBe("/posts/42");
    expect(buildRoutePath({
      type: "post",
      mainPostId: 42,
      manageSource: "profile-published",
    })).toBe("/posts/42?manage=published");
    expect(buildRoutePath({
      type: "post",
      mainPostId: 42,
      manageSource: "profile-published",
      targetSubPostId: 7,
    })).toBe("/posts/42?subPost=7&manage=published");
    expect(buildRoutePath({
      type: "post",
      mainPostId: 42,
      targetSubPostId: 7,
    })).toBe("/posts/42?subPost=7");
  });

  it("falls back to home for malformed routes", () => {
    expect(buildRoutePath({ type: "post", mainPostId: "bad" })).toBe("/");
    expect(buildRoutePath(null)).toBe("/");
  });
});

describe("compareSubPostsBySort", () => {
  it("sorts by time and treats malformed timestamps as the oldest item", () => {
    const subPosts = [
      { id: "new", createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "bad", createdAt: "not-a-date" },
      { id: "old", createdAt: "2026-01-02T00:00:00.000Z" },
    ];

    expect(subPosts.sort((a, b) => compareSubPostsBySort(a, b, "time_asc"))
      .map((item) => item.id)).toEqual(["bad", "old", "new"]);
    expect(subPosts.sort((a, b) => compareSubPostsBySort(a, b, "time_desc"))
      .map((item) => item.id)).toEqual(["new", "old", "bad"]);
  });

  it("uses latest time as the like-count tie breaker", () => {
    const subPosts = [
      { id: "liked-old", likeCount: 3, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "less-liked", likeCount: 1, createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "liked-new", likeCount: 3, createdAt: "2026-01-02T00:00:00.000Z" },
    ];

    expect(subPosts.sort((a, b) => compareSubPostsBySort(a, b, "like_desc"))
      .map((item) => item.id)).toEqual(["liked-new", "liked-old", "less-liked"]);
  });
});

describe("sortSubPostNodes", () => {
  it("sorts floors and nested branches by safe ascending time", () => {
    const nodes = [
      {
        id: "late",
        createdAt: "2026-01-03T00:00:00.000Z",
        branchSubPosts: [
          { id: "child-new", createdAt: "2026-01-02T00:00:00.000Z", branchSubPosts: [] },
          { id: "child-bad", createdAt: "not-a-date", branchSubPosts: [] },
        ],
      },
      {
        id: "bad",
        createdAt: "not-a-date",
        branchSubPosts: [],
      },
      {
        id: "early",
        createdAt: "2026-01-01T00:00:00.000Z",
        branchSubPosts: [],
      },
    ];

    sortSubPostNodes(nodes);

    expect(nodes.map((node) => node.id)).toEqual(["bad", "early", "late"]);
    expect(nodes[2].branchSubPosts.map((node) => node.id)).toEqual([
      "child-bad",
      "child-new",
    ]);
  });
});
