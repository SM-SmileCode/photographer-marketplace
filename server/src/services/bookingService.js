import mongoose from "mongoose";
import Booking from "../models/booking.js";
import Delivery from "../models/delivery.js";
import photographerProfile from "../models/photographerProfile.js";
import { attachCustomerReviewsToDeliveries } from "./reviewService.js";

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DELIVERY_STATUS_TRANSITIONS = {
  event_done: ["editing"],
  editing: ["preview_uploaded"],
  preview_uploaded: ["final_delivered"],
  final_delivered: ["customer_confirmed"],
  customer_confirmed: [],
};

const PHOTOGRAPHER_ALLOWED_DELIVERY_STATUSES = new Set([
  "editing",
  "preview_uploaded",
  "final_delivered",
]);

const ALLOWED_DELIVERY_FILE_TYPES = new Set(["image", "video", "zip"]);
const DELIVERY_BOOKING_POPULATE_FIELDS =
  "bookingCode eventType eventDate startTime endTime status packageId";
const DELIVERY_PACKAGE_POPULATE_FIELDS = "name deliveryDays";
const DELIVERY_CUSTOMER_POPULATE_FIELDS = "name email phone";
const DELIVERY_PHOTOGRAPHER_POPULATE_FIELDS =
  "businessName city state profileImageUrl slug";

function addExpectedDeliveryDateToDelivery(delivery) {
  if (!delivery || typeof delivery !== "object") return delivery;

  const booking =
    delivery.bookingId && typeof delivery.bookingId === "object"
      ? delivery.bookingId
      : null;
  const packageInfo =
    booking?.packageId && typeof booking.packageId === "object"
      ? booking.packageId
      : null;

  const eventDate = booking?.eventDate ? new Date(booking.eventDate) : null;
  const deliveryDays = Number(packageInfo?.deliveryDays);

  if (
    !eventDate ||
    Number.isNaN(eventDate.getTime()) ||
    !Number.isFinite(deliveryDays) ||
    deliveryDays <= 0
  ) {
    return { ...delivery, expectedDeliveryDate: null };
  }

  const expected = new Date(eventDate);
  expected.setDate(expected.getDate() + deliveryDays);

  return { ...delivery, expectedDeliveryDate: expected };
}

function isValidHttpUrl(value) {
  return /^https?:\/\/.+/.test(value);
}

function sanitizeDeliveryFiles(inputFiles, fieldName) {
  if (!Array.isArray(inputFiles)) {
    throw { status: 400, message: `${fieldName} must be an array.` };
  }

  return inputFiles.map((file, index) => {
    const url = typeof file?.url === "string" ? file.url.trim() : "";
    const type = typeof file?.type === "string" ? file.type.trim() : "";

    if (!url || !isValidHttpUrl(url)) {
      throw {
        status: 400,
        message: `${fieldName}[${index}].url must be a valid http/https URL.`,
      };
    }

    if (!ALLOWED_DELIVERY_FILE_TYPES.has(type)) {
      throw {
        status: 400,
        message: `${fieldName}[${index}].type must be image, video, or zip.`,
      };
    }

    return { url, type };
  });
}

function populatePhotographerDeliveryQuery(query) {
  return query
    .populate({
      path: "bookingId",
      select: DELIVERY_BOOKING_POPULATE_FIELDS,
      populate: {
        path: "packageId",
        select: DELIVERY_PACKAGE_POPULATE_FIELDS,
      },
    })
    .populate("customerId", DELIVERY_CUSTOMER_POPULATE_FIELDS);
}

function populateCustomerDeliveryQuery(query) {
  return query
    .populate({
      path: "bookingId",
      select: DELIVERY_BOOKING_POPULATE_FIELDS,
      populate: {
        path: "packageId",
        select: DELIVERY_PACKAGE_POPULATE_FIELDS,
      },
    })
    .populate("photographerId", DELIVERY_PHOTOGRAPHER_POPULATE_FIELDS);
}

// 1. Middleware helper - Check role
export function checkRole(req, requiredRole) {
  if (!req.user || req.user.role !== requiredRole) {
    throw { status: 403, message: "forbidden" };
  }
}

// 2. Helper - Get photographer profile
export async function getPhotographerProfile(userId) {
  const profile = await photographerProfile
    .findOne({ userId })
    .select("_id")
    .lean();

  if (!profile) {
    throw { status: 404, message: "Photographer profile not found." };
  }
  return profile;
}

