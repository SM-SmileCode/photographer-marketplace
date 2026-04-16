import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import UserCollection from "../models/UserModel.js";
import { getFrontendBaseUrl, sendEmail } from "../services/emailService.js";
import Booking from "../models/booking.js";
import PhotographerProfile from "../models/photographerProfile.js";
import Review from "../models/review.js";
import {
  confirmContactVerification,
  normalizePhone as normalizePhoneFromVerification,
  requestContactVerification,
  validateContactVerificationToken,
} from "../services/contactVerificationService.js";
import { runPhotographerTrustMaintenance } from "../services/trustService.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;
const DEFAULT_REMEMBER_ME_DAYS = 30;
const DEFAULT_SESSION_HOURS = 24;
const RESET_TOKEN_TTL_MS = Number(
  process.env.RESET_PASSWORD_TOKEN_TTL_MS || 60 * 60 * 1000,
);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return normalizePhoneFromVerification(value);
}

function isValidEmail(value) {
  return EMAIL_REGEX.test(String(value || "").trim());
}

function isValidPhone(value) {
  return PHONE_REGEX.test(String(value || "").trim());
}

function getAuthCookieOptions(rememberMe) {
  const isProd = process.env.NODE_ENV === "production";
  const maxAge = rememberMe
    ? DEFAULT_REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000
    : DEFAULT_SESSION_HOURS * 60 * 60 * 1000;

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge,
  };
}

function signAuthToken(user, rememberMe) {
  const expiresIn = rememberMe ? `${DEFAULT_REMEMBER_ME_DAYS}d` : "1d";
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn,
  });
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getStartOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(baseDate, days) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatTimeAgo(dateValue) {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return "just now";

  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / (60 * 1000)));
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export async function getUsers(req, res) {
  try {
    const users = await UserCollection.find().lean();
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function requestContactVerificationCode(req, res) {
  try {
    const channel = String(req.body?.channel || "").trim().toLowerCase();
    const purpose = String(req.body?.purpose || "").trim().toLowerCase();
    const value = String(req.body?.value || "").trim();

    const protectedPurposes = new Set(["update_email", "update_phone"]);
    if (protectedPurposes.has(purpose)) {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      if (purpose === "update_email" && channel !== "email") {
        return res.status(400).json({ error: "channel must be email." });
      }
      if (purpose === "update_phone" && channel !== "phone") {
        return res.status(400).json({ error: "channel must be phone." });
      }
    } else if (purpose !== "signup") {
      return res.status(400).json({ error: "Invalid verification purpose." });
    }

    const response = await requestContactVerification({
      channel,
      purpose,
      targetValue: value,
      userId: protectedPurposes.has(purpose) ? req.user.userId : null,
      req,
    });

    return res.status(200).json({ success: true, ...response });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to request verification code.",
    });
  }
}

export async function confirmContactVerificationCode(req, res) {
  try {
    const result = await confirmContactVerification(req.body || {});
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to confirm verification code.",
    });
  }
}

export async function signupUser(req, res) {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      emailVerificationToken,
    } = req.body || {};

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "Fill All Required Fields" });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format." });
    }
    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ error: "Invalid phone format." });
    }

    await validateContactVerificationToken({
      token: emailVerificationToken,
      channel: "email",
      purpose: "signup",
      targetValue: normalizedEmail,
    });

    const existingContact = await UserCollection.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    })
      .select("_id email phone")
      .lean();

    if (existingContact) {
      if (String(existingContact.email || "") === normalizedEmail) {
        return res.status(409).json({ error: "Email Already Exists" });
      }
      return res.status(409).json({ error: "Phone Already Exists" });
    }

    const safeRole = role === "photographer" ? "photographer" : "customer";
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const addedUser = await UserCollection.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: safeRole,
      isEmailVerified: true,
      emailVerifiedAt: now,
      isPhoneVerified: false,
    });

    return res.status(201).json({ success: true, id: addedUser._id });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Email Already Exists" });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message });
  }
}

