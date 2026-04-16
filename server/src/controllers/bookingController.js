import mongoose from "mongoose";
import AvailabilityOverride from "../models/availabilityOverride.js";
import Booking from "../models/booking.js";
import Delivery from "../models/delivery.js";
import Package from "../models/package.js";
import PhotographerAvailability from "../models/photographerAvailability.js";
import PhotographerProfile from "../models/photographerProfile.js";
import {
  addDaysToDateKey,
  filterConflictingSlots,
  findMatchingSlot,
  generateSlotsForDate,
  isValidDateKey,
  zonedDateTimeToUtc,
} from "../utils/availabilityUtils.js";

import {
  checkRole,
  getPaginationParams,
  getPhotographerProfile,
  updateBookingStatus,
  listPhotographerDeliveries as listPhotographerDeliveriesByPhotographer,
  listCustomerDeliveries,
  getCustomerDeliveryById,
  updatePhotographerDeliveryFields,
  confirmCustomerDelivery,
  updateCustomerDeliveryFeedback,
  completeBookingAndCreateDelivery,
  updatePhotographerDeliveryStatus as updatePhotographerDeliveryStatusService,
} from "../services/bookingService.js";
import {
  notifyBookingCancelledByCustomer,
  notifyBookingCompleted,
  notifyBookingCreated,
  notifyBookingResponded,
  notifyDeliveryConfirmedByCustomer,
  notifyDeliveryFeedbackAdded,
  notifyDeliveryStatusChanged,
} from "../services/bookingNotificationService.js";

async function safeNotify(label, notifier) {
  try {
    await notifier();
  } catch (error) {
    console.error(`[notify][${label}] failed`, error);
  }
}

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getLastNMonthBoundaries(n) {
  const now = new Date();
  const points = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    points.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return points;
}

