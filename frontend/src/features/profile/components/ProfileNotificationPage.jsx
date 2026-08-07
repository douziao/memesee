import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UiIcon from "../../../shared/components/UiIcon";
import { buildPostSummaryText } from "../../../shared/platform/postSummaryText";
import { UI_MESSAGES } from "../../../shared/state/uiMessages";
import { normalizeProfilePositiveId } from "../state/profileIdHelpers";

const NOTIFICATION_PAGE_LIMIT = 100;
const UNAVAILABLE_NOTIFICATION_TEXT = "缺少可打开的主帖信息";
const DELETED_POST_NOTIFICATION_TEXT = "关联主帖已删除";
const DELETED_SUB_POST_NOTIFICATION_TEXT = "关联子帖已删除，将打开主帖";
const DELETED_POST_NOTIFICATION_DETAIL = "这条通知关联的主帖已删除。";
const DELETED_SUB_POST_NOTIFICATION_DETAIL = "这条通知关联的子帖已删除。";
const MEDIA_ONLY_SUB_POST_NOTIFICATION_TEXT = "图片子帖";

function notificationKey(item, index) {
  return `notification-${item.id || item.createdAt || index}`;
}

export function normalizeNotificationPostId(value) {
  return normalizeProfilePositiveId(value);
}

function firstValidNotificationPostId(first, second) {
  return normalizeNotificationPostId(first) || normalizeNotificationPostId(second);
}

export function resolveNotificationPostAccess(item) {
  const postId = firstValidNotificationPostId(item?.postId, item?.mainPostId);
  const unavailableReason = String(item?.unavailableReason || "").trim();
  const isDeletedSubPost = unavailableReason === "sub-post-deleted";
  const isDeletedPost = unavailableReason === "post-deleted";
  const targetSubPostId = isDeletedSubPost
    ? 0
    : firstValidNotificationPostId(item?.subPostId, item?.targetSubPostId);
  const canOpenPost = postId > 0 && !isDeletedPost;
  const unavailableText = isDeletedPost
    ? DELETED_POST_NOTIFICATION_TEXT
    : postId <= 0
    ? UNAVAILABLE_NOTIFICATION_TEXT
    : isDeletedSubPost
      ? DELETED_SUB_POST_NOTIFICATION_TEXT
      : "";
  return {
    postId,
    targetLabel: targetSubPostId ? "定位子帖" : "",
    openOptions: targetSubPostId ? { targetSubPostId } : {},
    canOpenPost,
    unavailableText,
  };
}

function notificationIcon(type) {
  switch (String(type || "").toUpperCase()) {
    case "MAIN_POST_LIKED":
    case "POST_LIKE":
    case "SUB_POST_LIKED":
      return "heart-filled";
    case "MAIN_POST_FAVORITED":
    case "POST_FAVORITE":
    case "SUB_POST_FAVORITED":
      return "star-filled";
    case "SUB_POST_CREATED":
    case "POST_REPLY":
    case "SUB_POST_REPLIED":
      return "sub-post";
    default:
      return "bell";
  }
}

function notificationCategory(type) {
  switch (String(type || "").toUpperCase()) {
    case "MAIN_POST_LIKED":
    case "POST_LIKE":
    case "SUB_POST_LIKED":
      return "liked";
    case "MAIN_POST_FAVORITED":
    case "POST_FAVORITE":
    case "SUB_POST_FAVORITED":
      return "favorite";
    case "SUB_POST_CREATED":
    case "POST_REPLY":
    case "SUB_POST_REPLIED":
      return "reply";
    default:
      return "other";
  }
}

const NOTIFICATION_GROUPS = [
  { key: "all", title: "全部", icon: "bell" },
  { key: "liked", title: "点赞", icon: "heart-filled" },
  { key: "favorite", title: "收藏", icon: "star-filled" },
  { key: "reply", title: "回复", icon: "sub-post" },
  { key: "other", title: "其他", icon: "bell" },
];

function notificationTabId(key) {
  return `profile-notification-tab-${key}`;
}

function notificationPanelId(key) {
  return `profile-notification-panel-${key}`;
}

export function notificationTabLabel(group) {
  return `${group.title}通知，${group.items.length} 条`;
}

export function resolveNotificationTabKeyAction({
  key,
  currentKey,
  groups,
}) {
  const list = Array.isArray(groups) ? groups : [];
  const currentIndex = list.findIndex((group) => group.key === currentKey);
  if (currentIndex < 0 || list.length === 0) {
    return "";
  }
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return list[(currentIndex + 1) % list.length].key;
    case "ArrowLeft":
    case "ArrowUp":
      return list[(currentIndex - 1 + list.length) % list.length].key;
    case "Home":
      return list[0].key;
    case "End":
      return list[list.length - 1].key;
    default:
      return "";
  }
}

