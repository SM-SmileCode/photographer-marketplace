import mongoose from "mongoose";
import Booking from "../models/booking.js";
import AvailabilityOverride from "../models/availabilityOverride.js";
import PhotographerAvailability from "../models/photographerAvailability.js";
import PhotographerProfile from "../models/photographerProfile.js";
import {
  addDaysToDateKey,
  filterConflictingSlots,
  generateSlotsForDate,
  isValidDateKey,
  zonedDateTimeToUtc,
} from "../utils/availabilityUtils.js";

const AVAILABILITY_EDITABLE_FIELDS = new Set([
  "timezone",
  "slotStepMinutes",
  "minSessionMinutes",
  "maxSessionMinutes",
  "defaultSessionMinutes",
  "bufferBeforeMinutes",
  "bufferAfterMinutes",
  "minNoticeMinutes",
  "maxAdvanceDays",
  "bookingMode",
  "isActive",
  "weeklySchedule",
  "vacationMode",
  "vacationFrom",
  "vacationTo",
  "vacationNote",
]);

function pickAvailabilityFields(body) {
  const updates = {};

  for (const key of Object.keys(body || {})) {
    if (AVAILABILITY_EDITABLE_FIELDS.has(key)) {
      updates[key] = body[key];
    }
  }

  return updates;
}

async function getPhotographerProfileIdForUser(userId) {
  const profile = await PhotographerProfile.findOne({ userId })
    .select("_id")
    .lean();

  if (!profile) {
    throw new Error("PHOTOGRAPHER_PROFILE_NOT_FOUND");
  }

  return profile._id;
}

async function getOrCreateAvailability(photographerId) {
  let availability = await PhotographerAvailability.findOne({ photographerId });

  if (!availability) {
    availability = await PhotographerAvailability.create({ photographerId });
  }

  return availability;
}

async function expirePendingAvailabilityBookings(photographerId) {
  const now = new Date();

  await Booking.updateMany(
    {
      photographerId,
      status: "pending",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "expired" },
      $push: {
        statusHistory: {
          fromStatus: "pending",
          toStatus: "expired",
          changedById: null,
          changedByRole: "system",
          note: "Booking request expired",
          changedAt: now,
        },
      },
    },
  );
}

export async function getMyAvailability(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const photographerId = await getPhotographerProfileIdForUser(req.user.userId);
    const availability = await getOrCreateAvailability(photographerId);

    return res.status(200).json({ availability });
  } catch (error) {
    if (error?.message === "PHOTOGRAPHER_PROFILE_NOT_FOUND") {
      return res.status(404).json({ error: "Photographer profile not found." });
    }

    return res.status(500).json({ error: "Failed to fetch availability." });
  }
}

export async function upsertMyAvailability(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const updates = pickAvailabilityFields(req.body);

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No valid availability fields provided." });
    }

    const photographerId = await getPhotographerProfileIdForUser(req.user.userId);
    const availability = await getOrCreateAvailability(photographerId);

    Object.assign(availability, updates);
    await availability.save();

    return res.status(200).json({ success: true, availability });
  } catch (error) {
    if (error?.message === "PHOTOGRAPHER_PROFILE_NOT_FOUND") {
      return res.status(404).json({ error: "Photographer profile not found." });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error?.message || "Failed to save availability." });
  }
}

export async function listMyAvailabilityOverrides(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const photographerId = await getPhotographerProfileIdForUser(req.user.userId);
    const filter = { photographerId };

    if (req.query.dateFrom || req.query.dateTo) {
      filter.date = {};

      if (req.query.dateFrom) {
        if (!isValidDateKey(req.query.dateFrom)) {
          return res.status(400).json({ error: "dateFrom must be YYYY-MM-DD." });
        }

        filter.date.$gte = req.query.dateFrom;
      }

      if (req.query.dateTo) {
        if (!isValidDateKey(req.query.dateTo)) {
          return res.status(400).json({ error: "dateTo must be YYYY-MM-DD." });
        }

        filter.date.$lte = req.query.dateTo;
      }
    }

    const items = await AvailabilityOverride.find(filter).sort({ date: 1 }).lean();

    return res.status(200).json({ items });
  } catch (error) {
    if (error?.message === "PHOTOGRAPHER_PROFILE_NOT_FOUND") {
      return res.status(404).json({ error: "Photographer profile not found." });
    }

    return res.status(500).json({ error: "Failed to fetch availability overrides." });
  }
}

export async function upsertMyAvailabilityOverride(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { date } = req.params;

    if (!isValidDateKey(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD." });
    }

    const { mode, windows = [], note = "" } = req.body || {};

    if (!["blocked", "custom_windows"].includes(mode)) {
      return res.status(400).json({ error: "mode must be blocked or custom_windows." });
    }

    const photographerId = await getPhotographerProfileIdForUser(req.user.userId);
    let override = await AvailabilityOverride.findOne({ photographerId, date });

    if (!override) {
      override = new AvailabilityOverride({ photographerId, date });
    }

    override.mode = mode;
    override.windows = windows;
    override.note = note;
    override.source = "photographer";

    await override.save();

    return res.status(200).json({ success: true, override });
  } catch (error) {
    if (error?.message === "PHOTOGRAPHER_PROFILE_NOT_FOUND") {
      return res.status(404).json({ error: "Photographer profile not found." });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error?.message || "Failed to save availability override." });
  }
}

