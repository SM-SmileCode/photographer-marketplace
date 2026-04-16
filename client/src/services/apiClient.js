// Common API Client Utility
// Centralized API configuration, validation, and request handling

const DEFAULT_DEV_API_URL = "http://localhost:4000";
const RAW_API_BASE_URL = (import.meta.env.VITE_API_URL || "").trim();
const IS_PRODUCTION = import.meta.env.MODE === "production";
const ALLOW_PRIVATE_API_URL = import.meta.env.VITE_ALLOW_PRIVATE_API_URL === "true";

function normalizeUrl(url) {
  return url.toString().replace(/\/$/, "");
}

// Validate API URL and block private IP ranges
function isPrivateHostname(hostname) {
  const privateRanges = [
    /^localhost$/i,
    /^127\./,
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];

  return privateRanges.some((range) => range.test(hostname));
}

function validateApiUrl(url) {
  try {
    const browserOrigin =
      typeof window !== "undefined" ? window.location.origin : DEFAULT_DEV_API_URL;
    const urlObj = new URL(url, browserOrigin);
    const isPrivate = isPrivateHostname(urlObj.hostname);

    if (isPrivate && IS_PRODUCTION && !ALLOW_PRIVATE_API_URL) {
      throw new Error("Access to private IP ranges is not allowed.");
    }

    return normalizeUrl(urlObj);
  } catch (error) {
    throw new Error(`Invalid API URL: ${error.message}`);
  }
}

function resolveApiUrl() {
  const fallback = typeof window !== "undefined"
    ? window.location.origin
    : DEFAULT_DEV_API_URL;
  const configured =
    RAW_API_BASE_URL || (IS_PRODUCTION ? fallback : DEFAULT_DEV_API_URL);

  try {
    return validateApiUrl(configured);
  } catch (error) {
    // Never crash the app at module-load time due to URL env misconfiguration.
    console.warn(`[apiClient] ${error.message} Falling back to ${fallback}.`);
    return normalizeUrl(new URL(fallback));
  }
}

export const SAFE_API_URL = resolveApiUrl();

function createApiError(message, status = 0, payload = {}) {
  const error = new Error(message || "Request failed.");
  error.name = "ApiError";
  error.status = Number.isFinite(status) ? status : 0;
  error.payload = payload || {};
  error.response = {
    status: error.status,
    payload: error.payload,
  };
  return error;
}

// Parse API response
export async function parseResponse(res, fallbackMessage) {
  if (!res || typeof res.ok !== "boolean") {
    throw createApiError(fallbackMessage || "No response from server.");
  }

  const raw = await res.text().catch(() => "");
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
  }

  if (!res.ok) {
    throw createApiError(
      data?.error || fallbackMessage || "Request failed.",
      res.status,
      data,
    );
  }

  return data;
}

// Convert params object to query string
export function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value != null) query.set(key, String(value));
  });
  return query.toString();
}

// Validate ID format (alphanumeric, hyphens, underscores)
export function validateId(id, fieldName = "ID") {
  if (!id || typeof id !== "string") {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid ${fieldName} format.`);
  }
  return id;
}

// Validate query parameters with whitelist
export function validateQueryParams(
  params,
  allowedParams = ["status", "page", "limit", "sort"],
  validStatuses = [
    "pending",
    "accepted",
    "rejected",
    "cancelled",
    "completed",
    "expired",
  ],
) {
  const validated = {};

  Object.entries(params).forEach(([key, value]) => {
    if (!allowedParams.includes(key)) {
      throw new Error(`Invalid query parameter: ${key}`);
    }

    if (key === "page" || key === "limit") {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        throw new Error(`${key} must be a positive number.`);
      }
      validated[key] = num;
    } else if (key === "status") {
      if (value === "") {
        validated[key] = "";
      } else {
        if (!validStatuses.includes(String(value).toLowerCase())) {
          throw new Error(`Invalid status: ${value}`);
        }
        validated[key] = String(value).toLowerCase();
      }
    } else {
      validated[key] = String(value).slice(0, 50);
    }
  });

  return validated;
}

// Validate respond payload
export function validateRespondPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object.");
  }

  const { action, note } = payload;
  const validActions = ["accept", "reject"];

  if (!validActions.includes(action)) {
    throw new Error(
      `Invalid action. Must be one of: ${validActions.join(", ")}`,
    );
  }

  if (note !== undefined && typeof note !== "string") {
    throw new Error("Note must be a string.");
  }

  const noteLength = (note || "").length;
  if (noteLength > 1000) {
    throw new Error("Note cannot exceed 1000 characters.");
  }

  return {
    action,
    note: (note || "").slice(0, 1000),
  };
}

// Generic fetch wrapper with error handling
export async function apiCall(url, options = {}) {
  const defaultOptions = {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  try {
    const res = await fetch(url, { ...defaultOptions, ...options });
    return res;
  } catch (error) {
    throw createApiError(
      error?.message || "Network request failed.",
      0,
      { error: error?.message || "Network request failed." },
    );
  }
}
