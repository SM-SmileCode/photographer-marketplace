import express from "express";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  cancelAdminBooking,
  getAdminAnalytics,
  getAdminReports,
  listAdminBookings,
  listAdminPhotographerRequests,
  listAdminUsers,
  updateAdminPhotographerRequestStatus,
  updateAdminUserBlockStatus,
} from "../controllers/adminController.js";

const router = express.Router();

router.use("/admin", requireAuth, requireAdmin);

router.get("/admin/photographer-requests", listAdminPhotographerRequests);
router.patch(
  "/admin/photographer-requests/:profileId/status",
  updateAdminPhotographerRequestStatus,
);
router.get("/admin/users", listAdminUsers);
router.patch("/admin/users/:userId/block", updateAdminUserBlockStatus);
router.get("/admin/bookings", listAdminBookings);
router.patch("/admin/bookings/:bookingId/cancel", cancelAdminBooking);
router.get("/admin/reports", getAdminReports);
router.get("/admin/analytics", getAdminAnalytics);

export default router;
