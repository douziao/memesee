const envApiBase = (import.meta.env.VITE_API_BASE || "").trim();

export const apiBase = envApiBase;
export const feedBatchSize = 20;
export const profilePostPageSize = 1000;
export const notificationPageSize = 12;
export const publishCommunityOrder = [
  "daily",
  "article",
  "tech",
  "news",
  "game",
  "animation",
  "comic",
  "gallery",
];
export const feedSortModes = ["latest_message", "most_views", "most_heat"];
export const communityMarks = {
  lobby: "\u5385",
  daily: "\u65e5",
  article: "\u6587",
  tech: "\u6280",
  news: "\u65b0",
  game: "\u6e38",
  animation: "\u52a8",
  comic: "\u6f2b",
  gallery: "\u753b",
};
export const communityShortDescriptions = {
  lobby: "\u5168\u7ad9\u52a8\u6001",
  daily: "\u65e5\u5e38\u95f2\u804a",
  article: "\u957f\u6587\u89c2\u70b9",
  tech: "\u6280\u672f\u4ea4\u6d41",
  news: "\u70ed\u70b9\u8d44\u8baf",
  game: "\u6e38\u620f\u8ba8\u8bba",
  animation: "\u52a8\u753b\u4ea4\u6d41",
  comic: "\u6f2b\u753b\u8ba8\u8bba",
  gallery: "\u753b\u96c6\u5206\u4eab",
};
export const lobbyCommunity = {
  id: "lobby",
  slug: "lobby",
  name: "\u5927\u5385",
  description: communityShortDescriptions.lobby,
};
