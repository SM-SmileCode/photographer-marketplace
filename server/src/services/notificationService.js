import mongoose from "mongoose";
import Notification from "../models/notification.js";
import { sendEmail } from "./emailService.js";
import { sendPushToUser } from "./pushService.js";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toObjectIdString(value, fieldName = "ID") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw { status: 400, message: `Invalid ${fieldName}.` };
  }
  return String(value);
}

export async function createInAppNotification({
  userId,
  type = "system",
  title,
  message,
  entityType = "",
  entityId = "",
  metadata = {},
}) {
  if (!title || typeof title !== "string") {
    throw { status: 400, message: "title is required." };
  }

  if (!message || typeof message !== "string") {
    throw { status: 400, message: "message is required." };
  }

  const created = await Notification.create({
    userId,
    type,
    title: title.trim(),
    message: message.trim(),
    entityType: String(entityType || "").trim(),
    entityId: String(entityId || "").trim(),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  });

  return created.toObject();
}

export async function notifyUser({
  userId,
  email = "",
  type = "system",
  title,
  message,
  entityType = "",
  entityId = "",
  metadata = {},
  emailSubject = "",
  emailText = "",
  emailHtml = "",
}) {
  const notification = await createInAppNotification({
    userId,
    type,
    title,
    message,
    entityType,
    entityId,
    metadata,
  });

  let emailResult = { sent: false, reason: "email_not_requested" };
  if (email && (emailSubject || emailText || emailHtml)) {
    emailResult = await sendEmail({
      to: email,
      subject: emailSubject || title,
      text: emailText || message,
      html: emailHtml,
    });
  }

  // Fire push notification silently — never block the main flow
  sendPushToUser(userId, { title, body: message, type, entityType, entityId }).catch(() => {});

  return { notification, email: emailResult };
}

export async function listUserNotifications(userId, query = {}) {
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  const skip = (page - 1) * limit;
  const unreadOnly = String(query.unreadOnly || "").toLowerCase() === "true";

  const filter = { userId };
  if (unreadOnly) {
    filter.isRead = false;
  }

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      unreadCount,
    },
  };
}

export async function markUserNotificationAsRead({ userId, notificationId }) {
  const id = toObjectIdString(notificationId, "notification ID");
  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { returnDocument: "after" },
  ).lean();

  if (!notification) {
    throw { status: 404, message: "Notification not found." };
  }

  return notification;
}

export async function markAllUserNotificationsRead(userId) {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );

  return {
    matched: Number(result.matchedCount || 0),
    modified: Number(result.modifiedCount || 0),
  };
}
