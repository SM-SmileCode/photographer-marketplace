import mongoose from "mongoose";
import Message from "../models/message.js";
import Booking from "../models/booking.js";
import PhotographerProfile from "../models/photographerProfile.js";

async function canAccessBookingChat(userId, role, bookingId) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) return false;

  const booking = await Booking.findById(bookingId)
    .select("customerId photographerId")
    .lean();
  if (!booking) return false;

  if (role === "customer") {
    return String(booking.customerId) === String(userId);
  }

  if (role === "photographer") {
    const profile = await PhotographerProfile.findOne({ userId })
      .select("_id")
      .lean();
    if (!profile) return false;
    return String(booking.photographerId) === String(profile._id);
  }

  return role === "admin";
}

export async function getChatHistory(req, res) {
  try {
    const { bookingId } = req.params;
    const allowed = await canAccessBookingChat(req.user.userId, req.user.role, bookingId);
    if (!allowed) return res.status(403).json({ error: "forbidden" });

    const messages = await Message.find({ bookingId })
      .sort({ createdAt: 1 })
      .populate("senderId", "name profileImageUrl")
      .lean();

    return res.status(200).json({ messages });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch messages." });
  }
}

export async function markMessagesRead(req, res) {
  try {
    const { bookingId } = req.params;
    const allowed = await canAccessBookingChat(req.user.userId, req.user.role, bookingId);
    if (!allowed) return res.status(403).json({ error: "forbidden" });

    await Message.updateMany(
      { bookingId, readBy: { $ne: req.user.userId } },
      { $addToSet: { readBy: req.user.userId } },
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to mark messages read." });
  }
}

export async function getUnreadCount(req, res) {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    let bookingFilter = {};
    if (role === "customer") {
      bookingFilter = { customerId: userId };
    } else if (role === "photographer") {
      const profile = await PhotographerProfile.findOne({ userId }).select("_id").lean();
      if (!profile) return res.status(200).json({ unread: 0 });
      bookingFilter = { photographerId: profile._id };
    }

    const bookings = await Booking.find(bookingFilter).select("_id").lean();
    const bookingIds = bookings.map((b) => b._id);

    const unread = await Message.countDocuments({
      bookingId: { $in: bookingIds },
      senderId: { $ne: userId },
      readBy: { $ne: userId },
    });

    return res.status(200).json({ unread });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch unread count." });
  }
}
