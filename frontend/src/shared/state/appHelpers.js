import { UI_MESSAGES } from "./uiMessages";
import {
  pushBrowserHistory,
  readBrowserUrl,
  scrollBrowserTo,
} from "../platform/browserNavigation";
import {
  buildPostPermalinkPath,
  normalizePublicPostId,
} from "../platform/postPermalink";

function parsePositiveInteger(value) {
  return Number(normalizePublicPostId(value) || 0);
}

export function buildRoutePath(route) {
  const postId = parsePositiveInteger(route?.mainPostId);
  if (route?.type === "post" && postId) {
    const path = buildPostPermalinkPath({
      postId,
      targetSubPostId: route.targetSubPostId,
    });
    const params = new URLSearchParams();
    const permalinkQuery = path.split("?")[1] || "";
    new URLSearchParams(permalinkQuery).forEach((value, key) => {
      params.set(key, value);
    });
    if (route.manageSource === "profile-published") {
      params.set("manage", "published");
    }
    const search = params.toString();
    return search ? `/posts/${postId}?${search}` : `/posts/${postId}`;
  }
  if (route?.type === "compose") {
    return "/compose";
  }
  return "/";
}

export function parseRouteFromUrl(urlLike) {
  const url = urlLike instanceof URL
    ? urlLike
    : new URL(String(urlLike || "/"), "http://localhost");
  const params = url.searchParams;
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const postPathMatch = pathname.match(/^\/posts\/(\d+)$/);

  if (postPathMatch) {
    const targetSubPostId = parsePositiveInteger(params.get("subPost"));
    return {
      type: "post",
      mainPostId: Number(postPathMatch[1]),
      manageSource: params.get("manage") === "published" ? "profile-published" : "",
      ...(targetSubPostId ? { targetSubPostId } : {}),
    };
  }

  if (pathname === "/compose") {
    return { type: "compose" };
  }

  const composeParam = params.get("compose");
  if (composeParam === "1" || composeParam === "true") {
    return { type: "compose" };
  }
  const postParam = params.get("post");
  if (!postParam) {
    return { type: "home" };
  }
  const mainPostId = parsePositiveInteger(postParam);
  if (!mainPostId) {
    return { type: "home" };
  }
  return {
    type: "post",
    mainPostId,
    manageSource: params.get("manage") === "published" ? "profile-published" : "",
    ...(parsePositiveInteger(params.get("subPost"))
      ? { targetSubPostId: parsePositiveInteger(params.get("subPost")) }
      : {}),
  };
}

export function parseRouteFromLocation() {
  return parseRouteFromUrl(readBrowserUrl());
}

export function navigateToPost(mainPostId, setRoute, options = {}) {
  const normalizedPostId = parsePositiveInteger(mainPostId);
  if (!normalizedPostId) {
    return;
  }
  const nextPath = buildRoutePath({
    type: "post",
    mainPostId: normalizedPostId,
    manageSource: options.manageSource === "profile-published" ? "profile-published" : "",
    targetSubPostId: parsePositiveInteger(options.targetSubPostId) || undefined,
  });
  pushBrowserHistory(nextPath);
  setRoute(parseRouteFromLocation());
  scrollBrowserTo({ top: 0, behavior: "auto" });
}

export function navigateToCompose(setRoute) {
  const nextPath = buildRoutePath({ type: "compose" });
  pushBrowserHistory(nextPath);
  setRoute(parseRouteFromLocation());
  scrollBrowserTo({ top: 0, behavior: "auto" });
}

export function navigateToHome(setRoute) {
  const nextPath = buildRoutePath({ type: "home" });
  pushBrowserHistory(nextPath);
  setRoute(parseRouteFromLocation());
  scrollBrowserTo({ top: 0, behavior: "auto" });
}

export function compareSubPostsBySort(a, b, sortMode) {
  const aTime = Date.parse(a?.createdAt) || 0;
  const bTime = Date.parse(b?.createdAt) || 0;
  if (sortMode === "time_asc") {
    return aTime - bTime;
  }
  if (sortMode === "like_desc") {
    const likeGap = Number(b?.likeCount || 0) - Number(a?.likeCount || 0);
    if (likeGap !== 0) {
      return likeGap;
    }
    return bTime - aTime;
  }
  return bTime - aTime;
}

export function formatTime(value, serverText = "") {
  if (typeof serverText === "string" && serverText.trim()) {
    return serverText.trim();
  }
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  const now = Date.now();
  let diffSeconds = Math.floor((now - date.getTime()) / 1000);
  if (diffSeconds < 0) {
    diffSeconds = 0;
  }
  if (diffSeconds < 3600) {
    const minutes = Math.max(1, Math.floor(diffSeconds / 60));
    return `${minutes}分钟前`;
  }
  const hours = Math.floor(diffSeconds / 3600);
  if (hours < 24) {
    return `${hours}小时前`;
  }
  const days = Math.floor(diffSeconds / 86400);
  if (days <= 30) {
    return `${days}天前`;
  }
  const nowDate = new Date(now);
  if (date.getFullYear() === nowDate.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function subPostQuotePreview(value) {
  const text = String(value || "").trim();
  if (!text) {
    return UI_MESSAGES.emptySubPostPreview;
  }
  return text;
}

export function authorInitial(name) {
  if (!name) {
    return "?";
  }
  return name.slice(0, 1).toUpperCase();
}

export function clampText(value, maxLength) {
  const text = String(value || "");
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength);
}

export function normalizeTagItems(raw) {
  if (!raw) {
    return [];
  }
  const source = Array.isArray(raw) ? raw.join(",") : String(raw);
  return source
    .split(/[,\n/]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^#/, ""))
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

export function parseTagInput(raw) {
  return normalizeTagItems(raw).slice(0, 3);
}

export function sortCommunitiesByOrder(communityList, order) {
  const rank = new Map(order.map((slug, index) => [slug, index]));
  return [...communityList].sort((a, b) => {
    const aRank = rank.has(a.slug) ? rank.get(a.slug) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(b.slug) ? rank.get(b.slug) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

export function sortSubPostNodes(nodes) {
  nodes.sort((a, b) => (Date.parse(a?.createdAt) || 0) - (Date.parse(b?.createdAt) || 0));
  nodes.forEach((node) => {
    if (node.branchSubPosts.length > 0) {
      sortSubPostNodes(node.branchSubPosts);
    }
  });
}