// 3. Helper - Update booking status
export async function updateBookingStatus(
  bookingId,
  photographerId,
  fromStatus,
  toStatus,
  userId,
  note,
) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, photographerId, status: fromStatus },
    {
      $set: { status: toStatus, [`${toStatus}At`]: new Date() },
      $push: {
        statusHistory: {
          fromStatus,
          toStatus,
          changedById: userId,
          changedByRole: "photographer",
          note,
        },
      },
    },
    { returnDocument: "after" },
  ).lean();

  if (!booking) {
    throw {
      status: 409,
      message: "Booking status changed. Please refresh.",
    };
  }

  return booking;
}

// 5. Helper - Paginate results
export function getPaginationParams(query) {
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 10), 50);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export async function createDeliveryForBooking(bookingId, booking) {
  try {
    const existingDelivery = await Delivery.findOne({ bookingId });
    if (existingDelivery) {
      return existingDelivery;
    }

    const safeDeliveryMethod = booking.deliveryMethod || "other";
    const safeDeliveryMethodNote = booking.deliveryMethodNote || "";

    const delivery = await Delivery.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      photographerId: booking.photographerId,
      deliveryMethod: safeDeliveryMethod,
      deliveryMethodNote: safeDeliveryMethodNote,
      status: "event_done",
    });

    await Booking.findByIdAndUpdate(bookingId, { deliveryId: delivery._id });

    return delivery;
  } catch (error) {
    throw new Error("Failed to create delivery.");
  }
}

export function validateAndNormalizeDeliveryUpdatePayload(payload = {}) {
  const { deliveryLink, previewFiles, finalFiles, photographerNote } = payload;
  const updateFields = {};

  if (deliveryLink !== undefined) {
    if (typeof deliveryLink !== "string") {
      throw {
        status: 400,
        message: "deliveryLink must be a string.",
      };
    }
    const trimmed = deliveryLink.trim();
    if (trimmed && !isValidHttpUrl(trimmed)) {
      throw {
        status: 400,
        message: "Invalid deliveryLink format.",
      };
    }
    updateFields.deliveryLink = trimmed;
  }

  if (previewFiles !== undefined) {
    updateFields.previewFiles = sanitizeDeliveryFiles(
      previewFiles,
      "previewFiles",
    );
  }

  if (finalFiles !== undefined) {
    updateFields.finalFiles = sanitizeDeliveryFiles(finalFiles, "finalFiles");
  }

  if (photographerNote !== undefined) {
    if (typeof photographerNote !== "string") {
      throw {
        status: 400,
        message: "photographerNote must be a string.",
      };
    }
    updateFields.photographerNote = photographerNote.trim();
  }

  if (Object.keys(updateFields).length === 0) {
    throw {
      status: 400,
      message:
        "At least one field is required: deliveryLink, previewFiles, finalFiles, photographerNote.",
    };
  }

  return updateFields;
}

export function validateDeliveryTransition(
  currentStatus,
  nextStatus,
  actorRole,
) {
  if (actorRole === "photographer") {
    if (!PHOTOGRAPHER_ALLOWED_DELIVERY_STATUSES.has(nextStatus)) {
      throw {
        status: 400,
        message:
          "status must be one of: editing, preview_uploaded, final_delivered.",
      };
    }
  }

  const allowed = DELIVERY_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw {
      status: 409,
      message: `Invalid delivery transition: ${currentStatus} -> ${nextStatus}.`,
    };
  }
}

export function buildDeliveryStatusPatch({
  currentStatus,
  nextStatus,
  changedById,
  changedByRole,
  note = "",
  existingDelivery,
}) {
  const now = new Date();
  const $set = { status: nextStatus };

  if (
    nextStatus === "preview_uploaded" &&
    !existingDelivery.previewUploadedAt
  ) {
    $set.previewUploadedAt = now;
  }

  if (nextStatus === "final_delivered" && !existingDelivery.deliveredAt) {
    $set.deliveredAt = now;
  }

  if (
    nextStatus === "customer_confirmed" &&
    !existingDelivery.customerConfirmedAt
  ) {
    $set.customerConfirmedAt = now;
  }

  return {
    filter: {
      _id: existingDelivery._id,
      photographerId: existingDelivery.photographerId,
      status: currentStatus,
    },
    update: {
      $set,
      $push: {
        statusHistory: {
          fromStatus: currentStatus,
          toStatus: nextStatus,
          changedById,
          changedByRole,
          note: typeof note === "string" ? note.trim() : "",
          changedAt: now,
        },
      },
    },
  };
}

