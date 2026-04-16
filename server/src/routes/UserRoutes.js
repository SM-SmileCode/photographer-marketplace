import express from "express";
import {
  signupUser,
  loginUser,
  logoutUser,
  me,
  requestContactVerificationCode,
  confirmContactVerificationCode,
  requestPasswordReset,
  resetPassword,
  updateMyProfile,
  updateMyEmail,
  updateMyPhone,
  updateMyProfileImage,
  getPublicHomeMetrics,
  getAdminDashboardMetrics,
} from "../controllers/userController.js";
import { verifyFirebasePhoneToken } from "../controllers/firebaseController.js";
import { googleLogin } from "../controllers/googleAuthController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signupUser);
router.post("/login", loginUser);
router.post("/verification/contact/request", requestContactVerificationCode);
router.post(
  "/verification/contact/request-auth",
  requireAuth,
  requestContactVerificationCode,
);
router.post("/verification/contact/confirm", confirmContactVerificationCode);
router.post("/verification/phone/firebase", verifyFirebasePhoneToken);
router.post("/verification/phone/firebase-auth", requireAuth, verifyFirebasePhoneToken);
router.post("/auth/google", googleLogin);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/logout", requireAuth, logoutUser);
router.get("/me", requireAuth, me);
router.patch("/me/profile", requireAuth, updateMyProfile);
router.patch("/me/email", requireAuth, updateMyEmail);
router.patch("/me/phone", requireAuth, updateMyPhone);
router.patch("/me/profile-image", requireAuth, updateMyProfileImage);
router.get("/home/metrics", getPublicHomeMetrics);
router.get("/admin/dashboard/metrics", requireAuth, requireAdmin, getAdminDashboardMetrics);

export default router;
