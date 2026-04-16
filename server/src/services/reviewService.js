import mongoose from "mongoose";
import Delivery from "../models/delivery.js";
import PhotographerProfile from "../models/photographerProfile.js";
import Review from "../models/review.js";

const SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;
const MODERATION_STATUSES = new Set(["published", "flagged", "hidden"]);

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toObjectId(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw { status: 400, message: `Invalid ${fieldName}.` };
  }

  return new mongoose.Types.ObjectId(value);
}

function getRefId(value) {
  if (!value) return "";
  if (typeof value === "object" && value !== null) {
    if (value._id) return String(value._id);
    return String(value);
  }
  return String(value);
}

function roundToOneDecimal(value) {
  return Math.round(Number(value) * 10) / 10;
}

function resolveCurrentRatingSum(profile) {
  const currentCount = Number(profile?.totalReviews || 0);
  const ratingSum = Number(profile?.ratingSum);

  if (Number.isFinite(ratingSum)) {
    return Math.max(0, ratingSum);
  }

  const fallback = Number(profile?.avgRating || 0) * currentCount;
  return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
}

function validateSlug(slug) {
  const value = String(slug || "").trim();
  if (!value || value.length > 100 || !SLUG_REGEX.test(value)) {
    throw { status: 400, message: "Invalid photographer slug." };
  }
  return value;
}

function normalizeModerationStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!MODERATION_STATUSES.has(value)) {
    throw {
      status: 400,
      message: 'status must be one of: "published", "flagged", "hidden".',
    };
  }

  return value;
}

function normalizeModerationNote(note) {
  if (note == null) return "";
  if (typeof note !== "string") {
    throw { status: 400, message: "moderationNote must be a string." };
  }

  const value = note.trim();
  if (value.length > 300) {
    throw { status: 400, message: "moderationNote must be <= 300 characters." };
  }

  return value;
}

async function applyPhotographerRatingDelta({
  photographerId,
  deltaCount,
  deltaSum,
  session,
}) {
  const query = PhotographerProfile.findById(photographerId).select(
    "avgRating totalReviews ratingSum",
  );
  if (session) query.session(session);

  const profile = await query;

  if (!profile) {
    throw { status: 404, message: "Photographer profile not found." };
  }

  const currentCount = Number(profile.totalReviews || 0);
  const currentSum = resolveCurrentRatingSum(profile);

  const nextCount = Math.max(0, currentCount + deltaCount);
  const nextSum = Math.max(0, currentSum + deltaSum);

  profile.totalReviews = nextCount;
  profile.ratingSum = nextSum;
  profile.avgRating = nextCount > 0 ? roundToOneDecimal(nextSum / nextCount) : 0;

  if (session) {
    await profile.save({ session });
    return;
  }

  await profile.save();
}

function isTransactionUnsupported(error) {
  const msg = String(error?.message || "");
  return (
    msg.includes("Transaction numbers are only allowed on a replica set") ||
    msg.includes("transactions are not supported")
  );
}

