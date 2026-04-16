import express from "express";
import {
  deleteMyAvailabilityOverride,
  getMyAvailability,
  getPhotographerAvailableSlots,
  listMyAvailabilityOverrides,
  upsertMyAvailability,
  upsertMyAvailabilityOverride,
  bulkBlockDates,
} from "../controllers/availabilityController.js";
import {
  createMyPhotographerProfile,
  getPhotographerById,
  getPhotographerBySlug,
  getPhotographerProfile,
  getPhotographerProfileFormConfig,
  listPhotographers,
  updateMyPhotographerProfile,
  removePortfolioImage,
} from "../controllers/photographerProfile.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  listAdminReviewsForModeration,
  listPhotographerReviews,
  moderateReviewByAdmin,
  reportReviewAbuseByUser,
} from "../controllers/reviewController.js";
import { createInMemoryRateLimiter } from "../middleware/rateLimit.js";

import {
  createPackage,
  deletePackage,
  listMyPackages,
  listPhotographerPackages,
  updatePackage,
} from "../controllers/packageController.js";

const router = express.Router();

const publicListLimiter = createInMemoryRateLimiter({
  prefix: "public-list",
  windowMs: 60_000,
  max: 60,
});

// Public browse routes (rate limited)
router.get("/photographers", publicListLimiter, listPhotographers);
router.get("/photographers/id/:id", publicListLimiter, getPhotographerById);
router.get("/photographers/:slug/reviews", publicListLimiter, listPhotographerReviews);
router.get("/photographers/:slug", publicListLimiter, getPhotographerBySlug);

// Packages - public (rate limited)
router.get("/photographers/id/:id/packages", publicListLimiter, listPhotographerPackages);

// Availability slots — requires auth (customers must be logged in to book)
router.get("/photographers/id/:id/availability", requireAuth, getPhotographerAvailableSlots);

// Review abuse report — requires auth
router.post("/reviews/:reviewId/report", requireAuth, reportReviewAbuseByUser);

// Admin review routes
router.get("/admin/reviews", requireAuth, requireAdmin, listAdminReviewsForModeration);
router.patch(
  "/admin/reviews/:reviewId/moderate",
  requireAuth,
  requireAdmin,
  moderateReviewByAdmin,
);

// Photographer profile (protected)
router.post("/photographer-profile", requireAuth, createMyPhotographerProfile);
router.get("/photographer-profile/me", requireAuth, getPhotographerProfile);
router.patch(
  "/photographer-profile/me",
  requireAuth,
  updateMyPhotographerProfile,
);
router.delete(
  "/photographer-profile/me/portfolio/:index",
  requireAuth,
  removePortfolioImage,
);

// Availability (protected)
router.get("/photographer/availability/me", requireAuth, getMyAvailability);
router.put("/photographer/availability/me", requireAuth, upsertMyAvailability);
router.get(
  "/photographer/availability/overrides",
  requireAuth,
  listMyAvailabilityOverrides,
);
router.put(
  "/photographer/availability/overrides/:date",
  requireAuth,
  upsertMyAvailabilityOverride,
);
router.delete(
  "/photographer/availability/overrides/:date",
  requireAuth,
  deleteMyAvailabilityOverride,
);
router.post("/photographer/availability/bulk-block", requireAuth, bulkBlockDates);

// Profile config — public static data (event types, services list)
router.get("/photographer/profile-config", getPhotographerProfileFormConfig);

// Packages - photographer (protected)
router.post("/photographer/packages", requireAuth, createPackage);
router.get("/photographer/packages/me", requireAuth, listMyPackages);
router.patch("/photographer/packages/:packageId", requireAuth, updatePackage);
router.delete("/photographer/packages/:packageId", requireAuth, deletePackage);

export default router;