export async function loginUser(req, res) {
  try {
    const { email, password, rememberMe = false } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Username or Email and Password are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await UserCollection.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Account is Blocked" });
    }

    const useRememberMe = Boolean(rememberMe);
    const token = signAuthToken(user, useRememberMe);

    res.cookie("auth_token", token, getAuthCookieOptions(useRememberMe));

    return res.status(200).json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: Boolean(user.isEmailVerified),
        isPhoneVerified: Boolean(user.isPhoneVerified),
        emailVerifiedAt: user.emailVerifiedAt || null,
        phoneVerifiedAt: user.phoneVerifiedAt || null,
      },
    });
  } catch {
    return res.status(500).json({ error: "Login Failed" });
  }
}

export function logoutUser(req, res) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
  return res.status(200).json({ success: true, message: "Logged Out" });
}

export function me(req, res) {
  return res.status(200).json({ user: req.user });
}

export async function updateMyProfileImage(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const profileImageUrl = String(req.body?.profileImageUrl || "").trim();
    if (!profileImageUrl) {
      return res.status(400).json({ error: "profileImageUrl is required." });
    }
    const updatedUser = await UserCollection.findByIdAndUpdate(
      req.user.userId,
      { $set: { profileImageUrl } },
      { returnDocument: "after", runValidators: true },
    )
      .select("_id name email phone role profileImageUrl isEmailVerified isPhoneVerified")
      .lean();
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to update profile image." });
  }
}

export async function updateMyProfile(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const name = String(req.body?.name || "").trim();

    if (!name || name.length < 2 || name.length > 120) {
      return res.status(400).json({
        error: "name must be between 2 and 120 characters.",
      });
    }

    const updatedUser = await UserCollection.findByIdAndUpdate(
      req.user.userId,
      { $set: { name } },
      { returnDocument: "after", runValidators: true },
    )
      .select(
        "_id name email phone role isEmailVerified isPhoneVerified emailVerifiedAt phoneVerifiedAt",
      )
      .lean();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({
      success: true,
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isEmailVerified: Boolean(updatedUser.isEmailVerified),
        isPhoneVerified: Boolean(updatedUser.isPhoneVerified),
        emailVerifiedAt: updatedUser.emailVerifiedAt || null,
        phoneVerifiedAt: updatedUser.phoneVerifiedAt || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to update profile.",
    });
  }
}

export async function requestPasswordReset(req, res) {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    const genericMessage =
      "If an account exists for this email, reset instructions have been sent.";
    const user = await UserCollection.findOne({ email: normalizedEmail }).select(
      "_id name email",
    );

    if (!user) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const emailSubject = "Reset your ShotSphere password";
    const emailText = [
      `Hi ${user.name || "there"},`,
      "",
      "We received a request to reset your password.",
      `Use this link to continue: ${resetUrl}`,
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n");

    const emailResult = await sendEmail({
      to: user.email,
      subject: emailSubject,
      text: emailText,
      html: `<p>Hi ${user.name || "there"},</p>
<p>We received a request to reset your password.</p>
<p><a href="${resetUrl}">Reset password</a></p>
<p>If you did not request this, you can safely ignore this email.</p>`,
    });

    const response = { success: true, message: genericMessage };
    if (!emailResult.sent && process.env.NODE_ENV !== "production") {
      response.devResetToken = rawToken;
      response.devResetUrl = resetUrl;
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to process password reset request.",
    });
  }
}

export async function resetPassword(req, res) {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!token) {
      return res.status(400).json({ error: "Reset token is required." });
    }

    if (!password || password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res
        .status(400)
        .json({ error: "Password and confirm password do not match." });
    }

    const tokenHash = hashResetToken(token);
    const user = await UserCollection.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("_id passwordHash passwordResetTokenHash passwordResetExpiresAt");

    if (!user) {
      return res.status(400).json({ error: "Reset token is invalid or expired." });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return res.status(200).json({ success: true, message: "Password reset successful." });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to reset password.",
    });
  }
}

