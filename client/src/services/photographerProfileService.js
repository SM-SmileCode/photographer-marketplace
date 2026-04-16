import { SAFE_API_URL } from "./apiClient";

async function parseResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || fallbackMessage);
  }
  return data;
}

export async function getMyPhotographerProfile() {
  const res = await fetch(`${SAFE_API_URL}/photographer-profile/me`, {
    method: "GET",
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 404) {
    return { profile: null };
  }

  if (!res.ok) {
    throw new Error(data?.error || "Failed to fetch profile");
  }
  return data;
}

export async function createMyPhotographerProfile(payload) {
  const res = await fetch(`${SAFE_API_URL}/photographer-profile`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(res, "Failed to create profile");
}

export async function updateMyPhotographerProfile(payload) {
  const res = await fetch(`${SAFE_API_URL}/photographer-profile/me`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(res, "Failed to update profile");
}

export async function getPhotographerProfileFormConfig() {
  const res = await fetch(`${SAFE_API_URL}/photographer/profile-config`);

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Failed to fetch config");
  }

  return data;
}

export async function uploadPhotographerImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`${SAFE_API_URL}/photographer/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return parseResponse(res, "Failed to upload image");
}

export async function removePortfolioImage(index) {
  const res = await fetch(`${SAFE_API_URL}/photographer-profile/me/portfolio/${index}`, {
    method: "DELETE",
    credentials: "include",
  });
  return parseResponse(res, "Failed to remove portfolio image");
}