export async function getOwnedDeliveryForPhotographer(
  deliveryId,
  photographerId,
) {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw { status: 400, message: "Invalid delivery ID." };
  }

  const delivery = await Delivery.findOne({
    _id: deliveryId,
    photographerId,
  })
    .select("_id photographerId status")
    .lean();

  if (!delivery) {
    throw { status: 404, message: "Delivery not found." };
  }

  return delivery;
}

export async function updatePhotographerDeliveryFields({
  deliveryId,
  photographerId,
  payload,
}) {
  await getOwnedDeliveryForPhotographer(deliveryId, photographerId);

  const updateFields = validateAndNormalizeDeliveryUpdatePayload(payload);

  const delivery = await populatePhotographerDeliveryQuery(
    Delivery.findOneAndUpdate(
      { _id: deliveryId, photographerId },
      { $set: updateFields },
      { returnDocument: "after", runValidators: true },
    ),
  ).lean();

  if (!delivery) {
    throw {
      status: 409,
      message: "Delivery changed. Please refresh and retry.",
    };
  }

  return delivery;
}

export async function updatePhotographerDeliveryStatus({
  deliveryId,
  photographerId,
  status,
  note,
  actorId,
}) {
  const existing = await Delivery.findOne({
    _id: deliveryId,
    photographerId,
  })
    .select(
      "_id photographerId status finalFiles previewUploadedAt deliveredAt customerConfirmedAt",
    )
    .lean();
  if (!existing) {
    throw {
      status: 404,
      message: "Delivery not found.",
    };
  }

  validateDeliveryTransition(existing.status, status, "photographer");

  if (
    status === "final_delivered" &&
    (!existing.finalFiles || existing.finalFiles.length === 0)
  ) {
    throw {
      status: 409,
      message: "Cannot set final_delivered without finalFiles.",
    };
  }

  const { filter, update } = buildDeliveryStatusPatch({
    currentStatus: existing.status,
    nextStatus: status,
    changedById: actorId,
    changedByRole: "photographer",
    note,
    existingDelivery: existing,
  });

  const delivery = await populatePhotographerDeliveryQuery(
    Delivery.findOneAndUpdate(filter, update, {
      returnDocument: "after",
      runValidators: true,
    }),
  ).lean();

  if (!delivery) {
    throw {
      status: 409,
      message: "Delivery status changed. Please refresh and retry.",
    };
  }

  return delivery;
}

export async function getCustomerDeliveryById(customerId, deliveryId) {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw {
      status: 400,
      message: "Invalid delivery ID.",
    };
  }

  const delivery = await populateCustomerDeliveryQuery(
    Delivery.findOne({
      _id: deliveryId,
      customerId,
    }),
  ).lean();

  if (!delivery) {
    throw {
      status: 404,
      message: "Delivery not found.",
    };
  }

  const [deliveryWithReview] = await attachCustomerReviewsToDeliveries(
    [addExpectedDeliveryDateToDelivery(delivery)],
    customerId,
  );

  return deliveryWithReview;
}

