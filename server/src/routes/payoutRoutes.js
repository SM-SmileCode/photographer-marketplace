import express from "express";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import {
  listPayouts,
  createPayout,
  updatePayoutStatus,
  getPayoutSummary,
} from "../controllers/payoutController.js";

const router = express.Router();

router.get("/admin/payouts", requireAuth, requireAdmin, listPayouts);
router.post("/admin/payouts", requireAuth, requireAdmin, createPayout);
router.patch("/admin/payouts/:payoutId/status", requireAuth, requireAdmin, updatePayoutStatus);
router.get("/admin/payouts/summary", requireAuth, requireAdmin, getPayoutSummary);

export default router;
