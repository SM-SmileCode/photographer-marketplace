import mongoose from "mongoose";
import PhotographerProfile from "../models/photographerProfile.js";
import PhotographerAvailability from "../models/photographerAvailability.js";

import {
  PROFILE_EDITABLE_FIELDS,
  EVENT_TYPES,
  SERVICES,
} from "../config/photographerProfileConfig.js";

const EDITABLE_FIELDS = new Set(PROFILE_EDITABLE_FIELDS);

function pickEditableFields(body) {
  const out = {};
  for (const key of Object.keys(body || {})) {
    if (EDITABLE_FIELDS.has(key)) out[key] = body[key];
  }
  return out;
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTrueLike(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function withBookingMode(profile, availability) {
  const bookingMode =
    availability?.isActive && availability?.bookingMode === "instant"
      ? "instant"
      : "request_only";

  return {
    ...profile,
    bookingMode,
    isInstantBooking: bookingMode === "instant",
  };
}

async function findActiveInstantAvailabilityProfileIds() {
  const instantAvailabilities = await PhotographerAvailability.find({
    bookingMode: "instant",
    isActive: true,
  })
    .select("photographerId")
    .lean();

  return instantAvailabilities
    .map((doc) => doc?.photographerId)
    .filter(Boolean);
}

async function buildInstantModeMap(photographerIds = []) {
  if (!Array.isArray(photographerIds) || photographerIds.length === 0) {
    return new Map();
  }

  const availabilities = await PhotographerAvailability.find({
    photographerId: { $in: photographerIds },
    bookingMode: "instant",
    isActive: true,
  })
    .select("photographerId bookingMode isActive")
    .lean();

  const instantModeMap = new Map();
  for (const availability of availabilities) {
    if (availability?.photographerId) {
      instantModeMap.set(String(availability.photographerId), "instant");
    }
  }

  return instantModeMap;
}

export function getPhotographerProfileFormConfig(req, res) {
  return res.status(200).json({
    fields: PROFILE_EDITABLE_FIELDS,
    options: {
      eventTypes: EVENT_TYPES,
      services: SERVICES,
    },
  });
}

export async function createMyPhotographerProfile(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const existing = await PhotographerProfile.findOne({
      userId: req.user.userId,
    })
      .select("_id")
      .lean();
    if (existing) {
      return res.status(409).json({ error: "Profile already exists !" });
    }

    const payload = pickEditableFields(req.body);
    payload.userId = req.user.userId;

    const created = await PhotographerProfile.create(payload);

    const profile = await PhotographerProfile.findById(created._id).lean();

    if (!profile) {
      return res
        .status(500)
        .json({ error: "Failed tot fetch created profile" });
    }

    return res.status(201).json({
      success: true,
      profile,
    });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    if (error?.code === 11000) {
      return res.status(409).json({ error: "Duplicate data conflict" });
    }
    return res.status(500).json({ error: "Failed to create profile" });
  }
}

export async function getPhotographerProfile(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(401).json({ error: "unauthorized" });
    }

    const profile = await PhotographerProfile.findOne({
      userId: req.user.userId,
    }).lean();

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.status(200).json({ profile });
  } catch {
    return res.status(500).json({ error: "Failed to fetch profile " });
  }
}

