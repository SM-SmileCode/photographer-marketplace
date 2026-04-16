import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  addMyWishlistItem,
  checkMyWishlistItem,
  listMyWishlist,
  removeMyWishlistItem,
} from "../controllers/wishlistController.js";

const router = express.Router();

router.get("/wishlist/me", requireAuth, listMyWishlist);
router.get(
  "/wishlist/me/:photographerId/check",
  requireAuth,
  checkMyWishlistItem,
);
router.post("/wishlist/me/:photographerId", requireAuth, addMyWishlistItem);
router.delete(
  "/wishlist/me/:photographerId",
  requireAuth,
  removeMyWishlistItem,
);

export default router;
