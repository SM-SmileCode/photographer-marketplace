import {
  SAFE_API_URL,
  apiCall,
  parseResponse,
  toQuery,
  validateId,
} from "./apiClient.js";

export async function fetchMyNotifications(params = {}) {
  const q = toQuery(params);
  const res = await apiCall(
    `${SAFE_API_URL}/notifications/me${q ? `?${q}` : ""}`,
  );
  return parseResponse(res, "Failed to fetch notifications.");
}

export async function markMyNotificationRead(notificationId) {
  const validatedId = validateId(notificationId, "Notification ID");
  const res = await apiCall(
    `${SAFE_API_URL}/notifications/me/${validatedId}/read`,
    {
      method: "PATCH",
    },
  );

  return parseResponse(res, "Failed to update notification.");
}

export async function markAllMyNotificationsRead() {
  const res = await apiCall(`${SAFE_API_URL}/notifications/me/read-all`, {
    method: "PATCH",
  });
  return parseResponse(res, "Failed to update notifications.");
}
