import {
  SAFE_API_URL,
  apiCall,
  parseResponse,
  toQuery,
  validateId,
} from "./apiClient.js";

function validateSlug(slug) {
  if (!slug || typeof slug !== "string") {
    throw new Error("Slug must be a non-empty string.");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    throw new Error("Invalid slug format.");
  }
  if (slug.length > 100) {
    throw new Error("Slug cannot exceed 100 characters.");
  }
  return slug;
}

function validateDeliveryId(deliveryId) {
  if (!deliveryId || typeof deliveryId !== "string") {
    throw new Error("Delivery ID must be a non-empty string.");
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(deliveryId)) {
    throw new Error("Invalid Delivery ID format.");
  }

  return deliveryId;
}

export async function submitMyDeliveryReview(deliveryId, payload) {
  const validatedId = validateDeliveryId(deliveryId);
  const res = await apiCall(`${SAFE_API_URL}/deliveries/me/${validatedId}/review`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(res, "Failed to save review.");
  return data?.review || null;
}

export async function fetchPhotographerReviewsBySlug(slug, params = {}) {
  const validatedSlug = validateSlug(slug);
  const q = toQuery(params);
  const res = await apiCall(
    `${SAFE_API_URL}/photographers/${validatedSlug}/reviews${q ? `?${q}` : ""}`,
  );

  const data = await parseResponse(res, "Failed to load reviews.");
  return {
    items: data?.items || [],
    pagination: data?.pagination || {
      page: 1,
      limit: 6,
      totalPages: 1,
      total: 0,
    },
    summary: data?.summary || {
      avgRating: 0,
      totalReviews: 0,
    },
  };
}

export async function fetchAdminModerationReviews(params = {}) {
  const q = toQuery(params);
  const res = await apiCall(`${SAFE_API_URL}/admin/reviews${q ? `?${q}` : ""}`);

  return parseResponse(res, "Failed to load moderation reviews.");
}

export async function moderateAdminReviewStatus(reviewId, payload) {
  const validatedId = validateId(reviewId, "Review ID");
  const res = await apiCall(
    `${SAFE_API_URL}/admin/reviews/${validatedId}/moderate`,
    {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    },
  );

  const data = await parseResponse(res, "Failed to update review moderation.");
  return data?.review || null;
}

export async function reportReviewAbuse(reviewId, reason = "") {
  const validatedId = validateId(reviewId, "Review ID");
  const res = await apiCall(`${SAFE_API_URL}/reviews/${validatedId}/report`, {
    method: "POST",
    body: JSON.stringify({
      reason: String(reason || "").trim(),
    }),
  });
  return parseResponse(res, "Failed to report review.");
}
