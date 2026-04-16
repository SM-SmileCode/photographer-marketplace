import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  createPaymentOrder,
  verifyPayment,
  getPaymentStatus,
  getPhotographerPaymentSummary,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/bookings/:bookingId/payment/order", requireAuth, createPaymentOrder);
router.post("/bookings/:bookingId/payment/verify", requireAuth, verifyPayment);
router.get("/bookings/:bookingId/payment/status", requireAuth, getPaymentStatus);
router.get("/photographer/payment/summary", requireAuth, getPhotographerPaymentSummary);

export default router;
