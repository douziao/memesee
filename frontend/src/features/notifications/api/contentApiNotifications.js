import { buildAuthHeaders } from "../../content/api/contentApiShared";
import { mapNotification } from "../../content/api/contentApiMappers";

/**
 * @param {{ get: Function }} client
 * @param {{ token?: string, limit?: number }} options
 */
export async function listNotifications(client, { token, limit }) {
  const response = await client.get("/api/notifications", {
    params: { limit },
    headers: buildAuthHeaders(token),
  });
  const payload = response?.data || {};
  return {
    unreadCount: Number(payload.unreadCount || 0),
    notifications: (Array.isArray(payload.items) ? payload.items : []).map(mapNotification),
  };
}

/**
 * @param {{ patch: Function }} client
 * @param {{ token?: string }} options
 */
export async function markAllNotificationsRead(client, { token }) {
  const response = await client.patch(
    "/api/notifications/read-state",
    null,
    {
      headers: buildAuthHeaders(token),
    },
  );
  const payload = response?.data || {};
  return {
    unreadCount: Number(payload.unreadCount || 0),
  };
}
