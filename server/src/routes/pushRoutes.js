import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { subscribePush, unsubscribePush, getVapidPublicKey } from "../controllers/pushController.js";

const router = express.Router();

router.get("/push/vapid-public-key", getVapidPublicKey);
router.post("/push/subscribe", requireAuth, subscribePush);
router.post("/push/unsubscribe", requireAuth, unsubscribePush);

export default router;
