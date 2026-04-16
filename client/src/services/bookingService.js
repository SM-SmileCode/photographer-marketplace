import {
  SAFE_API_URL,
  parseResponse,
  toQuery,
  validateId,
  validateQueryParams,
  validateRespondPayload,
  apiCall,
} from "./apiClient.js";

export async function createBooking(payload, { timeoutMs = 15000 } = {}) {
  const requestPromise = apiCall(`${SAFE_API_URL}/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((res) => parseResponse(res, "Failed to create booking."));

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return requestPromise;
  }

  let timerId;
  try {
    return await Promise.race([
      requestPromise,
      new Promise((_, reject) => {
        timerId = setTimeout(() => {
          reject(
            new Error(
              "Booking request timed out. Please check your connection and refresh My Bookings.",
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

export async function fetchMyBookings(params = {}) {
  const q = toQuery(params);
  const res = await apiCall(`${SAFE_API_URL}/bookings/me${q ? `?${q}` : ""}`);
  return parseResponse(res, "Failed to fetch bookings.");
}

export async function cancelMyBooking(bookingId, reason = "") {
  const validatedId = validateId(bookingId, "Booking ID");

  const res = await apiCall(`${SAFE_API_URL}/bookings/${validatedId}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ reason: String(reason).slice(0, 500) }),
  });

  return parseResponse(res, "Failed to cancel booking.");
}

export async function fetchPhotographerBooking(params = {}) {
  const validatedParams = validateQueryParams(params);
  const q = toQuery(validatedParams);

  const res = await apiCall(
    `${SAFE_API_URL}/photographer/bookings${q ? `?${q}` : ""}`,
  );
  return parseResponse(res, "Failed to fetch booking requests.");
}

export async function fetchPhotographerEarnings() {
  const res = await apiCall(`${SAFE_API_URL}/photographer/earnings/me`);
  return parseResponse(res, "Failed to fetch earnings.");
}

export async function respondToBooking(bookingId, payload) {
  const validatedId = validateId(bookingId, "Booking ID");
  const validatedPayload = validateRespondPayload(payload);

  const res = await apiCall(
    `${SAFE_API_URL}/photographer/bookings/${validatedId}/respond`,
    {
      method: "PATCH",
      body: JSON.stringify(validatedPayload),
    },
  );
  return parseResponse(res, "Failed to respond to booking.");
}

export async function markBookingCompleted(bookingId) {
  const validatedId = validateId(bookingId, "Booking ID");
  const res = await apiCall(
    `${SAFE_API_URL}/bookings/${validatedId}/complete`,
    {
      method: "PATCH",
    },
  );
  return parseResponse(res, "Failed to mark booking as completed.");
}

// Delivery
export async function fetchPhotographerDeliveries() {
  const res = await apiCall(`${SAFE_API_URL}/photographer/deliveries`);
  return parseResponse(res, "Failed to fetch deliveries.");
}

export async function updatePhotographerDeliveryFields(deliveryId, payload) {
  const validatedId = validateId(deliveryId, "Delivery ID");
  const res = await apiCall(
    `${SAFE_API_URL}/photographer/deliveries/${validatedId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

  return parseResponse(res, "Failed to update delivery.");
}

export async function updatePhotographerDeliveryStatus(
  deliveryId,
  status,
  note = "",
) {
  const validatedId = validateId(deliveryId, "Delivery ID");
  const res = await apiCall(
    `${SAFE_API_URL}/photographer/deliveries/${validatedId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    },
  );
  return parseResponse(res, "Failed to update delivery status.");
}

export async function fetchMyDeliveries(params = {}) {
  const validatedParams = validateQueryParams(params, [
    "status",
    "page",
    "limit",
  ], [
    "event_done",
    "editing",
    "preview_uploaded",
    "final_delivered",
    "customer_confirmed",
  ]);
  const q = toQuery(validatedParams);

  const res = await apiCall(`${SAFE_API_URL}/deliveries/me${q ? `?${q}` : ""}`);
  return parseResponse(res, "Failed to fetch my deliveries.");
}

export async function fetchMyDelivery(deliveryId) {
  const validatedId = validateId(deliveryId, "Delivery ID");
  const res = await apiCall(`${SAFE_API_URL}/deliveries/me/${validatedId}`);
  return parseResponse(res, "Failed to fetch delivery.");
}

export async function confirmMyDelivery(deliveryId, note = "") {
  const validatedId = validateId(deliveryId, "Delivery ID");

  const res = await apiCall(
    `${SAFE_API_URL}/deliveries/me/${validatedId}/confirm`,
    {
      method: "PATCH",
      body: JSON.stringify({ note: String(note).slice(0, 500) }),
    },
  );

  return parseResponse(res, "Failed to confirm delivery.");
}

export async function updateMyDeliveryFeedback(
  deliveryId,
  customerFeedback = "",
) {
  const validatedId = validateId(deliveryId, "Delivery ID");

  const res = await apiCall(
    `${SAFE_API_URL}/deliveries/me/${validatedId}/feedback`,
    {
      method: "PATCH",
      body: JSON.stringify({
        customerFeedback: String(customerFeedback).slice(0, 1000),
      }),
    },
  );

  return parseResponse(res, "Failed to submit feedback.");
}