async function performReviewUpsert({
  deliveryObjectId,
  customerId,
  parsedRating,
  trimmedComment,
  session = null,
}) {
  const deliveryQuery = Delivery.findOne({
    _id: deliveryObjectId,
    customerId,
  }).select("_id bookingId customerId photographerId status");
  if (session) deliveryQuery.session(session);
  const delivery = await deliveryQuery.lean();

  if (!delivery) {
    throw { status: 404, message: "Delivery not found." };
  }

  if (delivery.status !== "customer_confirmed") {
    throw {
      status: 409,
      message: 'Reviews are only allowed after delivery is "customer_confirmed".',
    };
  }

  const existingQuery = Review.findOne({
    deliveryId: delivery._id,
    customerId,
  }).select("_id rating comment status isEdited editedAt");
  if (session) existingQuery.session(session);
  const existingReview = await existingQuery.lean();

  if (existingReview?.status === "hidden") {
    throw {
      status: 403,
      message: "This review is hidden and cannot be edited.",
    };
  }

  const isEditedNow = Boolean(
    existingReview &&
      (existingReview.rating !== parsedRating ||
        existingReview.comment !== trimmedComment),
  );
  const isEdited = existingReview ? existingReview.isEdited || isEditedNow : false;

  const nextStatus = existingReview?.status === "flagged" ? "flagged" : "published";

  const updateQuery = Review.findOneAndUpdate(
    { deliveryId: delivery._id, customerId },
    {
      $set: {
        bookingId: delivery.bookingId,
        deliveryId: delivery._id,
        customerId: delivery.customerId,
        photographerId: delivery.photographerId,
        rating: parsedRating,
        comment: trimmedComment,
        status: nextStatus,
        isEdited,
        editedAt: isEditedNow ? new Date() : existingReview?.editedAt || null,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).select("_id");
  if (session) updateQuery.session(session);
  const updatedReview = await updateQuery.lean();

  if (!updatedReview) {
    throw { status: 500, message: "Failed to save review." };
  }

  const wasPublished = Boolean(existingReview?.status === "published");
  const isPublished = nextStatus === "published";
  const previousContribution = wasPublished
    ? Number(existingReview?.rating || 0)
    : 0;
  const nextContribution = isPublished ? parsedRating : 0;
  const deltaCount = (isPublished ? 1 : 0) - (wasPublished ? 1 : 0);
  const deltaSum = nextContribution - previousContribution;

  await applyPhotographerRatingDelta({
    photographerId: delivery.photographerId,
    deltaCount,
    deltaSum,
    session,
  });

  return String(updatedReview._id);
}

async function performReviewModerationUpdate({
  reviewObjectId,
  nextStatus,
  moderationNote,
  adminRole,
  session = null,
}) {
  const existingQuery = Review.findById(reviewObjectId).select(
    "_id status rating photographerId",
  );
  if (session) existingQuery.session(session);

  const existingReview = await existingQuery.lean();
  if (!existingReview) {
    throw { status: 404, message: "Review not found." };
  }

  const updateDoc = {
    status: nextStatus,
    moderationNote,
    hiddenAt: nextStatus === "hidden" ? new Date() : null,
    hiddenByRole:
      nextStatus === "hidden" ? (adminRole === "system" ? "system" : "admin") : null,
  };

  const updateQuery = Review.findByIdAndUpdate(
    reviewObjectId,
    { $set: updateDoc },
    { returnDocument: "after", runValidators: true },
  ).select("_id status rating photographerId");
  if (session) updateQuery.session(session);

  const updatedReview = await updateQuery.lean();
  if (!updatedReview) {
    throw { status: 500, message: "Failed to update review moderation." };
  }

  if (existingReview.status !== nextStatus) {
    const rating = Number(existingReview.rating || 0);
    const wasPublished = existingReview.status === "published";
    const isPublished = nextStatus === "published";
    const deltaCount = (isPublished ? 1 : 0) - (wasPublished ? 1 : 0);
    const deltaSum = (isPublished ? rating : 0) - (wasPublished ? rating : 0);

    if (deltaCount !== 0 || deltaSum !== 0) {
      await applyPhotographerRatingDelta({
        photographerId: existingReview.photographerId,
        deltaCount,
        deltaSum,
        session,
      });
    }
  }

  return String(updatedReview._id);
}

export async function syncPhotographerReviewStats(photographerId) {
  const photographerObjectId = toObjectId(photographerId, "photographer ID");

  const [summary] = await Review.aggregate([
    {
      $match: {
        photographerId: photographerObjectId,
        status: "published",
      },
    },
    {
      $group: {
        _id: "$photographerId",
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        ratingSum: { $sum: "$rating" },
      },
    },
  ]);

  await PhotographerProfile.updateOne(
    { _id: photographerObjectId },
    {
      $set: {
        avgRating: summary ? roundToOneDecimal(summary.avgRating) : 0,
        totalReviews: summary ? summary.totalReviews : 0,
        ratingSum: summary ? summary.ratingSum : 0,
      },
    },
  );
}

export async function upsertCustomerDeliveryReview({
  deliveryId,
  customerId,
  rating,
  comment = "",
}) {
  const deliveryObjectId = toObjectId(deliveryId, "delivery ID");
  const parsedRating = Number.parseInt(rating, 10);

  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw { status: 400, message: "rating must be an integer between 1 and 5." };
  }

  if (typeof comment !== "string") {
    throw { status: 400, message: "comment must be a string." };
  }

  const trimmedComment = comment.trim();
  if (trimmedComment.length > 1000) {
    throw { status: 400, message: "comment must be <= 1000 characters." };
  }

  const session = await mongoose.startSession();
  let reviewId = null;

  try {
    try {
      await session.withTransaction(async () => {
        reviewId = await performReviewUpsert({
          deliveryObjectId,
          customerId,
          parsedRating,
          trimmedComment,
          session,
        });
      });
    } catch (error) {
      if (!isTransactionUnsupported(error)) {
        throw error;
      }

      reviewId = await performReviewUpsert({
        deliveryObjectId,
        customerId,
        parsedRating,
        trimmedComment,
      });
    }
  } catch (error) {
    if (error?.code === 11000) {
      throw {
        status: 409,
        message: "Review write conflict. Please retry.",
      };
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const review = await Review.findById(reviewId)
    .populate("customerId", "name")
    .populate("bookingId", "bookingCode eventType")
    .lean();

  if (!review) {
    throw { status: 500, message: "Saved review could not be loaded." };
  }

  return review;
}

export async function listPhotographerPublicReviewsBySlug(slug, query = {}) {
  const validatedSlug = validateSlug(slug);
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 6), 20);
  const skip = (page - 1) * limit;

  const photographer = await PhotographerProfile.findOne({
    slug: validatedSlug,
    isActive: true,
    verificationStatus: "approved",
  })
    .select("_id avgRating totalReviews")
    .lean();

  if (!photographer) {
    throw { status: 404, message: "Photographer not found." };
  }

  const [items, total] = await Promise.all([
    Review.find({ photographerId: photographer._id, status: "published" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "name")
      .populate("bookingId", "bookingCode eventType")
      .lean(),
    Review.countDocuments({ photographerId: photographer._id, status: "published" }),
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
      avgRating: photographer.avgRating || 0,
      totalReviews: photographer.totalReviews || 0,
    },
  };
}

export async function listAdminModerationReviews(query = {}) {
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  const skip = (page - 1) * limit;
  const requestedStatus = String(query.status || "flagged").trim().toLowerCase();

  const filter = {};
  if (requestedStatus !== "all") {
    filter.status = normalizeModerationStatus(requestedStatus);
  }

  const [items, total, summaryRaw] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "name email")
      .populate("bookingId", "bookingCode eventType eventDate")
      .populate("photographerId", "businessName slug city state")
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const summary = {
    published: 0,
    flagged: 0,
    hidden: 0,
  };

  for (const row of summaryRaw || []) {
    if (summary[row._id] != null) {
      summary[row._id] = Number(row.count || 0);
    }
  }

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary,
  };
}

