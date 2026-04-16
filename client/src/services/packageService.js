import {
  SAFE_API_URL,
  apiCall,
  parseResponse,
  validateId,
} from "./apiClient.js";

export async function fetchMyPackages() {
  const res = await apiCall(`${SAFE_API_URL}/photographer/packages/me`);
  return parseResponse(res, "Failed to fetch packages.");
}

export async function createPackage(payload) {
  const res = await apiCall(`${SAFE_API_URL}/photographer/packages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Failed to create package.");
}

export async function updatePackage(packageId, payload) {
  const validatedId = validateId(packageId, "Package ID");
  const res = await apiCall(
    `${SAFE_API_URL}/photographer/packages/${validatedId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return parseResponse(res, "Failed to update package.");
}

export async function deletePackage(packageId) {
  const validatedId = validateId(packageId, "Package ID");
  const res = await apiCall(
    `${SAFE_API_URL}/photographer/packages/${validatedId}`,
    {
      method: "DELETE",
    },
  );
  return parseResponse(res, "Failed to delete package.");
}

export async function fetchPhotographerPackages(photographerId) {
  const validatedId = validateId(photographerId, "Photographer ID");
  const res = await apiCall(
    `${SAFE_API_URL}/photographers/id/${validatedId}/packages`,
  );
  return parseResponse(res, "Failed to fetch packages.");
}