export async function listCustomerDeliveries(customerId, query = {}) {
  const { page, limit, skip } = getPaginationParams(query);

  const filter = { customerId };

  if (query.status) {
    filter.status = query.status;
  }

  const [items, total] = await Promise.all([
    populateCustomerDeliveryQuery(
      Delivery.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ).lean(),
    Delivery.countDocuments(filter),
  ]);

  const deliveriesWithReview = await attachCustomerReviewsToDeliveries(
    items.map((delivery) => addExpectedDeliveryDateToDelivery(delivery)),
    customerId,
  );

  return {
    items: deliveriesWithReview,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function confirmCustomerDelivery({
  deliveryId,
  customerId,
  actorId,
  note = "",
}) {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw { status: 400, message: "Invalid delivery ID." };
  }

  if (typeof note !== "string") {
    throw { status: 400, message: "note must be a string." };
  }

  const trimmedNote = note.trim();
  if (trimmedNote.length > 500) {
    throw { status: 400, message: "note must be <= 500 characters." };
  }

  const existing = await Delivery.findOne({ _id: deliveryId, customerId })
    .select("_id photographerId status customerConfirmedAt")
    .lean();

  if (!existing) {
    throw { status: 404, message: "Delivery not found." };
  }

  if (existing.status === "customer_confirmed") {
    return populateCustomerDeliveryQuery(
      Delivery.findOne({ _id: deliveryId, customerId }),
    ).lean();
  }

  validateDeliveryTransition(existing.status, "customer_confirmed", "customer");

  const { filter, update } = buildDeliveryStatusPatch({
    currentStatus: existing.status,
    nextStatus: "customer_confirmed",
    changedById: actorId,
    changedByRole: "customer",
    note: trimmedNote,
    existingDelivery: existing,
  });

  const delivery = await populateCustomerDeliveryQuery(
    Delivery.findOneAndUpdate(
      { ...filter, customerId, status: existing.status },
      update,
      { returnDocument: "after", runValidators: true },
    ),
  ).lean();

  if (!delivery) {
    throw {
      status: 409,
      message: "Delivery status changed. Please refresh and retry.",
    };
  }

  return delivery;
}

export async function updateCustomerDeliveryFeedback({
  deliveryId,
  customerId,
  customerFeedback,
}) {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw { status: 400, message: "Invalid delivery ID." };
  }

  if (typeof customerFeedback !== "string") {
    throw { status: 400, message: "customerFeedback must be a string." };
  }

  const trimmedFeedback = customerFeedback.trim();
  if (!trimmedFeedback) {
    throw { status: 400, message: "customerFeedback is required." };
  }

  if (trimmedFeedback.length > 1000) {
    throw {
      status: 400,
      message: "customerFeedback must be <= 1000 characters.",
    };
  }

  const delivery = await populateCustomerDeliveryQuery(
    Delivery.findOneAndUpdate(
      {
        _id: deliveryId,
        customerId,
        status: { $in: ["final_delivered", "customer_confirmed"] },
      },
      { $set: { customerFeedback: trimmedFeedback } },
      { returnDocument: "after", runValidators: true },
    ),
  ).lean();

  if (!delivery) {
    const owned = await Delivery.findOne({ _id: deliveryId, customerId })
      .select("_id status")
      .lean();
    if (!owned) throw { status: 404, message: "Delivery not found." };
    throw {
      status: 409,
      message: `Cannot add feedback in "${owned.status}" status.`,
    };
  }

  return delivery;
}

export async function listPhotographerDeliveries(photographerId) {
  const items = await populatePhotographerDeliveryQuery(
    Delivery.find({ photographerId }).sort({ createdAt: -1 }),
  ).lean();

  return items.map((delivery) => addExpectedDeliveryDateToDelivery(delivery));
}

export async function completeBookingAndCreateDelivery({
  bookingId,
  photographerId,
  actorUserId,
}) {
  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      const existing = await Booking.findOne({
        _id: bookingId,
        photographerId,
        status: "accepted",
      })
        .select(
          "_id status endAtUtc customerId photographerId deliveryMethod deliveryMethodNote",
        )
        .session(session)
        .lean();

      if (!existing) {
        throw {
          status: 404,
          message: "Booking not found or not in accepted status.",
        };
      }

      if (existing.endAtUtc >= new Date()) {
        throw {
          status: 409,
          message: "Cannot complete a booking before the event has ended.",
        };
      }

      const booking = await Booking.findOneAndUpdate(
        { _id: bookingId, photographerId, status: "accepted" },
        {
          $set: { status: "completed", completedAt: new Date() },
          $push: {
            statusHistory: {
              fromStatus: "accepted",
              toStatus: "completed",
              changedById: actorUserId,
              changedByRole: "photographer",
              note: "Marked as completed by Photographer.",
            },
          },
        },
        { returnDocument: "after", session },
      ).lean();

      if (!booking) {
        throw {
          status: 409,
          message: "Booking status changed. Please refresh.",
        };
      }

      let delivery = await Delivery.findOne({ bookingId: booking._id })
        .session(session)
        .lean();

      if (!delivery) {
        const [created] = await Delivery.create(
          [
            {
              bookingId: booking._id,
              customerId: booking.customerId,
              photographerId: booking.photographerId,
              deliveryMethod: booking.deliveryMethod || "other",
              deliveryMethodNote: booking.deliveryMethodNote || "",
              status: "event_done",
            },
          ],
          { session },
        );
        delivery = created.toObject();
      }

      await Booking.findByIdAndUpdate(
        booking._id,
        { $set: { deliveryId: delivery._id } },
        { session },
      );

      await photographerProfile.findOneAndUpdate(
        { _id: photographerId },
        { $inc: { completedBookings: 1 } },
        { session },
      );

      result = { booking, delivery };
    });

    return result;
  } finally {
    await session.endSession();
  }
}