export async function updateMyEmail(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const email = normalizeEmail(req.body?.email);
    const verificationToken = String(req.body?.verificationToken || "");
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    await validateContactVerificationToken({
      token: verificationToken,
      channel: "email",
      purpose: "update_email",
      targetValue: email,
      userId: req.user.userId,
    });

    const currentUser = await UserCollection.findById(req.user.userId)
      .select(
        "_id email name role phone isEmailVerified isPhoneVerified emailVerifiedAt phoneVerifiedAt",
      )
      .lean();

    if (!currentUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (currentUser.email === email) {
      return res.status(200).json({
        success: true,
        user: {
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone,
          role: currentUser.role,
          isEmailVerified: Boolean(currentUser.isEmailVerified),
          isPhoneVerified: Boolean(currentUser.isPhoneVerified),
          emailVerifiedAt: currentUser.emailVerifiedAt || null,
          phoneVerifiedAt: currentUser.phoneVerifiedAt || null,
        },
      });
    }

    const existing = await UserCollection.findOne({ email }).select("_id").lean();
    if (existing && String(existing._id) !== String(req.user.userId)) {
      return res.status(409).json({ error: "Email Already Exists" });
    }

    const updatedUser = await UserCollection.findByIdAndUpdate(
      req.user.userId,
      { $set: { email, isEmailVerified: true, emailVerifiedAt: new Date() } },
      { returnDocument: "after", runValidators: true },
    )
      .select(
        "_id name email phone role isEmailVerified isPhoneVerified emailVerifiedAt phoneVerifiedAt",
      )
      .lean();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({
      success: true,
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isEmailVerified: Boolean(updatedUser.isEmailVerified),
        isPhoneVerified: Boolean(updatedUser.isPhoneVerified),
        emailVerifiedAt: updatedUser.emailVerifiedAt || null,
        phoneVerifiedAt: updatedUser.phoneVerifiedAt || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to update email." });
  }
}

export async function updateMyPhone(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const phone = normalizePhone(req.body?.phone);
    const verificationToken = String(req.body?.verificationToken || "");

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ error: "Valid phone is required." });
    }

    await validateContactVerificationToken({
      token: verificationToken,
      channel: "phone",
      purpose: "update_phone",
      targetValue: phone,
      userId: req.user.userId,
    });

    const currentUser = await UserCollection.findById(req.user.userId)
      .select(
        "_id email name role phone isEmailVerified isPhoneVerified emailVerifiedAt phoneVerifiedAt",
      )
      .lean();

    if (!currentUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (String(currentUser.phone || "") === phone) {
      return res.status(200).json({
        success: true,
        user: {
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone,
          role: currentUser.role,
          isEmailVerified: Boolean(currentUser.isEmailVerified),
          isPhoneVerified: Boolean(currentUser.isPhoneVerified),
          emailVerifiedAt: currentUser.emailVerifiedAt || null,
          phoneVerifiedAt: currentUser.phoneVerifiedAt || null,
        },
      });
    }

    const existingPhoneOwner = await UserCollection.findOne({ phone })
      .select("_id")
      .lean();
    if (
      existingPhoneOwner &&
      String(existingPhoneOwner._id) !== String(req.user.userId)
    ) {
      return res.status(409).json({ error: "Phone Already Exists" });
    }

    const updatedUser = await UserCollection.findByIdAndUpdate(
      req.user.userId,
      { $set: { phone, isPhoneVerified: true, phoneVerifiedAt: new Date() } },
      { returnDocument: "after", runValidators: true },
    )
      .select(
        "_id name email phone role isEmailVerified isPhoneVerified emailVerifiedAt phoneVerifiedAt",
      )
      .lean();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({
      success: true,
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isEmailVerified: Boolean(updatedUser.isEmailVerified),
        isPhoneVerified: Boolean(updatedUser.isPhoneVerified),
        emailVerifiedAt: updatedUser.emailVerifiedAt || null,
        phoneVerifiedAt: updatedUser.phoneVerifiedAt || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to update phone.",
    });
  }
}