function parseNonNegativeNumber(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

function resolveBookingAmount(booking, fallbackAmount) {
  const pricingAmount = Number(booking?.pricing?.finalAmount);
  if (Number.isFinite(pricingAmount) && pricingAmount >= 0) return pricingAmount;
  const paymentAmount = Number(booking?.payment?.amount);
  if (Number.isFinite(paymentAmount) && paymentAmount >= 0) return paymentAmount;
  const packageAmount = Number(booking?.packageId?.basePrice);
  if (Number.isFinite(packageAmount) && packageAmount >= 0) return packageAmount;
  const amount = Number(fallbackAmount);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

async function expirePendingBookings(extraFilter = {}) {
  const now = new Date();
  await Booking.updateMany(
    { status: "pending", expiresAt: { $lte: now }, ...extraFilter },
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

async function generateBookingCode() {
  for (let i = 0; i < 5; i += 1) {
    const code = `BK${Date.now().toString().slice(-7)}${Math.floor(100 + Math.random() * 900)}`;
    const exists = await Booking.findOne({ bookingCode: code }).select("_id").lean();
    if (!exists) return code;
  }
  throw new Error("Failed to generate booking code.");
}

export async function createBooking(req, res) {
  try {
    if (!req.user || req.user.role !== "customer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const {
      photographerId,
      packageId = null,
      eventType,
      eventDate,
      timezone = "Asia/Kolkata",
      slotName,
      startTime,
      endTime,
      startAtUtc,
      endAtUtc,
      eventLocation,
      customerNote = "",
      deliveryMethod = "other",
      deliveryMethodNote = "",
      selectedAddOns = [],
      additionalAmount = 0,
      source = "web",
      idempotencyKey = null,
    } = req.body || {};

    if (!photographerId || !eventType || !eventDate || !slotName || !startTime || !endTime || !startAtUtc || !endAtUtc) {
      return res.status(400).json({ error: "Missing required booking fields." });
    }

    if (!eventLocation?.address || !eventLocation?.city || !eventLocation?.state || !eventLocation?.pincode) {
      return res.status(400).json({ error: "Incomplete event location." });
    }

    const parsedEventDate = toDate(eventDate);
    const parsedStart = toDate(startAtUtc);
    const parsedEnd = toDate(endAtUtc);
    const requestedEventDateKey = typeof eventDate === "string" ? eventDate.trim() : "";

    if (!isValidDateKey(requestedEventDateKey) || !parsedEventDate || !parsedStart || !parsedEnd || parsedEnd <= parsedStart) {
      return res.status(400).json({ error: "Invalid date/time values." });
    }

    if (parsedStart <= new Date()) {
      return res.status(400).json({ error: "Booking start time must be in the future." });
    }

    if (!mongoose.Types.ObjectId.isValid(photographerId)) {
      return res.status(400).json({ error: "Invalid photographer ID." });
    }

    const photographer = await PhotographerProfile.findById(photographerId)
      .select("_id isActive verificationStatus eventTypes customEventTypes currency")
      .lean();

    if (!photographer || !photographer.isActive || photographer.verificationStatus !== "approved") {
      return res.status(400).json({ error: "Photographer not available for booking." });
    }

    const allowedEventTypes = [
      ...(photographer.eventTypes || []),
      ...(photographer.customEventTypes || []),
    ].filter(Boolean);

    if (allowedEventTypes.length === 0) {
      return res.status(400).json({ error: "Photographer has not configured any event types." });
    }

    const normalizedEventType = eventType.trim().toLowerCase();
    if (!allowedEventTypes.some((et) => et.toLowerCase() === normalizedEventType)) {
      return res.status(400).json({ error: "Selected event type is not available for this photographer." });
    }

    const availability = await PhotographerAvailability.findOne({ photographerId }).lean();

    if (!availability?.isActive) {
      return res.status(409).json({ error: "Selected slot is not available." });
    }

    const trimmedKey = typeof idempotencyKey === "string" && idempotencyKey.trim()
      ? idempotencyKey.trim()
      : null;

    if (trimmedKey) {
      const existing = await Booking.findOne({ customerId: req.user.userId, idempotencyKey: trimmedKey }).lean();
      if (existing) {
        return res.status(200).json({ success: true, booking: existing, idempotent: true });
      }
    }

    await expirePendingBookings({ photographerId });

    const requestedDurationMinutes = Math.round(
      (parsedEnd.getTime() - parsedStart.getTime()) / (60 * 1000),
    );
    const override = await AvailabilityOverride.findOne({ photographerId, date: requestedEventDateKey }).lean();
    const dayStartUtc = zonedDateTimeToUtc(requestedEventDateKey, 0, availability.timezone);
    const dayEndUtc = zonedDateTimeToUtc(addDaysToDateKey(requestedEventDateKey, 1), 0, availability.timezone);

    const blockingBookings = await Booking.find({
      photographerId,
      status: { $in: ["pending", "accepted"] },
      startAtUtc: { $lt: dayEndUtc },
      endAtUtc: { $gt: dayStartUtc },
    }).select("startAtUtc endAtUtc").lean();

    const generatedSlots = generateSlotsForDate({
      availability,
      dateKey: requestedEventDateKey,
      override,
      sessionMinutes: requestedDurationMinutes,
    });

    const availableSlots = filterConflictingSlots({
      slots: generatedSlots,
      bookings: blockingBookings,
      bufferBeforeMinutes: availability.bufferBeforeMinutes,
      bufferAfterMinutes: availability.bufferAfterMinutes,
    });

    const matchingSlot = findMatchingSlot({ slots: availableSlots, startAtUtc: parsedStart, endAtUtc: parsedEnd });

    if (!matchingSlot) {
      return res.status(409).json({ error: "Selected slot is not available." });
    }

    const overlap = await Booking.findOne({
      photographerId,
      status: { $in: ["pending", "accepted"] },
      startAtUtc: { $lt: parsedEnd },
      endAtUtc: { $gt: parsedStart },
    }).select("_id bookingCode").lean();

    if (overlap) {
      return res.status(409).json({ error: "Selected slot is not available." });
    }

    const hasAdditionalAmountInput =
      additionalAmount !== null &&
      additionalAmount !== undefined &&
      String(additionalAmount).trim() !== "";
    const parsedAdditionalAmount = Number(additionalAmount);

    if (
      hasAdditionalAmountInput &&
      (!Number.isFinite(parsedAdditionalAmount) || parsedAdditionalAmount < 0)
    ) {
      return res.status(400).json({ error: "Invalid additional amount." });
    }

    let normalizedPackageId = null;
    let pricingSnapshot;
    let paymentAmount = 0;
    let paymentCurrency = photographer?.currency || "INR";

    const hasPackageSelection =
      packageId !== null &&
      packageId !== undefined &&
      String(packageId).trim() !== "";

    if (hasPackageSelection) {
      if (!mongoose.Types.ObjectId.isValid(String(packageId))) {
        return res.status(400).json({ error: "Invalid package ID." });
      }

      const selectedPackage = await Package.findOne({
        _id: packageId,
        photographerId,
        isActive: true,
      })
        .select("name basePrice currency addOns")
        .lean();

      if (!selectedPackage) {
        return res.status(400).json({ error: "Selected package is not available." });
      }

      const selectedAddOnNameSet = new Set(
        (Array.isArray(selectedAddOns) ? selectedAddOns : [])
          .map((item) => String(item || "").trim().toLowerCase())
          .filter(Boolean),
      );

      const normalizedSelectedAddOns = (selectedPackage.addOns || [])
        .filter((item) =>
          selectedAddOnNameSet.has(String(item?.name || "").trim().toLowerCase()),
        )
        .map((item) => ({
          name: String(item?.name || "").trim(),
          price: parseNonNegativeNumber(item?.price),
        }))
        .filter((item) => item.name);

      const basePrice = parseNonNegativeNumber(selectedPackage.basePrice);
      const addOnsTotal = normalizedSelectedAddOns.reduce(
        (sum, item) => sum + parseNonNegativeNumber(item.price),
        0,
      );
      const normalizedAdditionalAmount = parseNonNegativeNumber(additionalAmount);
      const finalAmount = basePrice + addOnsTotal + normalizedAdditionalAmount;

      normalizedPackageId = selectedPackage._id;
      paymentAmount = finalAmount;
      paymentCurrency = selectedPackage.currency || photographer?.currency || "INR";
      pricingSnapshot = {
        packageName: selectedPackage.name || "",
        basePrice,
        selectedAddOns: normalizedSelectedAddOns,
        addOnsTotal,
        additionalAmount: normalizedAdditionalAmount,
        finalAmount,
        currency: paymentCurrency,
      };
    } else {
      const normalizedAdditionalAmount = parseNonNegativeNumber(additionalAmount);
      if (normalizedAdditionalAmount > 0) {
        paymentAmount = normalizedAdditionalAmount;
        pricingSnapshot = {
          packageName: "",
          basePrice: 0,
          selectedAddOns: [],
          addOnsTotal: 0,
          additionalAmount: normalizedAdditionalAmount,
          finalAmount: normalizedAdditionalAmount,
          currency: paymentCurrency,
        };
      }
    }

    const allowedDeliveryMethods = ["physical", "whatsapp", "drive", "email", "in_app", "other"];
    const normalizedDeliveryMethod = typeof deliveryMethod === "string" ? deliveryMethod.trim().toLowerCase() : "other";
    const normalizedDeliveryMethodNote = typeof deliveryMethodNote === "string" ? deliveryMethodNote.trim() : "";

    if (!allowedDeliveryMethods.includes(normalizedDeliveryMethod)) {
      return res.status(400).json({ error: "Invalid delivery method." });
    }

    const bookingCode = await generateBookingCode();

    // Instant booking: auto-accept if photographer has instant mode enabled
    const isInstant = availability.bookingMode === "instant";
    const initialStatus = isInstant ? "accepted" : "pending";
    const now = new Date();

    const booking = await Booking.create({
      bookingCode,
      customerId: req.user.userId,
      photographerId,
      packageId: normalizedPackageId,
      eventType,
      eventDate: parsedEventDate,
      timezone,
      slotName,
      startTime,
      endTime,
      startAtUtc: parsedStart,
      endAtUtc: parsedEnd,
      eventLocation: {
        address: eventLocation.address,
        city: eventLocation.city,
        state: eventLocation.state,
        pincode: eventLocation.pincode,
        coordinates: Array.isArray(eventLocation.coordinates) ? eventLocation.coordinates : undefined,
      },
      customerNote,
      deliveryMethod: normalizedDeliveryMethod,
      deliveryMethodNote: normalizedDeliveryMethodNote,
      source,
      idempotencyKey: trimmedKey,
      pricing: pricingSnapshot,
      payment: {
        amount: paymentAmount,
        currency: paymentCurrency,
        status: "pending",
      },
      status: initialStatus,
      ...(isInstant && { acceptedAt: now, expiresAt: null }),
      statusHistory: [
        {
          fromStatus: null,
          toStatus: "pending",
          changedById: req.user.userId,
          changedByRole: "customer",
          note: "Booking request created",
        },
        ...(isInstant ? [{
          fromStatus: "pending",
          toStatus: "accepted",
          changedById: null,
          changedByRole: "system",
          note: "Auto-accepted via instant booking mode",
          changedAt: now,
        }] : []),
      ],
    });

    safeNotify("booking_created", () => notifyBookingCreated(booking));
    if (isInstant) {
      safeNotify("booking_instant_accepted", () => notifyBookingResponded(booking));
    }

    return res.status(201).json({ success: true, booking, instant: isInstant });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to create booking." });
  }
}

export async function listMyBookings(req, res) {
  try {
    checkRole(req, "customer");
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = { customerId: req.user.userId };
    if (req.query.status) filter.status = req.query.status;

    await expirePendingBookings({ customerId: req.user.userId });

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("photographerId", "businessName city state profileImageUrl slug startingPrice currency")
        .populate("packageId", "basePrice currency name")
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

export async function listPhotographerBookings(req, res) {
  try {
    checkRole(req, "photographer");
    const profile = await getPhotographerProfile(req.user.userId);
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = { photographerId: profile._id };
    if (req.query.status) filter.status = req.query.status;

    await expirePendingBookings({ photographerId: profile._id });

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "name email phone")
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

export async function cancelMyBooking(req, res) {
  try {
    checkRole(req, "customer");

    const { bookingId } = req.params;
    const { reason = "" } = req.body || {};

    await expirePendingBookings({ customerId: req.user.userId });

    const existing = await Booking.findOne({ _id: bookingId, customerId: req.user.userId })
      .select("_id status")
      .lean();

    if (!existing) return res.status(404).json({ error: "Booking not found." });

    if (!["pending", "accepted"].includes(existing.status)) {
      return res.status(409).json({ error: `Cannot cancel booking in "${existing.status}" status.` });
    }

    const cancellationReason = typeof reason === "string" && reason.trim()
      ? reason.trim()
      : "Cancelled by customer.";

    const booking = await Booking.findOneAndUpdate(
      { _id: bookingId, customerId: req.user.userId, status: existing.status },
      {
        $set: { status: "cancelled", cancelledBy: "customer", cancellationReason, cancelledAt: new Date(), expiresAt: null },
        $push: {
          statusHistory: {
            fromStatus: existing.status,
            toStatus: "cancelled",
            changedById: req.user.userId,
            changedByRole: "customer",
            note: cancellationReason,
          },
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!booking) {
      return res.status(409).json({ error: "Booking status changed. Please refresh and re-try." });
    }

    await safeNotify("booking_cancelled", () => notifyBookingCancelledByCustomer(booking));

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

export async function respondToBooking(req, res) {
  try {
    checkRole(req, "photographer");
    const profile = await getPhotographerProfile(req.user.userId);

    const { bookingId } = req.params;
    const { action, note = "" } = req.body || {};

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ error: "action must be accept or reject." });
    }

    const toStatus = action === "accept" ? "accepted" : "rejected";

    await expirePendingBookings({ photographerId: profile._id });

    const booking = await updateBookingStatus(bookingId, profile._id, "pending", toStatus, req.user.userId, note);

    await safeNotify("booking_responded", () => notifyBookingResponded(booking));

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

export async function markBookingCompleted(req, res) {
  try {
    checkRole(req, "photographer");
    const profile = await getPhotographerProfile(req.user.userId);

    const { bookingId } = req.params;

    const { booking } = await completeBookingAndCreateDelivery({
      bookingId,
      photographerId: profile._id,
      actorUserId: req.user.userId,
    });

    await safeNotify("booking_completed", () => notifyBookingCompleted(booking));

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

export async function listPhotographerDeliveries(req, res) {
  try {
    checkRole(req, "photographer");
    const profile = await getPhotographerProfile(req.user.userId);

    const items = await listPhotographerDeliveriesByPhotographer(profile._id);

    return res.status(200).json({ items });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

export async function getPhotographerEarnings(req, res) {
  try {
    checkRole(req, "photographer");

    const profile = await PhotographerProfile.findOne({ userId: req.user.userId })
      .select("_id currency startingPrice")
      .lean();

    if (!profile) return res.status(404).json({ error: "Photographer profile not found." });

    const monthPoints = getLastNMonthBoundaries(6);
    const monthMap = new Map(
      monthPoints.map((point) => [
        `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, "0")}`,
        0,
      ]),
    );

    const now = new Date();
    const monthStart = getStartOfMonth(now);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [completedBookings, recentCompleted, activeDeliveries] = await Promise.all([
      Booking.find({ photographerId: profile._id, status: "completed" })
        .select("_id bookingCode completedAt createdAt eventDate packageId customerId eventType pricing payment")
        .populate("packageId", "basePrice currency")
        .populate("customerId", "name")
        .lean(),
      Booking.find({ photographerId: profile._id, status: "completed" })
        .sort({ completedAt: -1, createdAt: -1 })
        .limit(10)
        .select("_id bookingCode completedAt createdAt eventDate packageId customerId eventType pricing payment")
        .populate("packageId", "basePrice currency")
        .populate("customerId", "name")
        .lean(),
      Delivery.find({
        photographerId: profile._id,
        status: { $in: ["event_done", "editing", "preview_uploaded", "final_delivered"] },
      })
        .select("_id bookingId status updatedAt")
        .populate("bookingId", "bookingCode packageId")
        .lean(),
    ]);

    let totalGross = 0;
    let thisMonthGross = 0;
    let thisMonthCompleted = 0;

    for (const booking of completedBookings) {
      const amount = resolveBookingAmount(booking, profile.startingPrice);
      totalGross += amount;

      const completedAt = new Date(booking?.completedAt || booking?.createdAt || booking?.eventDate || 0);
      if (Number.isNaN(completedAt.getTime())) continue;

      const monthKey = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, "0")}`;
      if (monthMap.has(monthKey)) {
        monthMap.set(monthKey, Number(monthMap.get(monthKey) || 0) + amount);
      }

      if (completedAt >= monthStart && completedAt < nextMonthStart) {
        thisMonthGross += amount;
        thisMonthCompleted += 1;
      }
    }

    const deliveryBookingIds = activeDeliveries
      .map((d) => (d?.bookingId?._id ? String(d.bookingId._id) : ""))
      .filter(Boolean);

    const pendingBookings = deliveryBookingIds.length
      ? await Booking.find({ _id: { $in: deliveryBookingIds } })
          .select("_id packageId pricing payment")
          .populate("packageId", "basePrice")
          .lean()
      : [];

    const pendingPotentialGross = pendingBookings.reduce(
      (sum, b) => sum + resolveBookingAmount(b, profile.startingPrice),
      0,
    );

    return res.status(200).json({
      summary: {
        currency: profile.currency || "INR",
        totalGross: Math.round(totalGross),
        totalCompletedBookings: completedBookings.length,
        thisMonthGross: Math.round(thisMonthGross),
        thisMonthCompletedBookings: thisMonthCompleted,
        pendingDeliveries: activeDeliveries.length,
        pendingPotentialGross: Math.round(pendingPotentialGross),
      },
      trend: monthPoints.map((point) => {
        const key = `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, "0")}`;
        return {
          month: point.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          gross: Math.round(Number(monthMap.get(key) || 0)),
        };
      }),
      recentCompleted: recentCompleted.map((b) => ({
        _id: b._id,
        bookingCode: b.bookingCode,
        eventType: b.eventType,
        customerName: b?.customerId?.name || "Customer",
        completedAt: b.completedAt || b.createdAt || b.eventDate,
        amount: Math.round(resolveBookingAmount(b, profile.startingPrice)),
        currency: b?.pricing?.currency || b?.packageId?.currency || profile.currency || "INR",
      })),
      pendingDeliveryQueue: activeDeliveries.map((d) => ({
        _id: d._id,
        bookingCode: d?.bookingId?.bookingCode || "-",
        status: d.status,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Failed to load earnings." });
  }
}

export async function updatePhotographerDelivery(req, res) {
  try {
    checkRole(req, "photographer");
    const profile = await getPhotographerProfile(req.user.userId);
    const { deliveryId } = req.params;

    const delivery = await updatePhotographerDeliveryFields({
      deliveryId,
      photographerId: profile._id,
      payload: req.body || {},
    });
    return res.status(200).json({ success: true, delivery });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Failed to update delivery." });
  }
}

export async function updatePhotographerDeliveryStatus(req, res) {
  try {
    checkRole(req, "photographer");
    const profile = await getPhotographerProfile(req.user.userId);
    const { deliveryId } = req.params;
    const { status, note = "" } = req.body || {};

    const delivery = await updatePhotographerDeliveryStatusService({
      deliveryId,
      photographerId: profile._id,
      status,
      note,
      actorId: req.user.userId,
    });

    await safeNotify("delivery_status_changed", () => notifyDeliveryStatusChanged(delivery));

    return res.status(200).json({ success: true, delivery });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Failed to update delivery status." });
  }
}

export async function listMyDeliveries(req, res) {
  try {
    checkRole(req, "customer");
    const result = await listCustomerDeliveries(req.user.userId, req.query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

export async function getMyDelivery(req, res) {
  try {
    checkRole(req, "customer");
    const delivery = await getCustomerDeliveryById(req.user.userId, req.params.deliveryId);
    return res.status(200).json({ delivery });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}

export async function confirmMyDelivery(req, res) {
  try {
    checkRole(req, "customer");
    const { deliveryId } = req.params;
    const { note = "" } = req.body || {};

    const delivery = await confirmCustomerDelivery({
      deliveryId,
      customerId: req.user.userId,
      actorId: req.user.userId,
      note,
    });

    await safeNotify("delivery_confirmed", () => notifyDeliveryConfirmedByCustomer(delivery));

    return res.status(200).json({ success: true, delivery });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Failed to confirm delivery." });
  }
}

export async function updateMyDeliveryFeedback(req, res) {
  try {
    checkRole(req, "customer");
    const { deliveryId } = req.params;
    const { customerFeedback = "" } = req.body || {};

    const delivery = await updateCustomerDeliveryFeedback({
      deliveryId,
      customerId: req.user.userId,
      customerFeedback,
    });

    await safeNotify("delivery_feedback", () => notifyDeliveryFeedbackAdded(delivery));

    return res.status(200).json({ success: true, delivery });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Failed to update delivery feedback." });
  }
}
