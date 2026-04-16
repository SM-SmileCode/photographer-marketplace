import mongoose from "mongoose";
import Package from "../models/package.js";
import PhotographerProfile from "../models/photographerProfile.js";

const MAX_PACKAGES = 10;

const ALLOWED_FIELDS = [
  "name",
  "description",
  "basePrice",
  "currency",
  "hoursIncluded",
  "photosIncluded",
  "deliveryDays",
  "includes",
  "addOns",
  "extraHourPrice",
  "travelCostPerKm",
  "isActive",
];

function pickAllowed(body) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}

async function resolveProfile(userId) {
  return PhotographerProfile.findOne({ userId }).select("_id").lean();
}

// POST /photographer/packages
export async function createPackage(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const profile = await resolveProfile(req.user.userId);
    if (!profile)
      return res.status(404).json({ error: "Photographer profile not found." });

    const count = await Package.countDocuments({ photographerId: profile._id });
    if (count >= MAX_PACKAGES) {
      return res
        .status(409)
        .json({ error: `Maximum ${MAX_PACKAGES} packages allowed.` });
    }

    const payload = pickAllowed(req.body);
    payload.photographerId = profile._id;

    const pkg = await Package.create(payload);
    return res.status(201).json({ success: true, package: pkg });
  } catch (error) {
    if (error?.name === "ValidationError")
      return res.status(400).json({ error: error.message });

    return res.status(500).json({ error: "Failed to create package." });
  }
}

// GET /photographer/packages/me
export async function listMyPackages(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const profile = await resolveProfile(req.user.userId);
    if (!profile)
      return res.status(404).json({ error: "Photographer profile not found." });

    const packages = await Package.find({ photographerId: profile._id })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({ packages });
  } catch {
    return res.status(500).json({ error: "Failed to fetch packages." });
  }
}

// PATCH /photographer/packages/:packageId
export async function updatePackage(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { packageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(packageId)) {
      return res.status(400).json({ error: "Invalid  package ID." });
    }

    const profile = await resolveProfile(req.user.userId);
    if (!profile)
      return res.status(404).json({ error: "Photographer profile not found." });

    const updates = pickAllowed(req.body);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    const pkg = await Package.findOneAndUpdate(
      { _id: packageId, photographerId: profile._id },
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    ).lean();

    if (!pkg) return res.status(404).json({ error: "Package not found." });

    return res.status(200).json({ success: true, package: pkg });
  } catch (error) {
    if (error?.name === "ValidationError")
      return res.status(400).json({ error: error.message });
    return res.status(500).json({ error: "Failed to update package." });
  }
}

// DELETE /photographer/packages/:packageId
export async function deletePackage(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { packageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(packageId)) {
      return res.status(400).json({ error: "Invalid  package ID." });
    }

    const profile = await resolveProfile(req.user.userId);
    if (!profile)
      return res.status(404).json({ error: "Photographer profile not found." });

    const pkg = await Package.findOneAndDelete({
      _id: packageId,
      photographerId: profile._id,
    }).lean();

    if (!pkg) return res.status(404).json({ error: "Package not found." });

    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete package." });
  }
}

// GET /photographers/id/:id/packages  (public)
export async function listPhotographerPackages(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid photographer ID." });
    }

    const packages = await Package.find({ photographerId: id, isActive: true })
      .sort({ basePrice: 1 })
      .lean();

    return res.status(200).json({ packages });
  } catch {
    return res.status(500).json({ error: "Failed to fetch packages." });
  }
}