function groupNotifications(notifications) {
  const buckets = new Map(NOTIFICATION_GROUPS.map((group) => [group.key, []]));
  buckets.set("all", notifications);
  notifications.forEach((item) => {
    const key = notificationCategory(item.type);
    const list = buckets.get(key) || buckets.get("other");
    list.push(item);
  });
  return NOTIFICATION_GROUPS
    .map((group) => ({
      ...group,
      items: buckets.get(group.key) || [],
    }));
}

export function shouldShowNotificationGroups(notifications) {
  return Array.isArray(notifications) && notifications.length > 0;
}

export function buildNotificationAccessSummary(notifications) {
  const list = Array.isArray(notifications) ? notifications : [];
  const summary = list.reduce((result, item) => {
    const access = resolveNotificationPostAccess(item);
    if (!access.canOpenPost) {
      return {
        ...result,
        unavailableCount: result.unavailableCount + 1,
      };
    }
    if (access.unavailableText) {
      return {
        ...result,
        fallbackToMainPostCount: result.fallbackToMainPostCount + 1,
      };
    }
    return result;
  }, {
    unavailableCount: 0,
    fallbackToMainPostCount: 0,
  });
  const parts = [];
  if (summary.unavailableCount > 0) {
    parts.push(`${summary.unavailableCount} 条通知关联内容不可用，已禁用打开入口`);
  }
  if (summary.fallbackToMainPostCount > 0) {
    parts.push(`${summary.fallbackToMainPostCount} 条子帖通知将打开主帖`);
  }
  return {
    ...summary,
    message: parts.length > 0 ? `${parts.join("；")}。` : "",
  };
}

function actorInitial(name) {
  const value = String(name || "").trim();
  return value ? value.slice(0, 1).toUpperCase() : "?";
}

function removeActorPrefix(text, actorUsername) {
  const value = String(text || "").trim();
  const actor = String(actorUsername || "").trim();
  if (actor && value.startsWith(actor)) {
    return value.slice(actor.length).trim();
  }
  return value;
}

function extractQuotedTitle(text) {
  const match = String(text || "").match(/《([^》]+)》/);
  return match?.[1] || "";
}

function extractPreview(text) {
  const match = String(text || "").match(/[：:]\s*[“"]?(.+?)[”"]?\s*$/);
  return match?.[1] || "";
}

function cleanNotificationDetailText(value) {
  return buildPostSummaryText({ post: { content: value || "" } });
}

function normalizeLegacySubPostPreview(value) {
  const text = String(value || "").trim();
  return text === "无内容" ? MEDIA_ONLY_SUB_POST_NOTIFICATION_TEXT : text;
}

function normalizeLegacySubPostBody(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (text === "无内容") {
    return MEDIA_ONLY_SUB_POST_NOTIFICATION_TEXT;
  }
  return text.replace(/([：:])\s*无内容$/, `$1${MEDIA_ONLY_SUB_POST_NOTIFICATION_TEXT}`);
}

export function notificationDetail(item) {
  const type = String(item.type || "").toUpperCase();
  const unavailableReason = String(item.unavailableReason || "").trim();
  if (unavailableReason === "post-deleted") {
    return DELETED_POST_NOTIFICATION_DETAIL;
  }
  if (unavailableReason === "sub-post-deleted") {
    return DELETED_SUB_POST_NOTIFICATION_DETAIL;
  }
  const rawBody = removeActorPrefix(item.body, item.actorUsername);
  const body = cleanNotificationDetailText(rawBody);
  const quotedTitle = cleanNotificationDetailText(extractQuotedTitle(rawBody));
  const preview = cleanNotificationDetailText(extractPreview(rawBody));
  const normalizedSubPostPreview = normalizeLegacySubPostPreview(preview);
  const postTitle = quotedTitle || cleanNotificationDetailText(item.postTitle) || "主帖";

  switch (type) {
    case "MAIN_POST_LIKED":
    case "POST_LIKE":
    case "MAIN_POST_FAVORITED":
    case "POST_FAVORITE":
      return `《${postTitle}》`;
    case "SUB_POST_CREATED":
    case "POST_REPLY":
    case "SUB_POST_REPLIED":
      return normalizeLegacySubPostBody(body) || `《${postTitle}》下的子帖`;
    case "SUB_POST_LIKED":
    case "SUB_POST_FAVORITED":
      return normalizedSubPostPreview
        ? `${normalizedSubPostPreview} · 《${postTitle}》`
        : `《${postTitle}》下的子帖`;
    default:
      return body || item.title || "查看详情";
  }
}

