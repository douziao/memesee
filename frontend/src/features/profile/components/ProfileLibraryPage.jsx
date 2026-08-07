import PostCard from "../../posts/components/post/PostCard";
import { buildSubPostSummaryText } from "../../../shared/platform/postSummaryText";
import { normalizeProfilePositiveId } from "../state/profileIdHelpers";

const LIBRARY_PAGE_META = {
  liked: {
    title: "点赞",
    action: "like",
    empty: "暂无点赞。",
  },
  favorite: {
    title: "收藏",
    action: "favorite",
    empty: "暂无收藏。",
  },
  published: {
    title: "发布",
    empty: "暂无发布。",
  },
};

function timeValue(value) {
  return Date.parse(value) || 0;
}

export function normalizeLibraryPostId(value) {
  return normalizeProfilePositiveId(value);
}

function firstValidLibraryPostId() {
  for (const value of arguments) {
    const id = normalizeLibraryPostId(value);
    if (id) {
      return id;
    }
  }
  return 0;
}

function mainSortTime(item) {
  return item.interactedAt || item.createdAt || item.latestActivityAt || item.updatedAt;
}

function subSortTime(item) {
  return item.interactedAt || item.createdAt || item.updatedAt;
}

function toMainEntry(item, source) {
  return {
    type: "main",
    source,
    item,
    sortAt: timeValue(mainSortTime(item)),
  };
}

function toSubEntry(item, source) {
  return {
    type: "sub",
    source,
    item,
    sortAt: timeValue(subSortTime(item)),
  };
}

function resolvePageItems(pageMeta, {
  profilePosts,
  profileSubPosts,
  postInteractions,
  subPostInteractions,
}) {
  if (!pageMeta.action) {
    return [
      ...profilePosts.map((item) => toMainEntry(item, "published")),
      ...profileSubPosts.map((item) => toSubEntry(item, "published")),
    ].sort((left, right) => right.sortAt - left.sortAt);
  }

  return [
    ...postInteractions
      .filter((item) => item.action === pageMeta.action)
      .map((item) => toMainEntry(item, pageMeta.action)),
    ...subPostInteractions
      .filter((item) => item.action === pageMeta.action)
      .map((item) => toSubEntry(item, pageMeta.action)),
  ].sort((left, right) => right.sortAt - left.sortAt);
}

function ProfileLibraryToolbar({ title, count }) {
  return (
    <div className="profile-library-page-head">
      <h3>{title}</h3>
      <span className="profile-stat-pill">共 {count} 条</span>
    </div>
  );
}

export function buildLibraryUnavailableMessage(unavailableEntryCount) {
  const count = Number(unavailableEntryCount || 0);
  if (!Number.isInteger(count) || count <= 0) {
    return "";
  }
  return `${count} 条记录缺少可打开的主帖信息，已从列表中隐藏。`;
}

function normalizeLibrarySummaryCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

export function buildLibraryPageSummary({
  pageTitle,
  defaultEmptyText,
  entries,
  groups,
  visibleEntryCount,
  unavailableEntryCount,
} = {}) {
  const totalEntryCount = Array.isArray(entries) ? entries.length : 0;
  const groupCount = Array.isArray(groups) ? groups.length : 0;
  const displayableEntryCount = normalizeLibrarySummaryCount(visibleEntryCount);
  const hiddenEntryCount = normalizeLibrarySummaryCount(unavailableEntryCount);
  const hasVisibleGroups = groupCount > 0;
  return {
    totalEntryCount,
    groupCount,
    visibleEntryCount: displayableEntryCount,
    unavailableEntryCount: hiddenEntryCount,
    showGroups: hasVisibleGroups,
    showEmpty: !hasVisibleGroups,
    showUnavailable: hiddenEntryCount > 0,
    emptyText: totalEntryCount > 0 && !hasVisibleGroups
      ? `暂无可打开的${pageTitle || ""}记录。`
      : defaultEmptyText,
    unavailableMessage: buildLibraryUnavailableMessage(hiddenEntryCount),
  };
}

export function resolveSubPostContent(item) {
  return buildSubPostSummaryText({
    subPost: item,
    fallback: "无内容",
  });
}

function resolveSubPostTime(item) {
  return item.interactedAt || item.createdAt || item.updatedAt;
}

function resolveSubPostTimeText(item) {
  return item.interactedAtText || item.createdAtText || item.updatedAtText || "";
}

function resolveSubPostAuthor(item) {
  return item.author || item.authorUsername || "未知用户";
}