export async function moderateReviewStatus({
  reviewId,
  status,
  moderationNote = "",
  adminRole = "admin",
}) {
  const reviewObjectId = toObjectId(reviewId, "review ID");
  const nextStatus = normalizeModerationStatus(status);
  const normalizedNote = normalizeModerationNote(moderationNote);

  const session = await mongoose.startSession();
  let updatedReviewId = null;

  try {
    try {
      await session.withTransaction(async () => {
        updatedReviewId = await performReviewModerationUpdate({
          reviewObjectId,
          nextStatus,
          moderationNote: normalizedNote,
          adminRole,
          session,
        });
      });
    } catch (error) {
      if (!isTransactionUnsupported(error)) {
        throw error;
      }

      updatedReviewId = await performReviewModerationUpdate({
        reviewObjectId,
        nextStatus,
        moderationNote: normalizedNote,
        adminRole,
      });
    }
  } finally {
    await session.endSession();
  }

  const review = await Review.findById(updatedReviewId)
    .populate("customerId", "name email")
    .populate("bookingId", "bookingCode eventType eventDate")
    .populate("photographerId", "businessName slug city state")
    .lean();

  if (!review) {
    throw { status: 500, message: "Updated review could not be loaded." };
  }

  return review;
}

export async function reportReviewAbuse({
  reviewId,
  reporterId,
  reason = "",
}) {
  const reviewObjectId = toObjectId(reviewId, "review ID");
  const reporterObjectId = toObjectId(reporterId, "reporter ID");
  const safeReason = String(reason || "").trim().slice(0, 300);

  const existingReview = await Review.findById(reviewObjectId)
    .select("_id status reportCount reportedByIds moderationNote")
    .lean();

  if (!existingReview) {
    throw { status: 404, message: "Review not found." };
  }

  const alreadyReported = Array.isArray(existingReview.reportedByIds)
    ? existingReview.reportedByIds.some(
        (item) => String(item) === String(reporterObjectId),
      )
    : false;

  if (alreadyReported) {
    return {
      _id: existingReview._id,
      status: existingReview.status,
      reportCount: Number(existingReview.reportCount || 0),
      alreadyReported: true,
    };
  }

  const setDoc = {};
  if (existingReview.status === "published") {
    setDoc.status = "flagged";
  }

  if (safeReason && !String(existingReview.moderationNote || "").trim()) {
    setDoc.moderationNote = safeReason;
  }

  const updatedReview = await Review.findByIdAndUpdate(
    reviewObjectId,
    {
      $inc: { reportCount: 1 },
      $addToSet: { reportedByIds: reporterObjectId },
      ...(Object.keys(setDoc).length ? { $set: setDoc } : {}),
    },
    { returnDocument: "after", runValidators: true },
  )
    .select("_id status reportCount")
    .lean();

  if (!updatedReview) {
    throw { status: 500, message: "Failed to report review." };
  }

  return {
    ...updatedReview,
    alreadyReported: false,
  };
}

