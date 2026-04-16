import {
  SAFE_API_URL,
  parseResponse,
  toQuery,
  validateId,
  apiCall,
} from "./apiClient.js";

// Validate slug format (prevent path traversal)
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

export async function fetchPhotographers(params = {}) {
  const q = toQuery(params);
  const res = await apiCall(`${SAFE_API_URL}/photographers?${q}`);
  const data = await parseResponse(res, "Failed to load photographers");

  return {
    items: data.items || [],
    pagination: data.pagination || {
      page: 1,
      limit: 12,
      totalPages: 1,
      total: 0,
    },
  };
}

export async function fetchPhotographerById(id) {
  const validatedId = validateId(id, "Photographer ID");
  const res = await apiCall(`${SAFE_API_URL}/photographers/id/${validatedId}`);
  const data = await parseResponse(res, "Failed to load photographer.");

  return data?.profile || null;
}

export async function fetchPhotographersBySlug(slug) {
  const validatedSlug = validateSlug(slug);
  const res = await apiCall(`${SAFE_API_URL}/photographers/${validatedSlug}`);
  const data = await parseResponse(res, "Failed to load photographer profile");

  return data?.profile || null;
}

export async function fetchHomeMetrics() {
  const res = await apiCall(`${SAFE_API_URL}/home/metrics`);
  return parseResponse(res, "Failed to load home metrics.");
}
