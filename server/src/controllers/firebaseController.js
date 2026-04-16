import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import UserCollection from "../models/UserModel.js";

let firebaseInitialized = false;

function getFirebaseAdmin() {
  if (!firebaseInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId || projectId === "your_project_id") {
      throw { status: 503, message: "Firebase not configured." };
    }
    admin.initializeApp({ projectId });
    firebaseInitialized = true;
  }
  return admin;
}

const CONTACT_VERIFICATION_TOKEN_TTL = process.env.CONTACT_VERIFICATION_TOKEN_TTL || "30m";
const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

function normalizePhone(value) {
  return String(value || "").trim();
}

function createVerificationToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: CONTACT_VERIFICATION_TOKEN_TTL,
  });
}

export async function verifyFirebasePhoneToken(req, res) {
  try {
    const { idToken, phone, purpose, userId = null } = req.body || {};

    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "idToken is required." });
    }

    const allowedPurposes = ["signup", "update_phone"];
    const safePurpose = String(purpose || "").trim().toLowerCase();
    if (!allowedPurposes.includes(safePurpose)) {
      return res.status(400).json({ error: "Invalid purpose." });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !PHONE_REGEX.test(normalizedPhone)) {
      return res.status(400).json({ error: "Valid phone is required." });
    }

    const firebaseAdminApp = getFirebaseAdmin();
    const decoded = await firebaseAdminApp.auth().verifyIdToken(idToken);

    // Firebase phone number is in E.164 format e.g. +919876543210
    // We accept if the decoded phone ends with the digits of the provided phone
    const firebasePhone = String(decoded.phone_number || "").replace(/\D/g, "");
    const inputPhone = normalizedPhone.replace(/\D/g, "");

    if (!firebasePhone || !firebasePhone.endsWith(inputPhone.slice(-10))) {
      return res.status(400).json({ error: "Phone number mismatch." });
    }

    if (safePurpose === "signup") {
      const existing = await UserCollection.findOne({ phone: normalizedPhone })
        .select("_id")
        .lean();
      if (existing) {
        return res.status(409).json({ error: "Phone Already Exists" });
      }
    }

    if (safePurpose === "update_phone") {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const existing = await UserCollection.findOne({
        phone: normalizedPhone,
        _id: { $ne: req.user.userId },
      })
        .select("_id")
        .lean();
      if (existing) {
        return res.status(409).json({ error: "Phone Already Exists" });
      }
    }

    const verificationToken = createVerificationToken({
      type: "contact_verification",
      channel: "phone",
      purpose: safePurpose,
      targetValue: normalizedPhone,
      userId: userId ? String(userId) : (req.user?.userId || ""),
      verifiedAt: new Date().toISOString(),
      via: "firebase",
    });

    return res.status(200).json({
      success: true,
      verificationToken,
      verification: {
        channel: "phone",
        purpose: safePurpose,
        targetValue: normalizedPhone,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error.code === "auth/id-token-expired") {
      return res.status(400).json({ error: "Firebase token expired. Please try again." });
    }
    if (error.code === "auth/argument-error" || error.code === "auth/invalid-id-token") {
      return res.status(400).json({ error: "Invalid Firebase token." });
    }
    return res.status(error.status || 500).json({
      error: error.message || "Phone verification failed.",
    });
  }
}
