import mongoose from "mongoose";
import Booking from "../models/booking.js";
import Delivery from "../models/delivery.js";
import PhotographerProfile from "../models/photographerProfile.js";
import Review from "../models/review.js";
import UserCollection from "../models/UserModel.js";
import { notifyUser } from "../services/notificationService.js";
import {
  calculateNextReverificationDueAt,
  runPhotographerTrustMaintenance,
} from "../services/trustService.js";

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

function getStartOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(baseDate, days) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function getLastNMonthBoundaries(n) {
  const now = new Date();
  const points = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    points.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return points;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

function normalizeChecklistInput(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    identityVerified: toBoolean(raw.identityVerified),
    livenessVerified: toBoolean(raw.livenessVerified),
    contactVerified: toBoolean(raw.contactVerified),
    businessProofApplicable: toBoolean(raw.businessProofApplicable),
    businessVerified: toBoolean(raw.businessVerified),
    portfolioOriginalFilesChecked: toBoolean(raw.portfolioOriginalFilesChecked),
    portfolioExifDateChecked: toBoolean(raw.portfolioExifDateChecked),
    portfolioReverseImageChecked: toBoolean(raw.portfolioReverseImageChecked),
    portfolioVerified: toBoolean(raw.portfolioVerified),
    humanReviewCompleted: toBoolean(raw.humanReviewCompleted),
    adminNote: String(raw.adminNote || "").trim().slice(0, 1000),
  };
}

function hasIdentityEvidence(profile) {
  const identityDoc = String(
    profile?.verificationEvidence?.identityDocumentUrl || "",
  ).trim();
  const selfie = String(profile?.verificationEvidence?.selfieWithIdUrl || "").trim();
  const livenessVideo = String(
    profile?.verificationEvidence?.livenessVideoUrl || "",
  ).trim();
  return Boolean(identityDoc && (selfie || livenessVideo));
}

function hasBusinessEvidence(profile) {
  const gst = String(profile?.verificationEvidence?.gstNumber || "").trim();
  const license = String(
    profile?.verificationEvidence?.businessLicenseUrl || "",
  ).trim();
  const addressProof = String(
    profile?.verificationEvidence?.addressProofUrl || "",
  ).trim();
  return Boolean(gst || license || addressProof);
}

function hasPortfolioProofEvidence(profile) {
  const samples = Array.isArray(profile?.verificationEvidence?.originalSampleFileUrls)
    ? profile.verificationEvidence.originalSampleFileUrls
    : [];
  return samples.map((item) => String(item || "").trim()).filter(Boolean).length > 0;
}

async function safeNotifyUser(payload) {
  try {
    await notifyUser(payload);
  } catch (error) {
    console.error("[admin-notify] failed", error);
  }
}

export async function listAdminPhotographerRequests(req, res) {
  try {
    const trustMaintenance = await runPhotographerTrustMaintenance();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "pending").trim().toLowerCase();

    const filter = {};
    if (status !== "all") {
      filter.verificationStatus = status;
    }

    const [items, total] = await Promise.all([
      PhotographerProfile.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate(
          "userId",
          "name email phone isEmailVerified isPhoneVerified emailVerifiedAt phoneVerifiedAt",
        )
        .lean(),
      PhotographerProfile.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      trustMaintenance,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to load photographer requests.",
    });
  }
}

