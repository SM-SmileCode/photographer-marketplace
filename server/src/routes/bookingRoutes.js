import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { createMongoRateLimiter } from "../middleware/rateLimit.js";
import {
  createBooking,
  cancelMyBooking,
  listMyBookings,
  listPhotographerBookings,
  respondToBooking,
  markBookingCompleted,
  listPhotographerDeliveries,
  listMyDeliveries,
  getMyDelivery,
  updatePhotographerDelivery,
  updatePhotographerDeliveryStatus,
  confirmMyDelivery,
  updateMyDeliveryFeedback,
  getPhotographerEarnings,
} from "../controllers/bookingController.js";
import { upsertMyDeliveryReview } from "../controllers/reviewController.js";

const router = express.Router();
const reviewWriteLimiter = createMongoRateLimiter({
  prefix: "delivery-review-write",
  windowMs: Number(process.env.REVIEW_WRITE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.REVIEW_WRITE_LIMIT_MAX || 10),
  message: "Too many review submissions. Please try again shortly.",
  failOpen: process.env.REVIEW_WRITE_LIMIT_FAIL_OPEN === "true",
});

router.post("/bookings", requireAuth, createBooking);
router.get("/bookings/me", requireAuth, listMyBookings);
router.get("/photographer/bookings", requireAuth, listPhotographerBookings);
router.patch("/bookings/:bookingId/cancel", requireAuth, cancelMyBooking);
router.patch(
  "/photographer/bookings/:bookingId/respond",
  requireAuth,
  respondToBooking,
);
router.get("/photographer/earnings/me", requireAuth, getPhotographerEarnings);
router.patch(
  "/bookings/:bookingId/complete",
  requireAuth,
  markBookingCompleted,
);

// Delivery
router.get("/photographer/deliveries", requireAuth, listPhotographerDeliveries);
router.patch(
  "/photographer/deliveries/:deliveryId",
  requireAuth,
  updatePhotographerDelivery,
);
router.patch(
  "/photographer/deliveries/:deliveryId/status",
  requireAuth,
  updatePhotographerDeliveryStatus,
);
router.get("/deliveries/me", requireAuth, listMyDeliveries);
router.get("/deliveries/me/:deliveryId", requireAuth, getMyDelivery);
router.patch(
  "/deliveries/me/:deliveryId/confirm",
  requireAuth,
  confirmMyDelivery,
);
router.patch(
  "/deliveries/me/:deliveryId/feedback",
  requireAuth,
  updateMyDeliveryFeedback,
);
router.put(
  "/deliveries/me/:deliveryId/review",
  requireAuth,
  reviewWriteLimiter,
  upsertMyDeliveryReview,
);


export default router;