export function buildNotificationPageSyncStatus({
  syncing,
  error,
  hasNotifications,
}) {
  if (syncing) {
    return {
      type: "syncing",
      message: "正在同步最新通知...",
    };
  }
  if (error) {
    return {
      type: hasNotifications ? "stale-error" : "error",
      message: error,
      actionLabel: "重新同步",
    };
  }
  return { type: "" };
}

function ProfileNotificationToolbar({
  unreadCount,
  syncing,
  onRefresh,
}) {
  return (
    <div className="profile-library-page-head profile-notification-page-head">
      <h3>通知</h3>
      <span className="profile-notification-toolbar-actions">
        <span className="profile-stat-pill">
          {unreadCount > 0 ? `未读 ${unreadCount > 99 ? "99+" : unreadCount}` : "无未读"}
        </span>
        <button
          type="button"
          className="neo-btn small secondary"
          onClick={onRefresh}
          disabled={syncing}
        >
          {syncing ? "同步中" : "刷新"}
        </button>
      </span>
    </div>
  );
}

function NotificationRow({
  item,
  index,
  markNotificationReadLocally,
  navigateToPost,
  formatTime,
}) {
  const {
    postId,
    openOptions,
    targetLabel,
    canOpenPost,
    unavailableText,
  } = resolveNotificationPostAccess(item);
  const category = notificationCategory(item.type);
  const actorName = item.actorUsername || "用户";

  return (
    <button
      key={notificationKey(item, index)}
      type="button"
      className={`profile-library-entry profile-notification-entry profile-notification-entry-${category} ${item.read ? "" : "unread"} ${canOpenPost ? "" : "unavailable"}`}
      title={unavailableText || undefined}
      onClick={() => {
        if (canOpenPost) {
          markNotificationReadLocally?.(item.id);
          navigateToPost(postId, openOptions);
        }
      }}
      disabled={!canOpenPost}
    >
      <span className="profile-notification-action-icon" aria-hidden="true">
        <UiIcon name={notificationIcon(item.type)} />
      </span>
      <span className="profile-library-entry-main profile-notification-main">
        <span className="profile-notification-actor-line">
          <span className="profile-notification-avatar" aria-hidden="true">
            {actorInitial(actorName)}
          </span>
          <strong>{actorName}</strong>
          <em>{formatTime(item.createdAt, item.createdAtText)}</em>
        </span>
        <span className="profile-notification-detail">{notificationDetail(item)}</span>
        {canOpenPost && targetLabel && (
          <span className="profile-notification-target">{targetLabel}</span>
        )}
        {unavailableText && (
          <span className="profile-notification-unavailable">{unavailableText}</span>
        )}
      </span>
      <UiIcon name="chevron-right" />
    </button>
  );
}