export async function updateAdminPhotographerRequestStatus(req, res) {
  try {
    const profileId = toObjectId(req.params.profileId, "profile ID");
    const action = String(req.body?.action || "").trim().toLowerCase();
    const rejectionReason = String(req.body?.rejectionReason || "").trim();
    const checklistInput = normalizeChecklistInput(req.body?.verificationChecklist);
    const adminNote = String(
      req.body?.adminNote || checklistInput.adminNote || "",
    )
      .trim()
      .slice(0, 1000);

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject".' });
    }

    if (action === "reject" && !rejectionReason) {
      return res.status(400).json({ error: "rejectionReason is required for reject." });
    }

    const profileBeforeUpdate = await PhotographerProfile.findById(profileId)
      .populate(
        "userId",
        "name email phone isEmailVerified isPhoneVerified emailVerifiedAt phoneVerifiedAt",
      )
      .lean();

    if (!profileBeforeUpdate) {
      return res.status(404).json({ error: "Photographer profile not found." });
    }

    const user = profileBeforeUpdate.userId;
    const now = new Date();

    const effectiveChecklist = {
      identityVerified: checklistInput.identityVerified,
      livenessVerified: checklistInput.livenessVerified,
      contactVerified: checklistInput.contactVerified,
      businessProofApplicable: checklistInput.businessProofApplicable,
      businessVerified: checklistInput.businessVerified,
      portfolioOriginalFilesChecked: checklistInput.portfolioOriginalFilesChecked,
      portfolioExifDateChecked: checklistInput.portfolioExifDateChecked,
      portfolioReverseImageChecked: checklistInput.portfolioReverseImageChecked,
      portfolioVerified:
        checklistInput.portfolioVerified ||
        (checklistInput.portfolioOriginalFilesChecked &&
          checklistInput.portfolioExifDateChecked &&
          checklistInput.portfolioReverseImageChecked),
      humanReviewCompleted: checklistInput.humanReviewCompleted,
      reviewedById: req.user.userId,
      reviewedAt: now,
      adminNote,
    };

    if (action === "approve") {
      if (!hasIdentityEvidence(profileBeforeUpdate)) {
        return res.status(400).json({
          error:
            "Identity proof is incomplete. Upload government ID and selfie/liveness evidence.",
        });
      }

      if (!effectiveChecklist.identityVerified || !effectiveChecklist.livenessVerified) {
        return res.status(400).json({
          error:
            "Identity checklist is incomplete. Confirm both ID validity and selfie/liveness check.",
        });
      }

      const contactVerified = Boolean(user?.isEmailVerified);

      if (!contactVerified || !effectiveChecklist.contactVerified) {
        return res.status(400).json({
          error:
            "Contact proof is incomplete. Email OTP verification must pass.",
        });
      }

      if (effectiveChecklist.businessProofApplicable) {
        if (!hasBusinessEvidence(profileBeforeUpdate)) {
          return res.status(400).json({
            error:
              "Business proof is marked applicable. Add GST/license/address proof evidence first.",
          });
        }
        if (!effectiveChecklist.businessVerified) {
          return res.status(400).json({
            error: "Business proof checklist is incomplete.",
          });
        }
      }

      if (!hasPortfolioProofEvidence(profileBeforeUpdate)) {
        return res.status(400).json({
          error:
            "Portfolio proof is incomplete. Add original sample file URLs for verification.",
        });
      }

      if (
        !effectiveChecklist.portfolioOriginalFilesChecked ||
        !effectiveChecklist.portfolioExifDateChecked ||
        !effectiveChecklist.portfolioReverseImageChecked ||
        !effectiveChecklist.portfolioVerified
      ) {
        return res.status(400).json({
          error:
            "Portfolio checklist is incomplete. Original files, EXIF/date, and reverse-image checks are all required.",
        });
      }

      if (!effectiveChecklist.humanReviewCompleted) {
        return res.status(400).json({
          error:
            "Human review checklist is incomplete. Admin must explicitly complete all review checks before approval.",
        });
      }
    }

    const update =
      action === "approve"
        ? {
            verificationStatus: "approved",
            rejectionReason: "",
            verificationChecklist: effectiveChecklist,
            contactVerificationSnapshot: {
              emailVerified: Boolean(user?.isEmailVerified),
              phoneVerified: Boolean(user?.isPhoneVerified),
              emailVerifiedAt: user?.emailVerifiedAt || null,
              phoneVerifiedAt: user?.phoneVerifiedAt || null,
            },
            trustSignals: {
              verificationLevel: "full",
              onboardingVerifiedAt:
                profileBeforeUpdate?.trustSignals?.onboardingVerifiedAt || now,
              nextReverificationDueAt: calculateNextReverificationDueAt(now),
              riskFlags: Number(profileBeforeUpdate?.trustSignals?.riskFlags || 0),
              lastRiskReviewAt:
                profileBeforeUpdate?.trustSignals?.lastRiskReviewAt || null,
              trustLabel: "Verified Photographer",
              pendingTrustReason: "",
              lastAutoFlagAt:
                profileBeforeUpdate?.trustSignals?.lastAutoFlagAt || null,
              lastAutoFlagReason:
                profileBeforeUpdate?.trustSignals?.lastAutoFlagReason || "",
            },
          }
        : {
            verificationStatus: "rejected",
            rejectionReason: rejectionReason.slice(0, 500),
            verificationChecklist: {
              ...effectiveChecklist,
              humanReviewCompleted: false,
              portfolioVerified: false,
            },
            trustSignals: {
              verificationLevel: "none",
              onboardingVerifiedAt:
                profileBeforeUpdate?.trustSignals?.onboardingVerifiedAt || null,
              nextReverificationDueAt: null,
              riskFlags: Number(profileBeforeUpdate?.trustSignals?.riskFlags || 0),
              lastRiskReviewAt:
                profileBeforeUpdate?.trustSignals?.lastRiskReviewAt || null,
              trustLabel: "Verification rejected",
              pendingTrustReason: "Rejected in human review.",
              lastAutoFlagAt:
                profileBeforeUpdate?.trustSignals?.lastAutoFlagAt || null,
              lastAutoFlagReason:
                profileBeforeUpdate?.trustSignals?.lastAutoFlagReason || "",
            },
          };

    const profile = await PhotographerProfile.findByIdAndUpdate(
      profileId,
      { $set: update },
      { returnDocument: "after", runValidators: true },
    )
      .populate("userId", "name email")
      .lean();

    if (!profile) {
      return res.status(404).json({ error: "Photographer profile not found." });
    }

    const recipientUser = profile.userId;
    if (recipientUser?._id) {
      await safeNotifyUser({
        userId: recipientUser._id,
        email: recipientUser.email || "",
        type: action === "approve" ? "profile_approved" : "profile_rejected",
        title:
          action === "approve"
            ? "Profile verification approved"
            : "Profile verification rejected",
        message:
          action === "approve"
            ? "Your photographer profile has been approved and is now visible."
            : `Your photographer profile was rejected. Reason: ${update.rejectionReason}`,
        entityType: "photographer_profile",
        entityId: String(profile._id),
        emailSubject:
          action === "approve"
            ? "ShotSphere profile approved"
            : "ShotSphere profile rejected",
      });
    }

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to update photographer request.",
    });
  }
}

