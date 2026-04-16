import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../services/userService";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await requestPasswordReset(email);
      setMessage(
        result?.message ||
          "If an account exists for this email, reset instructions have been sent.",
      );
    } catch (submitError) {
      setError(submitError?.message || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-10 text-[var(--text)] sm:px-6 lg:px-8"
      style={{
        "--bg": "#F5F2EA",
        "--surface": "#FFFCF6",
        "--text": "#1F2937",
        "--muted": "#6B7280",
        "--line": "#E7E1D4",
        "--accent": "#0F766E",
        "--accent-hover": "#0B5E58",
      }}
    >
      <div className="mx-auto max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8">
        <h1 className="font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
          Forgot Password
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter your account email and we will send you a password reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="forgot-email"
              className="mb-2 block text-sm font-semibold text-[var(--text)]"
            >
              Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
              required
            />
          </div>

          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>

          <p className="text-center text-sm text-[var(--muted)]">
            Remembered your password?{" "}
            <Link
              to="/login"
              className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Go to login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