export async function updateMyPhotographerProfile(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const updates = pickEditableFields(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const updated = await PhotographerProfile.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.status(200).json({ success: true, profile: updated });
  } catch (error) {
    console.error("updateMyPhotographerProfile error:", error);
    if (error?.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    if (error?.code === 11000) {
      return res.status(409).json({ error: "Duplicate data conflict" });
    }

    return res.status(500).json({ error: "Failed to update profile" });
  }
}

export async function getPhotographerBySlug(req, res) {
  try {
    const { slug } = req.params;

    const profile = await PhotographerProfile.findOne({
      slug,
      isActive: true,
      verificationStatus: "approved",
    })
      .select(
        "slug businessName bio city state profileImageUrl coverImageUrl portfolioImages eventTypes customEventTypes services customServices startingPrice currency avgRating totalReviews isVerified isFeatured verifiedAt trustSignals.trustLabel trustSignals.verificationLevel responseTimeMinutes acceptanceRate",
      )
      .lean();

    if (!profile) {
      return res.status(404).json({ error: "Photographer not found" });
    }

    const availability = await PhotographerAvailability.findOne({
      photographerId: profile._id,
      isActive: true,
    })
      .select("bookingMode isActive")
      .lean();

    return res.status(200).json({ profile: withBookingMode(profile, availability) });
  } catch {
    return res.status(500).json({ error: "Failed to fetch photographer" });
  }
}

export async function listPhotographers(req, res) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 12), 50);
    const skip = (page - 1) * limit;

    const filter = {
      isActive: true,
      verificationStatus: "approved",
    };
    const instantOnly = isTrueLike(req.query.instantOnly);

    if (instantOnly) {
      const instantProfileIds = await findActiveInstantAvailabilityProfileIds();

      if (instantProfileIds.length === 0) {
        return res.status(200).json({
          items: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }

      filter._id = { $in: instantProfileIds };
    }

    if (typeof req.query.city === "string" && req.query.city.trim()) {
      filter.city = new RegExp(`^${escapeRegex(req.query.city.trim())}$`, "i");
    }

    if (typeof req.query.state === "string" && req.query.state.trim()) {
      filter.state = new RegExp(
        `^${escapeRegex(req.query.state.trim())}$`,
        "i",
      );
    }

    if (req.query.eventType) {
      filter.eventTypes = req.query.eventType;
    }

    if (req.query.service) {
      filter.services = req.query.service;
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filter.$text = { $search: req.query.search.trim() };
    }

    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);

    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      filter.startingPrice = {};

      if (Number.isFinite(minPrice)) filter.startingPrice.$gte = minPrice;
      if (Number.isFinite(maxPrice)) filter.startingPrice.$lte = maxPrice;
    }

    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { startingPrice: 1 },
      price_desc: { startingPrice: -1 },
      rating_desc: { avgRating: -1, totalReviews: -1 },
    };

    const sort = sortMap[req.query.sort] || sortMap.newest;

    const [rawItems, total] = await Promise.all([
      PhotographerProfile.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select(
          "slug businessName city state profileImageUrl eventTypes customEventTypes services customServices startingPrice currency avgRating totalReviews isVerified isFeatured verifiedAt trustSignals.trustLabel",
        )
        .lean(),
      PhotographerProfile.countDocuments(filter),
    ]);
    const instantModeMap = await buildInstantModeMap(
      rawItems.map((item) => item?._id).filter(Boolean),
    );

    const items = rawItems.map((item) =>
      withBookingMode(item, {
        isActive: instantModeMap.has(String(item?._id)),
        bookingMode: instantModeMap.get(String(item?._id)) || "request_only",
      }),
    );

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return res.status(500).json({ error: "Failed to list photographers" });
  }
}

export async function removePortfolioImage(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const index = Number.parseInt(req.params.index, 10);
    if (!Number.isFinite(index) || index < 0) {
      return res.status(400).json({ error: "Invalid portfolio index." });
    }

    const profile = await PhotographerProfile.findOne({ userId: req.user.userId }).lean();
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const images = Array.isArray(profile.portfolioImages) ? [...profile.portfolioImages] : [];
    if (index >= images.length) {
      return res.status(400).json({ error: "Index out of range." });
    }

    images.splice(index, 1);

    const updated = await PhotographerProfile.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: { portfolioImages: images } },
      { returnDocument: "after", runValidators: true },
    ).lean();

    return res.status(200).json({ success: true, profile: updated });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to remove portfolio image." });
  }
}

export async function getPhotographerById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid photographer ID." });
    }

    const profile = await PhotographerProfile.findOne({
      _id: id,
      isActive: true,
      verificationStatus: "approved",
    })
      .select(
        "businessName city state profileImageUrl services customServices eventTypes customEventTypes languages startingPrice currency avgRating totalReviews isVerified isFeatured verifiedAt trustSignals.trustLabel",
      )
      .lean();

    if (!profile) {
      return res.status(404).json({ error: "Photographer not found." });
    }

    const availability = await PhotographerAvailability.findOne({
      photographerId: profile._id,
      isActive: true,
    })
      .select("bookingMode isActive")
      .lean();

    return res.status(200).json({ profile: withBookingMode(profile, availability) });
  } catch {
    return res.status(500).json({ error: "Failed to fetch photographer." });
  }
}
