import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import UserCollection from "../models/UserModel.js";

const DEFAULT_SESSION_HOURS = 24;

function getAuthCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: DEFAULT_SESSION_HOURS * 60 * 60 * 1000,
  };
}

function signAuthToken(user) {
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
}

function getFirebaseAdmin() {
  // firebase-admin may already be initialized by firebaseController
  try {
    return admin.app();
  } catch {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId || projectId === "your_project_id") {
      throw { status: 503, message: "Firebase not configured." };
    }
    admin.initializeApp({ projectId });
    return admin.app();
  }
}

export async function googleLogin(req, res) {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: "idToken is required." });

    const firebaseApp = getFirebaseAdmin();
    const decoded = await firebaseApp.auth().verifyIdToken(idToken);

    const email = String(decoded.email || "").trim().toLowerCase();
    const name = String(decoded.name || decoded.email?.split("@")[0] || "User").trim();
    const profileImageUrl = String(decoded.picture || "").trim();

    if (!email) return res.status(400).json({ error: "Google account has no email." });

    let user = await UserCollection.findOne({ email }).lean();

    if (!user) {
      // Auto-create customer account for Google sign-in
      user = await UserCollection.create({
        name,
        email,
        phone: `google_${Date.now()}`, // placeholder — user can update later
        passwordHash: `google_oauth_${decoded.uid}`,
        role: "customer",
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        profileImageUrl,
      });
      user = user.toObject();
    } else if (profileImageUrl && !user.profileImageUrl) {
      await UserCollection.findByIdAndUpdate(user._id, { $set: { profileImageUrl } });
      user = { ...user, profileImageUrl };
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Account is blocked." });
    }

    const token = signAuthToken(user);
    res.cookie("auth_token", token, getAuthCookieOptions());

    return res.status(200).json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImageUrl: user.profileImageUrl || "",
        isEmailVerified: Boolean(user.isEmailVerified),
        isPhoneVerified: Boolean(user.isPhoneVerified),
      },
    });
  } catch (error) {
    if (error.code === "auth/id-token-expired") {
      return res.status(400).json({ error: "Google token expired. Please try again." });
    }
    return res.status(error.status || 500).json({ error: error.message || "Google login failed." });
  }
}