export async function listAdminUsers(req, res) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const role = String(req.query.role || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();
    const search = String(req.query.search || "").trim();

    const filter = {};
    if (["customer", "photographer", "admin"].includes(role)) {
      filter.role = role;
    }
    if (status === "blocked") {
      filter.isBlocked = true;
    } else if (status === "active") {
      filter.isBlocked = false;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      UserCollection.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id name email phone role isBlocked createdAt")
        .lean(),
      UserCollection.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to load users.",
    });
  }
}

export async function updateAdminUserBlockStatus(req, res) {
  try {
    const userId = toObjectId(req.params.userId, "user ID");
    const isBlocked = Boolean(req.body?.isBlocked);

    if (String(userId) === String(req.user.userId)) {
      return res.status(400).json({ error: "You cannot block your own admin account." });
    }

    const updatedUser = await UserCollection.findByIdAndUpdate(
      userId,
      { $set: { isBlocked } },
      { returnDocument: "after", runValidators: true },
    )
      .select("_id name email phone role isBlocked createdAt")
      .lean();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    await safeNotifyUser({
      userId: updatedUser._id,
      email: updatedUser.email || "",
      type: isBlocked ? "account_blocked" : "account_unblocked",
      title: isBlocked ? "Account blocked" : "Account unblocked",
      message: isBlocked
        ? "Your account has been blocked by admin."
        : "Your account has been unblocked by admin.",
      entityType: "user",
      entityId: String(updatedUser._id),
      emailSubject: isBlocked
        ? "ShotSphere account blocked"
        : "ShotSphere account unblocked",
    });

    return res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to update user status.",
    });
  }
}

export async function listAdminBookings(req, res) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "").trim().toLowerCase();

    const filter = {};
    if (
      ["pending", "accepted", "rejected", "cancelled", "completed", "expired"].includes(
        status,
      )
    ) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "name email")
        .populate("photographerId", "businessName userId")
        .populate("packageId", "name basePrice currency")
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to load bookings.",
    });
  }
}

