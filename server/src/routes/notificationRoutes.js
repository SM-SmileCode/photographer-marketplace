import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/notifications/me", requireAuth, listMyNotifications);
router.patch(
  "/notifications/me/read-all",
  requireAuth,
  markAllMyNotificationsRead,
);
router.patch(
  "/notifications/me/:notificationId/read",
  requireAuth,
  markMyNotificationRead,
);

export default router;
