import {
  listAdminModerationReviews,
  listPhotographerPublicReviewsBySlug,
  moderateReviewStatus,
  reportReviewAbuse,
  upsertCustomerDeliveryReview,
} from "../services/reviewService.js";
import { notifyReviewSubmitted } from "../services/bookingNotificationService.js";
import { runPhotographerTrustMaintenance } from "../services/trustService.js";

export async function listPhotographerReviews(req, res) {
  try {
    const result = await listPhotographerPublicReviewsBySlug(
      req.params.slug,
      req.query,
    );

    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to fetch photographer reviews.",
    });
  }
}

export async function upsertMyDeliveryReview(req, res) {
  try {
    if (!req.user || req.user.role !== "customer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const review = await upsertCustomerDeliveryReview({
      deliveryId: req.params.deliveryId,
      customerId: req.user.userId,
      rating: req.body?.rating,
      comment: req.body?.comment || "",
    });

    try {
      await notifyReviewSubmitted(review);
    } catch (notificationError) {
      console.error("[notify][review_submitted] failed", notificationError);
    }

    return res.status(200).json({ success: true, review });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to save review.",
    });
  }
}

export async function listAdminReviewsForModeration(req, res) {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }

    const result = await listAdminModerationReviews(req.query || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to fetch moderation reviews.",
    });
  }
}

export async function moderateReviewByAdmin(req, res) {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }

    const review = await moderateReviewStatus({
      reviewId: req.params.reviewId,
      status: req.body?.status,
      moderationNote: req.body?.moderationNote || "",
      adminRole: "admin",
    });

    return res.status(200).json({ success: true, review });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to moderate review.",
    });
  }
}

export async function reportReviewAbuseByUser(req, res) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const report = await reportReviewAbuse({
      reviewId: req.params.reviewId,
      reporterId: req.user.userId,
      reason: req.body?.reason || "",
    });

    await runPhotographerTrustMaintenance();

    return res.status(200).json({ success: true, report });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Failed to report review.",
    });
  }
}
