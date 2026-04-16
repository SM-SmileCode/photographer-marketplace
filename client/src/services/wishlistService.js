import {
  SAFE_API_URL,
  apiCall,
  parseResponse,
  toQuery,
  validateId,
} from "./apiClient.js";

function normalizeWishlistError(error, fallbackMessage) {
  const status = Number(error?.status || error?.response?.status || 0);

  if (status === 401) {
    const authError = new Error("Please log in again to manage your wishlist.");
    authError.status = 401;
    return authError;
  }

  if (status === 403) {
    const roleError = new Error("Wishlist is available only for customer accounts.");
    roleError.status = 403;
    return roleError;
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

export async function fetchMyWishlist(params = {}) {
  try {
    const q = toQuery(params);
    const res = await apiCall(`${SAFE_API_URL}/wishlist/me${q ? `?${q}` : ""}`);
    return parseResponse(res, "Failed to load wishlist.");
  } catch (error) {
    throw normalizeWishlistError(error, "Failed to load wishlist.");
  }
}

export async function addToMyWishlist(photographerId) {
  try {
    const validatedId = validateId(photographerId, "Photographer ID");
    const res = await apiCall(`${SAFE_API_URL}/wishlist/me/${validatedId}`, {
      method: "POST",
    });
    return parseResponse(res, "Failed to add photographer to wishlist.");
  } catch (error) {
    throw normalizeWishlistError(
      error,
      "Failed to add photographer to wishlist.",
    );
  }
}

export async function removeFromMyWishlist(photographerId) {
  try {
    const validatedId = validateId(photographerId, "Photographer ID");
    const res = await apiCall(`${SAFE_API_URL}/wishlist/me/${validatedId}`, {
      method: "DELETE",
    });
    return parseResponse(res, "Failed to remove photographer from wishlist.");
  } catch (error) {
    throw normalizeWishlistError(
      error,
      "Failed to remove photographer from wishlist.",
    );
  }
}

export async function checkMyWishlistItem(photographerId) {
  try {
    const validatedId = validateId(photographerId, "Photographer ID");
    const res = await apiCall(
      `${SAFE_API_URL}/wishlist/me/${validatedId}/check`,
    );
    return parseResponse(res, "Failed to check wishlist item.");
  } catch (error) {
    const status = Number(error?.status || error?.response?.status || 0);
    if (status === 401 || status === 403) {
      return { saved: false };
    }
    throw normalizeWishlistError(error, "Failed to check wishlist item.");
  }
}
