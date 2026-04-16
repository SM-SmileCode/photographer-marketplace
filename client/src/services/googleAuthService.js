import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { firebaseAuth } from "./firebaseConfig";
import { SAFE_API_URL, apiCall, parseResponse } from "./apiClient";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { idToken, user: result.user };
}

export async function loginWithGoogleToken(idToken) {
  const res = await apiCall(`${SAFE_API_URL}/auth/google`, {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
  return parseResponse(res, "Google login failed.");
}
