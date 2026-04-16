import {
  SAFE_API_URL,
  apiCall,
  parseResponse,
  toQuery,
  validateId,
} from "./apiClient";

export async function fetchAdminDashboardMetrics() {
  const res = await apiCall(`${SAFE_API_URL}/admin/dashboard/metrics`);
  return parseResponse(res, "Failed to load admin dashboard metrics.");
}

export async function fetchAdminPhotographerRequests(params = {}) {
  const q = toQuery(params);
  const res = await apiCall(
    `${SAFE_API_URL}/admin/photographer-requests${q ? `?${q}` : ""}`,
  );
  return parseResponse(res, "Failed to load photographer requests.");
}

export async function updateAdminPhotographerRequestStatus(
  profileId,
  {
    action,
    rejectionReason = "",
    verificationChecklist = null,
    adminNote = "",
  } = {},
) {
  const validatedId = validateId(profileId, "Profile ID");
  const res = await apiCall(
    `${SAFE_API_URL}/admin/photographer-requests/${validatedId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: String(action || "").trim().toLowerCase(),
        rejectionReason: String(rejectionReason || "").trim(),
        verificationChecklist:
          verificationChecklist && typeof verificationChecklist === "object"
            ? verificationChecklist
            : undefined,
        adminNote: String(adminNote || "").trim(),
      }),
    },
  );
  return parseResponse(res, "Failed to update photographer request.");
}

export async function fetchAdminUsers(params = {}) {
  const q = toQuery(params);
  const res = await apiCall(`${SAFE_API_URL}/admin/users${q ? `?${q}` : ""}`);
  return parseResponse(res, "Failed to load users.");
}

export async function updateAdminUserBlockStatus(userId, isBlocked) {
  const validatedId = validateId(userId, "User ID");
  const res = await apiCall(`${SAFE_API_URL}/admin/users/${validatedId}/block`, {
    method: "PATCH",
    body: JSON.stringify({ isBlocked: Boolean(isBlocked) }),
  });
  return parseResponse(res, "Failed to update user status.");
}

export async function fetchAdminBookings(params = {}) {
  const q = toQuery(params);
  const res = await apiCall(
    `${SAFE_API_URL}/admin/bookings${q ? `?${q}` : ""}`,
  );
  return parseResponse(res, "Failed to load bookings.");
}

export async function cancelAdminBooking(bookingId, reason = "") {
  const validatedId = validateId(bookingId, "Booking ID");
  const res = await apiCall(
    `${SAFE_API_URL}/admin/bookings/${validatedId}/cancel`,
    {
      method: "PATCH",
      body: JSON.stringify({ reason: String(reason || "").trim() }),
    },
  );
  return parseResponse(res, "Failed to cancel booking.");
}

export async function fetchAdminReports() {
  const res = await apiCall(`${SAFE_API_URL}/admin/reports`);
  return parseResponse(res, "Failed to load reports.");
}

export async function fetchAdminAnalytics() {
  const res = await apiCall(`${SAFE_API_URL}/admin/analytics`);
  return parseResponse(res, "Failed to load analytics.");
}