export function resolveSubPostMainPost(item) {
  const embeddedMainPostId = firstValidLibraryPostId(item.mainPost?.id, item.mainPost?.postId);
  if (item.mainPost && embeddedMainPostId) {
    return {
      ...item.mainPost,
      id: embeddedMainPostId,
    };
  }
  const fallbackMainPostId = firstValidLibraryPostId(item.postId, item.mainPostId);
  if (!fallbackMainPostId) {
    return null;
  }
  if (item.mainPost && typeof item.mainPost === "object") {
    return {
      ...item.mainPost,
      id: fallbackMainPostId,
      postId: fallbackMainPostId,
      title: item.mainPost.title || item.mainPostTitle || item.postTitle || "未命名主帖",
      preview: item.mainPost.preview || "",
      content: item.mainPost.content || "",
      author: item.mainPost.author || "",
      communityName: item.mainPost.communityName || "",
      communitySlug: item.mainPost.communitySlug || "",
      createdAt: item.mainPost.createdAt || null,
      latestActivityAt: item.mainPost.latestActivityAt || null,
      latestActivityAtText: item.mainPost.latestActivityAtText || "",
      createdAtText: item.mainPost.createdAtText || "",
      viewCount: item.mainPost.viewCount || 0,
      hotScore: item.mainPost.hotScore || 0,
      tags: Array.isArray(item.mainPost.tags) ? item.mainPost.tags : [],
      mediaUrls: Array.isArray(item.mainPost.mediaUrls) ? item.mainPost.mediaUrls : [],
      mediaAssets: Array.isArray(item.mainPost.mediaAssets) ? item.mainPost.mediaAssets : [],
      previewImages: Array.isArray(item.mainPost.previewImages) ? item.mainPost.previewImages : [],
      previewImageSources: Array.isArray(item.mainPost.previewImageSources)
        ? item.mainPost.previewImageSources
        : [],
    };
  }
  return {
    id: fallbackMainPostId,
    title: item.mainPostTitle || item.postTitle || "未命名主帖",
    preview: "",
    content: "",
    author: "",
    communityName: "",
    communitySlug: "",
    createdAt: null,
    latestActivityAt: null,
    latestActivityAtText: "",
    createdAtText: "",
    viewCount: 0,
    hotScore: 0,
    tags: [],
    mediaUrls: [],
    mediaAssets: [],
  };
}

function mainPostKeyFromEntry(entry) {
  if (entry.type === "main") {
    return String(firstValidLibraryPostId(entry.item.id, entry.item.postId) || "");
  }
  const mainPost = resolveSubPostMainPost(entry.item);
  return String(mainPost?.id || "");
}

export function resolveLibraryEntryGroups(entries) {
  const groups = new Map();
  let unavailableEntryCount = 0;
  entries.forEach((entry, index) => {
    const key = mainPostKeyFromEntry(entry);
    const normalizedMainPost = entry.type === "main"
      ? {
        ...entry.item,
        id: firstValidLibraryPostId(entry.item.id, entry.item.postId),
      }
      : resolveSubPostMainPost(entry.item);
    if (!normalizedMainPost?.id) {
      unavailableEntryCount += 1;
      return;
    }
    const existing = groups.get(key) || {
      key,
      post: null,
      mainEntry: null,
      subEntries: [],
      sortAt: 0,
    };

    if (entry.type === "main") {
      existing.mainEntry = entry;
      existing.post = normalizedMainPost;
    } else {
      existing.subEntries.push(entry);
      if (!existing.post) {
        existing.post = normalizedMainPost;
      }
    }

    existing.sortAt = Math.max(existing.sortAt, entry.sortAt);
    groups.set(key, existing);
  });

  const resolvedGroups = Array.from(groups.values())
    .map((group) => ({
      ...group,
      subEntries: group.subEntries.sort((left, right) => right.sortAt - left.sortAt),
    }))
    .sort((left, right) => right.sortAt - left.sortAt);
  const visibleEntryCount = resolvedGroups.reduce(
    (count, group) => count + (group.mainEntry ? 1 : 0) + group.subEntries.length,
    0,
  );
  return {
    groups: resolvedGroups,
    visibleEntryCount,
    unavailableEntryCount,
  };
}

export function groupEntriesByMainPost(entries) {
  return resolveLibraryEntryGroups(entries).groups;
}

function groupKey(group, index) {
  return `main-group-${group.key || group.post?.id || index}-${group.sortAt || index}`;
}

function subEntryKey(entry, index) {
  const item = entry.item;
  return `sub-${entry.source}-${item.subPostId || item.id || item.postId || index}-${item.interactedAt || item.createdAt || index}`;
}

export function resolveLibraryTargetSubPostId(group) {
  if (group?.mainEntry) {
    return 0;
  }
  const firstSubEntry = Array.isArray(group?.subEntries) ? group.subEntries[0] : null;
  return firstValidLibraryPostId(
    firstSubEntry?.item?.subPostId,
    firstSubEntry?.item?.targetSubPostId,
    firstSubEntry?.item?.id,
  );
}

