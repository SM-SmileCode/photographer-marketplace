import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import ContactVerification from "../models/contactVerification.js";
import UserCollection from "../models/UserModel.js";
import { sendEmail } from "./emailService.js";
import { sendSms } from "./smsService.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;
const ALLOWED_PURPOSES = new Set(["signup", "update_email", "update_phone"]);

const CONTACT_OTP_TTL_MS = Number(
  process.env.CONTACT_OTP_TTL_MS || 10 * 60 * 1000,
);
const CONTACT_OTP_MAX_ATTEMPTS = Number(
  process.env.CONTACT_OTP_MAX_ATTEMPTS || 5,
);
const CONTACT_VERIFICATION_TOKEN_TTL = String(
  process.env.CONTACT_VERIFICATION_TOKEN_TTL || "30m",
);

function isProd() {
  return process.env.NODE_ENV === "production";
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizePhone(value) {
  return String(value || "").trim();
}

function normalizeByChannel(channel, value) {
  if (channel === "email") return normalizeEmail(value);
  return normalizePhone(value);
}

function ensurePurpose(value) {
  const purpose = String(value || "").trim().toLowerCase();
  if (!ALLOWED_PURPOSES.has(purpose)) {
    throw { status: 400, message: "Invalid verification purpose." };
  }
  return purpose;
}

function ensureChannel(value) {
  const channel = String(value || "").trim().toLowerCase();
  if (!["email", "phone"].includes(channel)) {
    throw { status: 400, message: "channel must be email or phone." };
  }
  return channel;
}

function ensureTargetByChannel(channel, targetValue) {
  const normalized = normalizeByChannel(channel, targetValue);
  if (!normalized) {
    throw { status: 400, message: `${channel} is required.` };
  }

  if (channel === "email") {
    if (!EMAIL_REGEX.test(normalized)) {
      throw { status: 400, message: "Invalid email format." };
    }
  } else if (!PHONE_REGEX.test(normalized)) {
    throw { status: 400, message: "Invalid phone format." };
  }

  return normalized;
}

function ensureObjectIdOrNull(value) {
  if (value == null || value === "") return null;
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw { status: 400, message: "Invalid user ID." };
  }
  return new mongoose.Types.ObjectId(value);
}

function generateCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function getClientMeta(req = {}) {
  return {
    ip: String(req.ip || "").slice(0, 120),
    userAgent: String(req.headers?.["user-agent"] || "").slice(0, 300),
  };
}

function createVerificationToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: CONTACT_VERIFICATION_TOKEN_TTL,
  });
}

