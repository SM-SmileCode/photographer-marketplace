import mongoose from "mongoose";
import PhotographerProfile from "../models/photographerProfile.js";
import Wishlist from "../models/wishlist.js";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toObjectId(value, fieldName = "ID") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw { status: 400, message: `Invalid ${fieldName}.` };
  }

  return new mongoose.Types.ObjectId(value);
}

function ensureCustomer(req) {
  if (!req.user?.userId) {
    throw { status: 401, message: "unauthorized" };
  }
}

export async function listMyWishlist(req, res) {
  try {
    ensureCustomer(req);

    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const customerId = toObjectId(req.user.userId, "customer ID");

    const [itemsRaw, total] = await Promise.all([
      Wishlist.find({ customerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(
          "photographerId",
          "slug businessName city state profileImageUrl startingPrice currency avgRating totalReviews isVerified isFeatured verifiedAt trustSignals.trustLabel isActive verificationStatus",
        )
        .lean(),
      Wishlist.countDocuments({ customerId }),
    ]);

    const staleWishlistIds = [];
    const items = itemsRaw
      .map((item) => {
        if (!item?.photographerId) {
          staleWishlistIds.push(item?._id);
          return null;
        }

        return {
          _id: item._id,
          photographer: item.photographerId,
          createdAt: item.createdAt,
        };
      })
      .filter(Boolean);

    if (staleWishlistIds.length > 0) {
      await Wishlist.deleteMany({
        _id: { $in: staleWishlistIds },
        customerId,
      });
    }

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to load wishlist.",
    });
  }
}

export async function addMyWishlistItem(req, res) {
  try {
    ensureCustomer(req);
    const customerId = toObjectId(req.user.userId, "customer ID");
    const photographerId = toObjectId(
      req.params.photographerId,
      "photographer ID",
    );

    const photographer = await PhotographerProfile.findOne({
      _id: photographerId,
      isActive: true,
      verificationStatus: "approved",
    })
      .select("_id")
      .lean();

    if (!photographer) {
      return res.status(404).json({ error: "Photographer not found." });
    }

    const wishlistItem = await Wishlist.findOneAndUpdate(
      { customerId, photographerId },
      { $setOnInsert: { customerId, photographerId } },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
      .populate(
        "photographerId",
        "slug businessName city state profileImageUrl startingPrice currency avgRating totalReviews isVerified isFeatured verifiedAt trustSignals.trustLabel",
      )
      .lean();

    return res.status(200).json({
      success: true,
      item: {
        _id: wishlistItem._id,
        photographer: wishlistItem.photographerId,
        createdAt: wishlistItem.createdAt,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ success: true });
    }

    return res.status(error.status || 500).json({
      error: error.message || "Failed to add wishlist item.",
    });
  }
}

export async function removeMyWishlistItem(req, res) {
  try {
    ensureCustomer(req);
    const customerId = toObjectId(req.user.userId, "customer ID");
    const photographerId = toObjectId(
      req.params.photographerId,
      "photographer ID",
    );

    const result = await Wishlist.deleteOne({ customerId, photographerId });
    return res.status(200).json({
      success: true,
      removed: Number(result.deletedCount || 0) > 0,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to remove wishlist item.",
    });
  }
}

export async function checkMyWishlistItem(req, res) {
  try {
    ensureCustomer(req);
    const customerId = toObjectId(req.user.userId, "customer ID");
    const photographerId = toObjectId(
      req.params.photographerId,
      "photographer ID",
    );

    const existing = await Wishlist.findOne({ customerId, photographerId })
      .select("_id")
      .lean();

    return res.status(200).json({ saved: Boolean(existing) });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to check wishlist item.",
    });
  }
}