export function resolveLibraryOpenOptions(group, activeProfileLibraryPage) {
  const targetSubPostId = resolveLibraryTargetSubPostId(group);
  return {
    ...(activeProfileLibraryPage === "published"
      ? { manageSource: "profile-published" }
      : {}),
    ...(targetSubPostId ? { targetSubPostId } : {}),
  };
}

export function resolveLibrarySubEntryOpenOptions(entry, activeProfileLibraryPage) {
  const targetSubPostId = firstValidLibraryPostId(
    entry?.item?.subPostId,
    entry?.item?.targetSubPostId,
    entry?.item?.id,
  );
  return {
    ...(activeProfileLibraryPage === "published"
      ? { manageSource: "profile-published" }
      : {}),
    ...(targetSubPostId ? { targetSubPostId } : {}),
  };
}

function SubPostPreviewList({
  subEntries,
  formatTime,
  clampText,
  onOpenSubPostEntry,
}) {
  if (subEntries.length === 0) {
    return null;
  }
  return (
    <div className="profile-sub-post-preview">
      <div className="profile-sub-post-preview-summary">
        <span>相关子帖</span>
        <strong>{subEntries.length} 条</strong>
      </div>
      <div className="profile-sub-post-preview-list">
        {subEntries.map((entry, index) => {
          const item = entry.item;
          return (
            <button
              type="button"
              className="profile-sub-post-preview-row"
              key={subEntryKey(entry, index)}
              onClick={() => onOpenSubPostEntry?.(entry)}
              title="打开这条子帖"
            >
              <div className="profile-sub-post-preview-head">
                <span className="profile-sub-post-preview-meta">
                  <strong>{resolveSubPostAuthor(item)}</strong>
                  <em>{formatTime(resolveSubPostTime(item), resolveSubPostTimeText(item))}</em>
                </span>
              </div>
              <p title={resolveSubPostContent(item)}>
                {clampText(resolveSubPostContent(item) || "无内容", 86)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LibraryMixedList({
  groups,
  openPostDetail,
  sharePost,
  isSharingPost,
  activeProfileLibraryPage,
  formatTime,
  clampText,
  formatHeatScore,
}) {
  const openLibraryPostDetail = (post, group) =>
    openPostDetail(post, resolveLibraryOpenOptions(group, activeProfileLibraryPage));
  const openLibrarySubPostDetail = (entry, group) =>
    openPostDetail(group.post, resolveLibrarySubEntryOpenOptions(entry, activeProfileLibraryPage));

  return (
    <div className="profile-library-post-flow">
      {groups.map((group, index) => (
        <PostCard
          key={groupKey(group, index)}
          post={group.post}
          openPostDetail={(post) => openLibraryPostDetail(post, group)}
          sharePost={sharePost}
          isSharingPost={isSharingPost}
          formatTime={formatTime}
          clampText={clampText}
          formatHeatScore={formatHeatScore}
        >
          <SubPostPreviewList
            subEntries={group.subEntries}
            formatTime={formatTime}
            clampText={clampText}
            onOpenSubPostEntry={(entry) => openLibrarySubPostDetail(entry, group)}
          />
        </PostCard>
      ))}
    </div>
  );
}

export default function ProfileLibraryPage({
  activeProfileLibraryPage,
  profilePosts,
  profileSubPosts,
  postInteractions,
  subPostInteractions,
  openPostDetail,
  sharePost,
  isSharingPost,
  formatTime,
  clampText,
  formatHeatScore,
}) {
  const pageMeta = LIBRARY_PAGE_META[activeProfileLibraryPage] || LIBRARY_PAGE_META.published;
  const entries = resolvePageItems(pageMeta, {
    profilePosts,
    profileSubPosts,
    postInteractions,
    subPostInteractions,
  });
  const {
    groups,
    visibleEntryCount,
    unavailableEntryCount,
  } = resolveLibraryEntryGroups(entries);
  const summary = buildLibraryPageSummary({
    pageTitle: pageMeta.title,
    defaultEmptyText: pageMeta.empty,
    entries,
    groups,
    visibleEntryCount,
    unavailableEntryCount,
  });

  return (
    <>
      <ProfileLibraryToolbar
        title={pageMeta.title}
        count={summary.visibleEntryCount}
      />

      {summary.showEmpty && (
        <div className="paper-inline-status profile-empty-inline">{summary.emptyText}</div>
      )}
      {summary.showUnavailable && (
        <div className="paper-inline-status profile-empty-inline profile-unavailable-inline">
          {summary.unavailableMessage}
        </div>
      )}
      {summary.showGroups && (
        <LibraryMixedList
          groups={groups}
          openPostDetail={openPostDetail}
          sharePost={sharePost}
          isSharingPost={isSharingPost}
          activeProfileLibraryPage={activeProfileLibraryPage}
          formatTime={formatTime}
          clampText={clampText}
          formatHeatScore={formatHeatScore}
        />
      )}
    </>
  );
}