export async function getPublicHomeMetrics(req, res) {
  try {
    const now = new Date();
    const monthStart = getStartOfMonth(now);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [sessionsBooked, activePros, avgRatingAgg, featuredProfiles] =
      await Promise.all([
        Booking.countDocuments({
          createdAt: { $gte: monthStart, $lt: nextMonthStart },
        }),
        PhotographerProfile.countDocuments({
          isActive: true,
          verificationStatus: "approved",
        }),
        Review.aggregate([
          { $match: { status: "published" } },
          { $group: { _id: null, avgRating: { $avg: "$rating" } } },
        ]),
        PhotographerProfile.find({
          isActive: true,
          verificationStatus: "approved",
        })
          .sort({ isFeatured: -1, totalReviews: -1, avgRating: -1, createdAt: -1 })
          .limit(3)
          .select(
            "businessName city avgRating startingPrice currency eventTypes customEventTypes",
          )
          .lean(),
      ]);

    const featuredPhotographers = featuredProfiles.map((item) => ({
      name: item.businessName || "Photographer",
      specialty:
        item.eventTypes?.[0] || item.customEventTypes?.[0] || "Photography",
      city: item.city || "Unknown",
      rating: Number(item.avgRating || 0).toFixed(1),
      startsFrom: `${item.currency || "INR"} ${Number(item.startingPrice || 0).toLocaleString("en-IN")}`,
    }));

    return res.status(200).json({
      stats: {
        sessionsBooked: Number(sessionsBooked || 0),
        activePros: Number(activePros || 0),
        avgRating: Number(avgRatingAgg?.[0]?.avgRating || 0).toFixed(1),
      },
      featuredPhotographers,
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to load home metrics.",
    });
  }
}

export async function getAdminDashboardMetrics(req, res) {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }
    const trustMaintenance = await runPhotographerTrustMaintenance();

    const now = new Date();
    const startOfDay = getStartOfLocalDay(now);
    const endOfDay = addDays(startOfDay, 1);
    const monthStart = getStartOfMonth(now);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const staleBookingCutoff = addDays(now, -1);

    const [
      pendingVerifications,
      totalActiveUsers,
      pendingBookings,
      bookingsThisMonth,
      bookingsToday,
      newSignupsToday,
      cancelledBookingsThisMonth,
      flaggedReviews,
      pendingQueueRaw,
    ] = await Promise.all([
      PhotographerProfile.countDocuments({ verificationStatus: "pending" }),
      UserCollection.countDocuments({ isBlocked: false }),
      Booking.countDocuments({ status: "pending" }),
      Booking.countDocuments({ createdAt: { $gte: monthStart, $lt: nextMonthStart } }),
      Booking.countDocuments({ createdAt: { $gte: startOfDay, $lt: endOfDay } }),
      UserCollection.countDocuments({
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }),
      Booking.countDocuments({
        status: "cancelled",
        createdAt: { $gte: monthStart, $lt: nextMonthStart },
      }),
      Review.countDocuments({ status: "flagged" }),
      PhotographerProfile.find({ verificationStatus: "pending" })
        .sort({ createdAt: 1 })
        .limit(5)
        .select("businessName city experienceYears createdAt")
        .lean(),
    ]);

    const stalePendingBookings = await Booking.countDocuments({
      status: "pending",
      createdAt: { $lt: staleBookingCutoff },
    });

    const verificationQueue = pendingQueueRaw.map((item) => ({
      name: item.businessName || "Unnamed profile",
      city: item.city || "Unknown",
      experience: `${Number(item.experienceYears || 0)} years`,
      submitted: formatTimeAgo(item.createdAt),
      status: "Pending",
    }));

    const systemAlerts = [
      `${Number(stalePendingBookings || 0)} pending booking requests are older than 24 hours.`,
      `${Number(flaggedReviews || 0)} reviews are currently flagged for moderation.`,
      `${Number(pendingVerifications || 0)} photographer profiles await verification.`,
    ];

    return res.status(200).json({
      summaryCards: [
        {
          title: "Pending Verifications",
          value: Number(pendingVerifications || 0),
          hint: "Photographer profiles awaiting review",
        },
        {
          title: "Total Active Users",
          value: Number(totalActiveUsers || 0),
          hint: "Customers + photographers currently active",
        },
        {
          title: "Pending Bookings",
          value: Number(pendingBookings || 0),
          hint: "Booking requests awaiting photographer response",
        },
        {
          title: "Bookings This Month",
          value: Number(bookingsThisMonth || 0),
          hint: "Total booking requests created this month",
        },
      ],
      verificationQueue,
      systemAlerts,
      quickStats: [
        { label: "Bookings Today", value: Number(bookingsToday || 0) },
        { label: "New Signups", value: Number(newSignupsToday || 0) },
        {
          label: "Cancelled Bookings",
          value: Number(cancelledBookingsThisMonth || 0),
        },
        { label: "Flagged Reviews", value: Number(flaggedReviews || 0) },
      ],
      trustMaintenance,
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to load admin dashboard metrics.",
    });
  }
}
