import { useState, useEffect, useId } from "react";
import {
  sendFirebasePhoneOtp,
  confirmFirebasePhoneOtp,
  exchangeFirebaseTokenForVerificationToken,
  clearRecaptcha,
} from "../services/firebasePhoneService";

/**
 * Drop-in replacement for the phone OTP section.
 * Props:
 *   phone          - current phone value
 *   purpose        - "signup" | "update_phone"
 *   userId         - required for update_phone
 *   onVerified(token, phone) - called with verificationToken on success
 *   onError(msg)   - called on error
 *   disabled       - disable all controls
 */
function FirebasePhoneOtp({ phone, purpose, userId, onVerified, onError, disabled, hideButton = false }) {
  const uid = useId();
  const containerId = `recaptcha-${uid.replace(/:/g, "")}`;

  const [step, setStep] = useState("idle"); // idle | sending | code_sent | verifying | done
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => clearRecaptcha(), []);

  useEffect(() => {
    if (step !== "idle") {
      clearRecaptcha();
      setStep("idle");
      setCode("");
      setMessage("");
      setError("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const handleSend = async () => {
    if (!phone?.trim()) {
      setError("Please enter your phone number first.");
      return;
    }
    setError("");
    setMessage("");
    setStep("sending");
    try {
      await sendFirebasePhoneOtp(phone.trim(), containerId);
      setStep("code_sent");
      setMessage("OTP sent to your phone.");
    } catch (err) {
      setStep("idle");
      const msg = err?.message || "Failed to send OTP.";
      setError(msg);
      onError?.(msg);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setError("");
    setStep("verifying");
    try {
      const idToken = await confirmFirebasePhoneOtp(code);
      const result = await exchangeFirebaseTokenForVerificationToken({
        idToken,
        phone: phone.trim(),
        purpose,
        userId,
      });
      setStep("done");
      setMessage("Phone verified successfully.");
      onVerified?.(result.verificationToken, phone.trim());
    } catch (err) {
      setStep("code_sent");
      const msg = err?.message || "Invalid OTP.";
      setError(msg);
      onError?.(msg);
    }
  };

  if (step === "done") {
    return (
      <p className="mt-1 text-xs text-emerald-700">✓ Phone verified successfully.</p>
    );
  }

  return (
    <div>
      <div id={containerId} />
      {!hideButton && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || step === "sending" || step === "verifying"}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF] disabled:opacity-60"
          >
            {step === "sending" ? "Sending..." : "Send OTP"}
          </button>

          {(step === "code_sent" || step === "verifying") && (
            <>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit OTP"
                className="w-32 rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={disabled || step === "verifying"}
                className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {step === "verifying" ? "Verifying..." : "Verify"}
              </button>
            </>
          )}
        </div>
      )}

      {message && <p className="mt-1 text-xs text-emerald-700">{message}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default FirebasePhoneOtp;
