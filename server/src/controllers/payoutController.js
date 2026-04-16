import mongoose from "mongoose";
import Payout from "../models/payout.js";
import Booking from "../models/booking.js";
import PhotographerProfile from "../models/photographerProfile.js";

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function listPayouts(req, res) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "").trim();

    const filter = {};
    if (["pending", "processing", "paid", "failed"].includes(status)) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      Payout.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("photographerId", "businessName city userId")
        .populate("processedById", "name email")
        .lean(),
      Payout.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list payouts." });
  }
}

export async function createPayout(req, res) {
  try {
    const { photographerId, amount, currency = "INR", note = "", bookingIds = [] } = req.body || {};

    if (!photographerId || !mongoose.Types.ObjectId.isValid(photographerId)) {
      return res.status(400).json({ error: "Valid photographerId is required." });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "amount must be a positive number." });
    }

    const profile = await PhotographerProfile.findById(photographerId).select("_id").lean();
    if (!profile) return res.status(404).json({ error: "Photographer profile not found." });

    const payout = await Payout.create({
      photographerId,
      amount: Number(amount),
      currency,
      note: String(note).trim(),
      bookingIds: Array.isArray(bookingIds) ? bookingIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) : [],
      status: "pending",
    });

    return res.status(201).json({ success: true, payout });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create payout." });
  }
}

export async function updatePayoutStatus(req, res) {
  try {
    const { payoutId } = req.params;
    const { status, note = "" } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(payoutId)) {
      return res.status(400).json({ error: "Invalid payout ID." });
    }
    if (!["pending", "processing", "paid", "failed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const update = {
      status,
      processedById: req.user.userId,
    };
    if (note) update.note = String(note).trim();
    if (status === "paid") update.paidAt = new Date();

    const payout = await Payout.findByIdAndUpdate(
      payoutId,
      { $set: update },
      { returnDocument: "after", runValidators: true },
    )
      .populate("photographerId", "businessName city")
      .lean();

    if (!payout) return res.status(404).json({ error: "Payout not found." });

    return res.status(200).json({ success: true, payout });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to update payout." });
  }
}

export async function getPayoutSummary(req, res) {
  try {
    const [pending, processing, paid, totalPaidAgg] = await Promise.all([
      Payout.countDocuments({ status: "pending" }),
      Payout.countDocuments({ status: "processing" }),
      Payout.countDocuments({ status: "paid" }),
      Payout.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    return res.status(200).json({
      pending,
      processing,
      paid,
      totalPaid: Math.round(totalPaidAgg?.[0]?.total || 0),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch payout summary." });
  }
}
