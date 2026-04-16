import {
  SAFE_API_URL,
  apiCall,
  parseResponse,
  toQuery,
  validateId,
} from "./apiClient.js";

function validateDateKey(date, fieldName = "Date") {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format.`);
  }

  return date.trim();
}

function validatePositiveInt(value, fieldName) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return parsed;
}

export async function fetchMyAvailability() {
  const res = await apiCall(`${SAFE_API_URL}/photographer/availability/me`);
  return parseResponse(res, "Failed to fetch availability.");
}

export async function saveMyAvailability(payload) {
  const res = await apiCall(`${SAFE_API_URL}/photographer/availability/me`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return parseResponse(res, "Failed to save availability.");
}

export async function fetchMyAvailabilityOverrides(params = {}) {
  const validated = {};

  if (params.dateFrom) validated.dateFrom = validateDateKey(params.dateFrom, "dateFrom");
  if (params.dateTo) validated.dateTo = validateDateKey(params.dateTo, "dateTo");

  const q = toQuery(validated);
  const res = await apiCall(
    `${SAFE_API_URL}/photographer/availability/overrides${q ? `?${q}` : ""}`,
  );

  return parseResponse(res, "Failed to fetch availability overrides.");
}

export async function saveMyAvailabilityOverride(date, payload) {
  const validatedDate = validateDateKey(date);
  const res = await apiCall(
    `${SAFE_API_URL}/photographer/availability/overrides/${validatedDate}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

  return parseResponse(res, "Failed to save availability override.");
}

export async function deleteMyAvailabilityOverride(date) {
  const validatedDate = validateDateKey(date);
  const res = await apiCall(
    `${SAFE_API_URL}/photographer/availability/overrides/${validatedDate}`,
    {
      method: "DELETE",
    },
  );

  return parseResponse(res, "Failed to delete availability override.");
}

export async function bulkBlockDates({ from, to, note = "" }) {
  validateDateKey(from, "from");
  validateDateKey(to, "to");
  const res = await apiCall(`${SAFE_API_URL}/photographer/availability/bulk-block`, {
    method: "POST",
    body: JSON.stringify({ from, to, note }),
  });
  return parseResponse(res, "Failed to bulk block dates.");
}

export async function fetchPhotographerAvailableSlots(
  photographerId,
  { date, durationMinutes } = {},
) {
  const validatedId = validateId(photographerId, "Photographer ID");
  const validatedDate = validateDateKey(date);

  const params = { date: validatedDate };

  if (durationMinutes != null && durationMinutes !== "") {
    params.durationMinutes = validatePositiveInt(
      durationMinutes,
      "durationMinutes",
    );
  }

  const q = toQuery(params);
  const res = await apiCall(
    `${SAFE_API_URL}/photographers/id/${validatedId}/availability?${q}`,
  );

  return parseResponse(res, "Failed to fetch available slots.");
}
