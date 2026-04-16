import { SAFE_API_URL, apiCall, parseResponse } from "./apiClient.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function loginUser({ email, password, rememberMe = false }) {
  const payload = {
    email: normalizeEmail(email),
    password: String(password || ""),
    rememberMe: Boolean(rememberMe),
  };

  const res = await apiCall(`${SAFE_API_URL}/login`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return parseResponse(res, "Login failed.");
}

export async function signupUser(payload) {
  const safePayload = {
    ...payload,
    email: normalizeEmail(payload?.email),
    phone: String(payload?.phone || "").trim(),
    emailVerificationToken: String(payload?.emailVerificationToken || ""),
  };

  const res = await apiCall(`${SAFE_API_URL}/signup`, {
    method: "POST",
    body: JSON.stringify(safePayload),
  });

  return parseResponse(res, "Signup failed.");
}

export async function requestContactVerification({
  channel,
  value,
  purpose,
  authRequired = false,
}) {
  const endpoint = authRequired
    ? "/verification/contact/request-auth"
    : "/verification/contact/request";
  const payload = {
    channel: String(channel || "").trim().toLowerCase(),
    value:
      String(channel || "").trim().toLowerCase() === "email"
        ? normalizeEmail(value)
        : String(value || "").trim(),
    purpose: String(purpose || "").trim().toLowerCase(),
  };

  const res = await apiCall(`${SAFE_API_URL}${endpoint}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return parseResponse(res, "Failed to request verification code.");
}

export async function confirmContactVerification({
  verificationRequestId,
  code,
}) {
  const res = await apiCall(`${SAFE_API_URL}/verification/contact/confirm`, {
    method: "POST",
    body: JSON.stringify({
      verificationRequestId: String(verificationRequestId || "").trim(),
      code: String(code || "").trim(),
    }),
  });

  return parseResponse(res, "Failed to verify code.");
}

export async function requestPasswordReset(email) {
  const res = await apiCall(`${SAFE_API_URL}/forgot-password`, {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email) }),
  });

  return parseResponse(res, "Failed to request password reset.");
}

export async function fetchCurrentUser() {
  const res = await apiCall(`${SAFE_API_URL}/me`);
  return parseResponse(res, "Failed to fetch current user.");
}

export async function updateMyProfile({ name, phone }) {
  const res = await apiCall(`${SAFE_API_URL}/me/profile`, {
    method: "PATCH",
    body: JSON.stringify({
      name: String(name || "").trim(),
      phone: String(phone || "").trim(),
    }),
  });
  return parseResponse(res, "Failed to update profile.");
}

export async function resetPassword({ token, password, confirmPassword }) {
  const res = await apiCall(`${SAFE_API_URL}/reset-password`, {
    method: "POST",
    body: JSON.stringify({
      token: String(token || ""),
      password: String(password || ""),
      confirmPassword: String(confirmPassword || ""),
    }),
  });

  return parseResponse(res, "Failed to reset password.");
}

export async function updateMyEmail(email, verificationToken) {
  const res = await apiCall(`${SAFE_API_URL}/me/email`, {
    method: "PATCH",
    body: JSON.stringify({
      email: normalizeEmail(email),
      verificationToken: String(verificationToken || ""),
    }),
  });

  return parseResponse(res, "Failed to update email.");
}

export async function updateMyPhone(phone, verificationToken) {
  const res = await apiCall(`${SAFE_API_URL}/me/phone`, {
    method: "PATCH",
    body: JSON.stringify({
      phone: String(phone || "").trim(),
      verificationToken: String(verificationToken || ""),
    }),
  });

  return parseResponse(res, "Failed to update phone.");
}

export async function uploadUserImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${SAFE_API_URL}/user/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to upload image.");
  return data;
}

export async function updateMyProfileImage(imageUrl) {
  const res = await apiCall(`${SAFE_API_URL}/me/profile-image`, {
    method: "PATCH",
    body: JSON.stringify({ profileImageUrl: imageUrl }),
  });
  return parseResponse(res, "Failed to update profile image.");
}