async function deliverCode({ channel, targetValue, code }) {
  if (channel === "email") {
    const emailResult = await sendEmail({
      to: targetValue,
      subject: "ShotSphere verification code",
      text: `Your ShotSphere verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your ShotSphere verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
    return { channel, ...emailResult };
  }

  const smsResult = await sendSms({
    to: targetValue,
    message: `ShotSphere verification code: ${code}. Expires in 10 minutes.`,
  });
  return { channel, ...smsResult };
}

export async function requestContactVerification({
  channel: inputChannel,
  purpose: inputPurpose,
  targetValue: rawTargetValue,
  userId,
  req,
}) {
  const channel = ensureChannel(inputChannel);
  const purpose = ensurePurpose(inputPurpose);
  const targetValue = ensureTargetByChannel(channel, rawTargetValue);
  const normalizedUserId = ensureObjectIdOrNull(userId);

  if ((purpose === "update_email" || purpose === "update_phone") && !normalizedUserId) {
    throw { status: 400, message: "userId is required for protected verification." };
  }

  if (purpose === "signup") {
    const existing = await UserCollection.findOne(
      channel === "email" ? { email: targetValue } : { phone: targetValue },
    )
      .select("_id")
      .lean();

    if (existing) {
      throw {
        status: 409,
        message: channel === "email" ? "Email Already Exists" : "Phone Already Exists",
      };
    }
  }

  if (purpose === "update_email") {
    const existing = await UserCollection.findOne({
      email: targetValue,
      _id: { $ne: normalizedUserId },
    })
      .select("_id")
      .lean();

    if (existing) {
      throw { status: 409, message: "Email Already Exists" };
    }
  }

  if (purpose === "update_phone") {
    const existing = await UserCollection.findOne({
      phone: targetValue,
      _id: { $ne: normalizedUserId },
    })
      .select("_id")
      .lean();

    if (existing) {
      throw { status: 409, message: "Phone Already Exists" };
    }
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CONTACT_OTP_TTL_MS);
  const requestMeta = getClientMeta(req);

  await ContactVerification.deleteMany({
    channel,
    purpose,
    targetValue,
    userId: normalizedUserId,
    consumedAt: null,
  });

  const created = await ContactVerification.create({
    channel,
    purpose,
    targetValue,
    userId: normalizedUserId,
    codeHash,
    attempts: 0,
    maxAttempts: CONTACT_OTP_MAX_ATTEMPTS,
    expiresAt,
    consumedAt: null,
    requestMeta,
  });

  const delivery = await deliverCode({ channel, targetValue, code });
  if (!delivery.sent && isProd()) {
    throw {
      status: 503,
      message: `Failed to send ${channel} verification code.`,
    };
  }

  const response = {
    verificationRequestId: String(created._id),
    channel,
    purpose,
    expiresAt: expiresAt.toISOString(),
  };

  if (!isProd()) {
    response.devCode = code;
    response.delivery = delivery;
  }

  return response;
}

function sanitizeVerificationPayload(payload = {}) {
  const verificationRequestId = String(payload?.verificationRequestId || "").trim();
  const code = String(payload?.code || "").trim();

  if (!verificationRequestId || !mongoose.Types.ObjectId.isValid(verificationRequestId)) {
    throw { status: 400, message: "Invalid verificationRequestId." };
  }

  if (!/^\d{6}$/.test(code)) {
    throw { status: 400, message: "code must be a 6-digit number." };
  }

  return { verificationRequestId, code };
}

export async function confirmContactVerification(payload = {}) {
  const { verificationRequestId, code } = sanitizeVerificationPayload(payload);

  const verification = await ContactVerification.findById(verificationRequestId)
    .select(
      "_id channel purpose targetValue userId attempts maxAttempts expiresAt consumedAt +codeHash",
    );

  if (!verification) {
    throw { status: 404, message: "Verification request not found." };
  }

  if (verification.consumedAt) {
    throw { status: 409, message: "Verification request already used." };
  }

  if (verification.expiresAt <= new Date()) {
    throw { status: 410, message: "Verification request expired." };
  }

  if (verification.attempts >= verification.maxAttempts) {
    throw { status: 429, message: "Too many incorrect attempts." };
  }

  const isMatch = verification.codeHash === hashCode(code);
  if (!isMatch) {
    verification.attempts += 1;
    await verification.save();
    throw { status: 400, message: "Invalid verification code." };
  }

  verification.consumedAt = new Date();
  await verification.save();

  const verificationToken = createVerificationToken({
    type: "contact_verification",
    verificationRequestId: String(verification._id),
    channel: verification.channel,
    purpose: verification.purpose,
    targetValue: verification.targetValue,
    userId: verification.userId ? String(verification.userId) : "",
    verifiedAt: verification.consumedAt.toISOString(),
  });

  return {
    verificationToken,
    verification: {
      channel: verification.channel,
      purpose: verification.purpose,
      targetValue: verification.targetValue,
      verifiedAt: verification.consumedAt.toISOString(),
    },
  };
}

export async function validateContactVerificationToken({
  token,
  channel,
  purpose,
  targetValue,
  userId = null,
}) {
  if (!token || typeof token !== "string") {
    throw { status: 400, message: "verification token is required." };
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw { status: 400, message: "Invalid or expired verification token." };
  }

  if (payload?.type !== "contact_verification") {
    throw { status: 400, message: "Invalid verification token type." };
  }

  const expectedChannel = ensureChannel(channel);
  const expectedPurpose = ensurePurpose(purpose);
  const expectedTarget = ensureTargetByChannel(expectedChannel, targetValue);
  const expectedUserId = userId ? String(userId) : "";

  if (payload.channel !== expectedChannel || payload.purpose !== expectedPurpose) {
    throw { status: 400, message: "Verification token context mismatch." };
  }

  if (String(payload.targetValue || "") !== expectedTarget) {
    throw { status: 400, message: "Verification token target mismatch." };
  }

  if (expectedUserId && String(payload.userId || "") !== expectedUserId) {
    throw { status: 400, message: "Verification token user mismatch." };
  }

  // Firebase-issued tokens skip DB record check
  if (payload.via === "firebase") {
    return payload;
  }

  const verificationRequestId = String(payload.verificationRequestId || "");
  if (!mongoose.Types.ObjectId.isValid(verificationRequestId)) {
    throw { status: 400, message: "Verification token request mismatch." };
  }

  const record = await ContactVerification.findById(verificationRequestId)
    .select("_id consumedAt channel purpose targetValue userId")
    .lean();

  if (!record || !record.consumedAt) {
    throw { status: 400, message: "Verification token is no longer valid." };
  }

  if (
    record.channel !== expectedChannel ||
    record.purpose !== expectedPurpose ||
    String(record.targetValue || "") !== expectedTarget
  ) {
    throw { status: 400, message: "Verification token does not match request." };
  }

  if (expectedUserId && String(record.userId || "") !== expectedUserId) {
    throw { status: 400, message: "Verification token does not match user." };
  }

  return payload;
}