export async function deleteMyAvailabilityOverride(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { date } = req.params;

    if (!isValidDateKey(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD." });
    }

    const photographerId = await getPhotographerProfileIdForUser(req.user.userId);
    const deleted = await AvailabilityOverride.findOneAndDelete({
      photographerId,
      date,
    }).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Availability override not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error?.message === "PHOTOGRAPHER_PROFILE_NOT_FOUND") {
      return res.status(404).json({ error: "Photographer profile not found." });
    }

    return res.status(500).json({ error: "Failed to delete availability override." });
  }
}

export async function bulkBlockDates(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { from, to, note = "" } = req.body || {};

    if (!isValidDateKey(from) || !isValidDateKey(to)) {
      return res.status(400).json({ error: "from and to must be YYYY-MM-DD." });
    }

    if (from > to) {
      return res.status(400).json({ error: "from must be before or equal to to." });
    }

    const photographerId = await getPhotographerProfileIdForUser(req.user.userId);

    const dates = [];
    let current = from;
    while (current <= to) {
      dates.push(current);
      const d = new Date(current);
      d.setDate(d.getDate() + 1);
      current = d.toISOString().slice(0, 10);
    }

    if (dates.length > 90) {
      return res.status(400).json({ error: "Cannot block more than 90 days at once." });
    }

    const ops = dates.map((date) => ({
      updateOne: {
        filter: { photographerId, date },
        update: { $set: { photographerId, date, mode: "blocked", windows: [], note: String(note || "").trim(), source: "photographer" } },
        upsert: true,
      },
    }));

    await AvailabilityOverride.bulkWrite(ops);

    return res.status(200).json({ success: true, blockedCount: dates.length });
  } catch (error) {
    if (error?.message === "PHOTOGRAPHER_PROFILE_NOT_FOUND") {
      return res.status(404).json({ error: "Photographer profile not found." });
    }
    return res.status(500).json({ error: error?.message || "Failed to bulk block dates." });
  }
}

export async function getPhotographerAvailableSlots(req, res) {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const durationMinutes = req.query.durationMinutes
      ? Number.parseInt(req.query.durationMinutes, 10)
      : undefined;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid photographer ID." });
    }

    if (!isValidDateKey(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD." });
    }

    if (
      durationMinutes != null &&
      (!Number.isInteger(durationMinutes) || durationMinutes <= 0)
    ) {
      return res
        .status(400)
        .json({ error: "durationMinutes must be a positive integer." });
    }

    const photographer = await PhotographerProfile.findOne({
      _id: id,
      isActive: true,
      verificationStatus: "approved",
    })
      .select("_id")
      .lean();

    if (!photographer) {
      return res.status(404).json({ error: "Photographer not found." });
    }

    await expirePendingAvailabilityBookings(photographer._id);

    const availability = await PhotographerAvailability.findOne({
      photographerId: photographer._id,
    }).lean();

    if (!availability) {
      return res.status(200).json({
        date,
        timezone: "Asia/Kolkata",
        durationMinutes: durationMinutes ?? null,
        bookingMode: "request_only",
        slots: [],
      });
    }

    const override = await AvailabilityOverride.findOne({
      photographerId: photographer._id,
      date,
    }).lean();

    const dayStartUtc = zonedDateTimeToUtc(date, 0, availability.timezone);
    const dayEndUtc = zonedDateTimeToUtc(
      addDaysToDateKey(date, 1),
      0,
      availability.timezone,
    );

    const bookings = await Booking.find({
      photographerId: photographer._id,
      status: { $in: ["pending", "accepted"] },
      startAtUtc: { $lt: dayEndUtc },
      endAtUtc: { $gt: dayStartUtc },
    })
      .select("startAtUtc endAtUtc")
      .lean();

    const generatedSlots = generateSlotsForDate({
      availability,
      dateKey: date,
      override,
      sessionMinutes: durationMinutes,
    });

    const slots = filterConflictingSlots({
      slots: generatedSlots,
      bookings,
      bufferBeforeMinutes: availability.bufferBeforeMinutes,
      bufferAfterMinutes: availability.bufferAfterMinutes,
    });

    return res.status(200).json({
      date,
      timezone: availability.timezone,
      durationMinutes: durationMinutes ?? availability.defaultSessionMinutes,
      slotStepMinutes: availability.slotStepMinutes,
      bookingMode: availability.bookingMode || "request_only",
      slots,
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to fetch photographer availability.",
    });
  }
}