export async function attachCustomerReviewsToDeliveries(deliveries, customerId) {
  const list = Array.isArray(deliveries) ? deliveries.filter(Boolean) : [];
  const bookingIds = list
    .map((delivery) => getRefId(delivery?.bookingId))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (!bookingIds.length) {
    return list.map((delivery) => ({ ...delivery, review: null }));
  }

  const reviews = await Review.find({
    customerId,
    bookingId: { $in: bookingIds },
  })
    .select("bookingId deliveryId rating comment status createdAt updatedAt")
    .lean();

  const reviewMap = new Map(
    reviews.map((review) => [String(review.bookingId), review]),
  );

  return list.map((delivery) => ({
    ...delivery,
    review: reviewMap.get(getRefId(delivery?.bookingId)) || null,
  }));
}

export async function backfillAllPhotographerReviewStats({
  batchSize = 500,
} = {}) {
  const safeBatchSize = Math.max(1, Number.parseInt(batchSize, 10) || 500);

  const summaries = await Review.aggregate([
    { $match: { status: "published" } },
    {
      $group: {
        _id: "$photographerId",
        totalReviews: { $sum: 1 },
        ratingSum: { $sum: "$rating" },
      },
    },
  ]);

  await PhotographerProfile.updateMany(
    {},
    { $set: { avgRating: 0, totalReviews: 0, ratingSum: 0 } },
  );

  if (!summaries.length) {
    return {
      profilesReset: true,
      profilesUpdated: 0,
      summaries: 0,
      batches: 0,
    };
  }

  let profilesUpdated = 0;
  let batches = 0;

  for (let i = 0; i < summaries.length; i += safeBatchSize) {
    const chunk = summaries.slice(i, i + safeBatchSize);
    const operations = chunk.map((summary) => {
      const totalReviews = Number(summary.totalReviews || 0);
      const ratingSum = Number(summary.ratingSum || 0);
      const avgRating = totalReviews > 0 ? roundToOneDecimal(ratingSum / totalReviews) : 0;

      return {
        updateOne: {
          filter: { _id: summary._id },
          update: {
            $set: {
              totalReviews,
              ratingSum,
              avgRating,
            },
          },
        },
      };
    });

    if (operations.length) {
      const result = await PhotographerProfile.bulkWrite(operations, {
        ordered: false,
      });
      profilesUpdated += Number(result.modifiedCount || 0);
      batches += 1;
    }
  }

  return {
    profilesReset: true,
    profilesUpdated,
    summaries: summaries.length,
    batches,
  };
}