export async function cancelAdminBooking(req, res) {
  try {
    const bookingId = toObjectId(req.params.bookingId, "booking ID");
    const reason = String(req.body?.reason || "").trim() || "Cancelled by admin.";

    const booking = await Booking.findById(bookingId)
      .select("_id status customerId photographerId bookingCode")
      .populate("customerId", "name email")
      .populate({
        path: "photographerId",
        select: "businessName userId",
        populate: {
          path: "userId",
          select: "_id name email",
        },
      })
      .lean();
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (!["pending", "accepted"].includes(booking.status)) {
      return res.status(409).json({
        error: `Cannot cancel booking in "${booking.status}" status.`,
      });
    }

    const updated = await Booking.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          status: "cancelled",
          cancelledBy: "admin",
          cancellationReason: reason.slice(0, 500),
          cancelledAt: new Date(),
          expiresAt: null,
        },
        $push: {
          statusHistory: {
            fromStatus: booking.status,
            toStatus: "cancelled",
            changedById: req.user.userId,
            changedByRole: "admin",
            note: reason.slice(0, 500),
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    )
      .populate("customerId", "name email")
      .populate("photographerId", "businessName")
      .lean();

    const customer = booking.customerId;
    const photographerUser = booking.photographerId?.userId;
    const photographerName = booking.photographerId?.businessName || "Photographer";
    const reasonText = reason.slice(0, 500);

    if (customer?._id) {
      await safeNotifyUser({
        userId: customer._id,
        email: customer.email || "",
        type: "booking_cancelled_admin",
        title: "Booking cancelled by admin",
        message: `Booking ${booking.bookingCode} was cancelled by admin. Reason: ${reasonText}`,
        entityType: "booking",
        entityId: String(booking._id),
        emailSubject: "ShotSphere booking cancelled by admin",
      });
    }

    if (photographerUser?._id) {
      await safeNotifyUser({
        userId: photographerUser._id,
        email: photographerUser.email || "",
        type: "booking_cancelled_admin",
        title: "Booking cancelled by admin",
        message: `Booking ${booking.bookingCode} for ${photographerName} was cancelled by admin. Reason: ${reasonText}`,
        entityType: "booking",
        entityId: String(booking._id),
        emailSubject: "ShotSphere booking cancelled by admin",
      });
    }

    return res.status(200).json({ success: true, booking: updated });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to cancel booking.",
    });
  }
}

export async function getAdminReports(req, res) {
  try {
    const trustMaintenance = await runPhotographerTrustMaintenance();
    const startOfDay = getStartOfLocalDay(new Date());
    const stalePendingCutoff = addDays(startOfDay, -1);

    const [flaggedReviews, hiddenReviews, stalePendingBookings, blockedUsers, topFlagged] =
      await Promise.all([
        Review.countDocuments({ status: "flagged" }),
        Review.countDocuments({ status: "hidden" }),
        Booking.countDocuments({
          status: "pending",
          createdAt: { $lt: stalePendingCutoff },
        }),
        UserCollection.countDocuments({ isBlocked: true }),
        Review.find({ status: "flagged" })
          .sort({ reportCount: -1, createdAt: -1 })
          .limit(10)
          .populate("customerId", "name email")
          .populate("photographerId", "businessName slug")
          .populate("bookingId", "bookingCode")
          .lean(),
      ]);

    return res.status(200).json({
      summary: {
        flaggedReviews,
        hiddenReviews,
        stalePendingBookings,
        blockedUsers,
      },
      items: topFlagged,
      trustMaintenance,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to load reports.",
    });
  }
}

export async function getAdminAnalytics(req, res) {
  try {
    const now = new Date();
    const monthPoints = getLastNMonthBoundaries(6);
    const monthStart = monthPoints[0];

    const [bookingStatus, deliveryStatus, userRoles, profileStatus, monthlyBookings] =
      await Promise.all([
        Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Delivery.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        UserCollection.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
        PhotographerProfile.aggregate([
          { $group: { _id: "$verificationStatus", count: { $sum: 1 } } },
        ]),
        Booking.aggregate([
          { $match: { createdAt: { $gte: monthStart } } },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
      ]);

    const monthMap = new Map(
      monthlyBookings.map((row) => [
        `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
        Number(row.count || 0),
      ]),
    );

    const bookingsTrend = monthPoints.map((point) => {
      const key = `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, "0")}`;
      return {
        month: point.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        bookings: monthMap.get(key) || 0,
      };
    });

    return res.status(200).json({
      generatedAt: now.toISOString(),
      bookingStatus,
      deliveryStatus,
      userRoles,
      profileStatus,
      bookingsTrend,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to load analytics.",
    });
  }
}
