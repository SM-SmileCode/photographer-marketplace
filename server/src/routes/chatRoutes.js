import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getChatHistory, markMessagesRead, getUnreadCount } from "../controllers/chatController.js";

const router = express.Router();

router.get("/chat/:bookingId/messages", requireAuth, getChatHistory);
router.patch("/chat/:bookingId/read", requireAuth, markMessagesRead);
router.get("/chat/unread-count", requireAuth, getUnreadCount);

export default router;
