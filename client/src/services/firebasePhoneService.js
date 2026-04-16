import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { firebaseAuth } from "./firebaseConfig";
import { SAFE_API_URL, apiCall, parseResponse } from "./apiClient";

let recaptchaVerifier = null;

export function setupRecaptcha(containerId) {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch { /* already destroyed */ }
    recaptchaVerifier = null;
  }
  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: "invisible",
  });
  return recaptchaVerifier;
}

export function clearRecaptcha() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch { /* already destroyed */ }
    recaptchaVerifier = null;
  }
}

let confirmationResult = null;

export async function sendFirebasePhoneOtp(phone, containerId = "recaptcha-container") {
  const verifier = setupRecaptcha(containerId);
  const formattedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
  confirmationResult = await signInWithPhoneNumber(firebaseAuth, formattedPhone, verifier);
  return confirmationResult;
}

export async function confirmFirebasePhoneOtp(code) {
  if (!confirmationResult) throw new Error("No OTP request in progress.");
  const result = await confirmationResult.confirm(code);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function exchangeFirebaseTokenForVerificationToken({ idToken, phone, purpose, userId = null }) {
  const res = await apiCall(`${SAFE_API_URL}/verification/phone/firebase`, {
    method: "POST",
    body: JSON.stringify({ idToken, phone, purpose, userId }),
  });
  return parseResponse(res, "Failed to verify phone.");
}