export default function ProfileNotificationPage({
  activeProfileNotificationPage,
  notifications,
  notificationUnreadCount,
  loadNotifications,
  markNotificationsRead,
  markNotificationReadLocally,
  navigateToPost,
  formatTime,
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [syncingNotifications, setSyncingNotifications] = useState(false);
  const [notificationSyncError, setNotificationSyncError] = useState("");
  const notificationTabRefs = useRef(new Map());
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const activeGroup = groups.find((group) => group.key === activeCategory) || groups[0];
  const activeItems = activeGroup?.items || [];
  const showNotificationGroups = shouldShowNotificationGroups(notifications);
  const notificationAccessSummary = useMemo(
    () => buildNotificationAccessSummary(notifications),
    [notifications],
  );
  const syncStatus = buildNotificationPageSyncStatus({
    syncing: syncingNotifications,
    error: notificationSyncError,
    hasNotifications: notifications.length > 0,
  });
  const activePanelId = notificationPanelId(activeGroup?.key || "all");
  const activeTabId = notificationTabId(activeGroup?.key || "all");

  const registerNotificationTab = useCallback((key) => (node) => {
    if (node) {
      notificationTabRefs.current.set(key, node);
      return;
    }
    notificationTabRefs.current.delete(key);
  }, []);

  const handleNotificationTabKeyDown = useCallback((event) => {
    const nextCategory = resolveNotificationTabKeyAction({
      key: event.key,
      currentKey: activeCategory,
      groups,
    });
    if (!nextCategory) {
      return;
    }
    event.preventDefault();
    setActiveCategory(nextCategory);
    notificationTabRefs.current.get(nextCategory)?.focus();
  }, [activeCategory, groups]);

  const syncNotificationPage = useCallback(async ({ isActive = () => true } = {}) => {
    if (!isActive()) {
      return null;
    }
    setSyncingNotifications(true);
    setNotificationSyncError("");
    const payload = await loadNotifications(undefined, {
      limit: NOTIFICATION_PAGE_LIMIT,
      silent: true,
    });
    if (!isActive()) {
      return null;
    }
    if (!payload) {
      setNotificationSyncError(UI_MESSAGES.notificationsLoadFailed);
      setSyncingNotifications(false);
      return null;
    }
    const unread = Number(payload?.unreadCount || 0);
    if (unread > 0) {
      const markPayload = await markNotificationsRead(undefined, { silent: true });
      if (!isActive()) {
        return null;
      }
      if (!markPayload) {
        setNotificationSyncError(UI_MESSAGES.notificationsMarkReadFailed);
      }
    }
    setSyncingNotifications(false);
    return payload;
  }, [loadNotifications, markNotificationsRead]);

  useEffect(() => {
    if (!activeProfileNotificationPage) {
      return undefined;
    }
    let active = true;
    (async () => {
      await syncNotificationPage({ isActive: () => active });
    })();
    return () => {
      active = false;
    };
  }, [
    activeProfileNotificationPage,
    syncNotificationPage,
  ]);

  useEffect(() => {
    if (!groups.some((group) => group.key === activeCategory)) {
      setActiveCategory("all");
    }
  }, [activeCategory, groups]);

  return (
    <>
      <ProfileNotificationToolbar
        unreadCount={notificationUnreadCount}
        syncing={syncingNotifications}
        onRefresh={syncNotificationPage}
      />

      {syncStatus.type && (
        <div
          className={`paper-inline-status profile-empty-inline profile-notification-sync-status ${syncStatus.type === "error" || syncStatus.type === "stale-error" ? "is-error" : ""}`}
          role={syncStatus.type === "syncing" ? "status" : "alert"}
          aria-live={syncStatus.type === "syncing" ? "polite" : "assertive"}
        >
          <span>{syncStatus.message}</span>
          {syncStatus.actionLabel && (
            <button
              type="button"
              className="neo-btn small"
              onClick={syncNotificationPage}
              disabled={syncingNotifications}
            >
              {syncStatus.actionLabel}
            </button>
          )}
        </div>
      )}

      {notifications.length === 0 && !syncStatus.type && (
        <div className="paper-inline-status profile-empty-inline">暂无通知。</div>
      )}
      {showNotificationGroups && (
        <>
          {notificationAccessSummary.message && (
            <div className="paper-inline-status profile-empty-inline profile-unavailable-inline">
              {notificationAccessSummary.message}
            </div>
          )}
          <div className="profile-notification-tabs" role="tablist" aria-label="通知分类">
            {groups.map((group) => (
              <button
                key={group.key}
                ref={registerNotificationTab(group.key)}
                type="button"
                id={notificationTabId(group.key)}
                role="tab"
                aria-selected={group.key === activeCategory}
                aria-controls={notificationPanelId(group.key)}
                aria-label={notificationTabLabel(group)}
                tabIndex={group.key === activeCategory ? 0 : -1}
                className={`profile-notification-tab profile-notification-tab-${group.key} ${group.key === activeCategory ? "active" : ""}`}
                onClick={() => setActiveCategory(group.key)}
                onKeyDown={handleNotificationTabKeyDown}
              >
                <UiIcon name={group.icon} />
                <span>{group.title}</span>
                <strong>{group.items.length}</strong>
              </button>
            ))}
          </div>
          <div
            id={activePanelId}
            className="profile-notification-grid"
            role="tabpanel"
            aria-labelledby={activeTabId}
          >
            {activeItems.map((item, index) => (
              <NotificationRow
                key={notificationKey(item, index)}
                item={item}
                index={index}
                markNotificationReadLocally={markNotificationReadLocally}
                navigateToPost={navigateToPost}
                formatTime={formatTime}
              />
            ))}
            {activeItems.length === 0 && (
              <div className="paper-inline-status profile-empty-inline">暂无{activeGroup?.title || ""}通知。</div>
            )}
          </div>
        </>
      )}
    </>
  );
}
