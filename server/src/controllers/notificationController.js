import {
  listUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationAsRead,
} from "../services/notificationService.js";

export async function listMyNotifications(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const result = await listUserNotifications(req.user.userId, req.query || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to fetch notifications.",
    });
  }
}

export async function markMyNotificationRead(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const notification = await markUserNotificationAsRead({
      userId: req.user.userId,
      notificationId: req.params.notificationId,
    });

    return res.status(200).json({ success: true, notification });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to update notification.",
    });
  }
}

export async function markAllMyNotificationsRead(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const result = await markAllUserNotificationsRead(req.user.userId);
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to update notifications.",
    });
  }
}
