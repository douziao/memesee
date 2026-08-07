import { useCallback, useEffect, useState } from "react";
import {
  listNotifications as listContentNotifications,
  markAllNotificationsRead as markAllContentNotificationsRead,
} from "../../content/api/contentApi";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";

export function normalizeNotificationUnreadCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function markNotificationItemsRead(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    read: true,
  }));
}

function normalizeNotificationId(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function firstValidNotificationId(first, second) {
  return normalizeNotificationId(first) || normalizeNotificationId(second);
}

export function markNotificationItemReadById(items, notificationId) {
  const id = normalizeNotificationId(notificationId);
  const list = Array.isArray(items) ? items : [];
  if (!id) {
    return {
      items: list,
      readDelta: 0,
    };
  }
  let readDelta = 0;
  const nextItems = list.map((item) => {
    if (normalizeNotificationId(item?.id) !== id || item?.read) {
      return item;
    }
    readDelta += 1;
    return {
      ...item,
      read: true,
    };
  });
  return {
    items: readDelta > 0 ? nextItems : list,
    readDelta,
  };
}

function normalizeNotificationPostTitle(value) {
  return String(value || "").trim();
}

function replaceNotificationBodyQuotedTitle(body, postTitle) {
  const value = String(body || "");
  if (!value || !postTitle || !/《[^》]+》/.test(value)) {
    return body;
  }
  return value.replace(/《[^》]+》/, `《${postTitle}》`);
}

export function syncNotificationItemsForPostSnapshot(items, postSnapshot) {
  const postId = normalizeNotificationId(postSnapshot?.id)
    || firstValidNotificationId(postSnapshot?.postId, postSnapshot?.mainPostId);
  const postTitle = normalizeNotificationPostTitle(postSnapshot?.title || postSnapshot?.postTitle);
  const list = Array.isArray(items) ? items : [];
  if (!postId || !postTitle) {
    return list;
  }
  return list.map((item) => {
    if (firstValidNotificationId(item?.postId, item?.mainPostId) !== postId) {
      return item;
    }
    return {
      ...item,
      postTitle,
      body: replaceNotificationBodyQuotedTitle(item?.body, postTitle),
    };
  });
}

export function markNotificationItemsPostUnavailable(items, mainPostId) {
  const postId = normalizeNotificationId(mainPostId);
  const list = Array.isArray(items) ? items : [];
  if (!postId) {
    return list;
  }
  return list.map((item) =>
    firstValidNotificationId(item?.postId, item?.mainPostId) !== postId
      ? item
      : {
      ...item,
      postId: null,
      mainPostId: null,
      subPostId: null,
      targetSubPostId: null,
      unavailableReason: "post-deleted",
      },
  );
}

export function markNotificationItemsSubPostUnavailable(items, subPostId) {
  const normalizedSubPostId = normalizeNotificationId(subPostId);
  const list = Array.isArray(items) ? items : [];
  if (!normalizedSubPostId) {
    return list;
  }
  return list.map((item) =>
    firstValidNotificationId(item?.subPostId, item?.targetSubPostId) !== normalizedSubPostId
      ? item
      : {
      ...item,
      subPostId: null,
      targetSubPostId: null,
      unavailableReason: "sub-post-deleted",
      },
  );
}

export function useNotifications({
  client,
  token,
  isLoggedIn,
  currentUser,
  setMessage,
  pageSize,
}) {
  const [notifications, setNotifications] = useState([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const loadNotifications = useCallback(async (authToken = token, options = {}) => {
    if (!authToken) {
      setNotifications([]);
      setNotificationUnreadCount(0);
      return null;
    }
    try {
      const payload = await listContentNotifications(client, {
        token: authToken,
        limit: Number(options.limit || pageSize),
      });
      const nextList = Array.isArray(payload.notifications) ? payload.notifications : [];
      setNotifications(nextList);
      setNotificationUnreadCount(normalizeNotificationUnreadCount(payload.unreadCount));
      return payload;
    } catch (error) {
      if (!options.silent) {
        setMessage(readableError(error, UI_MESSAGES.notificationsLoadFailed));
      }
      return null;
    }
  }, [client, pageSize, setMessage, token]);

  const markNotificationsRead = useCallback(async (authToken = token, options = {}) => {
    if (!authToken) {
      setNotificationUnreadCount(0);
      return null;
    }
    try {
      const payload = await markAllContentNotificationsRead(client, { token: authToken });
      setNotificationUnreadCount(normalizeNotificationUnreadCount(payload?.unreadCount));
      setNotifications(markNotificationItemsRead);
      return payload;
    } catch (error) {
      if (!options.silent) {
        setMessage(readableError(error, UI_MESSAGES.notificationsMarkReadFailed));
      }
      return null;
    }
  }, [client, setMessage, token]);

  const markNotificationReadLocally = useCallback((notificationId) => {
    setNotifications((items) => {
      const result = markNotificationItemReadById(items, notificationId);
      if (result.readDelta > 0) {
        setNotificationUnreadCount((count) => Math.max(
          0,
          normalizeNotificationUnreadCount(count) - result.readDelta,
        ));
      }
      return result.items;
    });
  }, []);

  function resetNotifications() {
    setNotifications([]);
    setNotificationUnreadCount(0);
  }

  const syncNotificationPostSnapshot = useCallback((postSnapshot) => {
    setNotifications((items) => syncNotificationItemsForPostSnapshot(items, postSnapshot));
  }, []);

  const markNotificationPostUnavailable = useCallback((mainPostId) => {
    setNotifications((items) => markNotificationItemsPostUnavailable(items, mainPostId));
  }, []);

  const markNotificationSubPostUnavailable = useCallback((subPostId) => {
    setNotifications((items) => markNotificationItemsSubPostUnavailable(items, subPostId));
  }, []);

  useEffect(() => {
    if (isLoggedIn && token && currentUser) {
      return;
    }
    resetNotifications();
  }, [isLoggedIn, token, currentUser]);

  useEffect(() => {
    if (!isLoggedIn || !token) {
      return;
    }
    const syncNotifications = () => loadNotifications(token, { silent: true });
    syncNotifications();
    const interval = window.setInterval(syncNotifications, 30000);
    return () => {
      window.clearInterval(interval);
    };
  }, [currentUser, isLoggedIn, loadNotifications, token]);

  return {
    notifications,
    notificationUnreadCount,
    loadNotifications,
    markNotificationsRead,
    markNotificationReadLocally,
    resetNotifications,
    syncNotificationPostSnapshot,
    markNotificationPostUnavailable,
    markNotificationSubPostUnavailable,
  };
}
